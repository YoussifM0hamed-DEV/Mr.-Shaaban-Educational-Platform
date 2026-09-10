const { Group, Module, LiveMeeting, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { escapeRegex } = require('../utils/pagination');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const progressService = require('../services/progressService');

/** Only approved students can be put in a group. */
async function keepApprovedStudents(ids = []) {
  if (!ids.length) return [];
  const students = await User.find({
    _id: { $in: ids },
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  })
    .select('_id')
    .lean();
  return students.map((s) => s._id);
}

/** GET /api/groups */
const listGroups = asyncHandler(async (req, res) => {
  const filter = { isDeleted: false };
  if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), 'i');

  const groups = await Group.find(filter).sort({ name: 1 }).lean();
  const ids = groups.map((g) => g._id);

  // How much content and how many classes each group is actually used for.
  const [modules, meetings] = await Promise.all([
    Module.find({ isDeleted: false, groups: { $in: ids } }).select('groups title').lean(),
    LiveMeeting.find({ isDeleted: false, groups: { $in: ids } }).select('groups').lean(),
  ]);

  const moduleCount = new Map();
  for (const m of modules) {
    (m.groups || []).forEach((g) => moduleCount.set(String(g), (moduleCount.get(String(g)) || 0) + 1));
  }
  const meetingCount = new Map();
  for (const m of meetings) {
    (m.groups || []).forEach((g) => meetingCount.set(String(g), (meetingCount.get(String(g)) || 0) + 1));
  }

  return ok(
    res,
    groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      color: g.color,
      studentCount: (g.students || []).length,
      moduleCount: moduleCount.get(String(g._id)) || 0,
      meetingCount: meetingCount.get(String(g._id)) || 0,
      createdAt: g.createdAt,
    }))
  );
});

/** GET /api/groups/:id - the group with its students and their progress. */
const getGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ _id: req.params.id, isDeleted: false }).lean();
  if (!group) throw ApiError.notFound('Group not found');

  const students = await User.find({ _id: { $in: group.students }, isDeleted: false })
    .select('name email avatarUrl status lastActivityAt studentInfo.grade')
    .sort({ name: 1 })
    .lean();

  const summaries = await progressService.getBulkProgressSummary(students.map((s) => s._id));

  const modules = await Module.find({ isDeleted: false, groups: group._id })
    .select('title isPublished order')
    .sort({ order: 1 })
    .lean();

  return ok(res, {
    group: {
      _id: group._id,
      name: group.name,
      description: group.description,
      color: group.color,
      createdAt: group.createdAt,
    },
    students: students.map((s) => {
      const summary = summaries.get(String(s._id)) || {};
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        avatarUrl: s.avatarUrl,
        status: s.status,
        grade: s.studentInfo?.grade || '',
        lastActivityAt: s.lastActivityAt,
        progress: summary,
        engagement:
          s.status === ACCOUNT_STATUS.APPROVED
            ? progressService.computeEngagement(s, summary)
            : null,
      };
    }),
    modules,
  });
});

/** POST /api/groups */
const createGroup = asyncHandler(async (req, res) => {
  const students = await keepApprovedStudents(req.body.students);

  const group = await Group.create({
    name: req.body.name,
    description: req.body.description,
    color: req.body.color,
    students,
    createdBy: req.user._id,
  });

  return created(res, group, 'Group created');
});

/** PUT /api/groups/:id */
const updateGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ _id: req.params.id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (req.body.name !== undefined) group.name = req.body.name;
  if (req.body.description !== undefined) group.description = req.body.description;
  if (req.body.color !== undefined) group.color = req.body.color;
  if (req.body.students !== undefined) {
    group.students = await keepApprovedStudents(req.body.students);
  }

  await group.save();
  return ok(res, group, 'Group updated');
});

/** PATCH /api/groups/:id/students - add or remove without resending the whole list. */
const changeMembers = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ _id: req.params.id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  const { add = [], remove = [] } = req.body;
  const current = new Set(group.students.map(String));

  const toAdd = await keepApprovedStudents(add);
  toAdd.forEach((id) => current.add(String(id)));
  remove.forEach((id) => current.delete(String(id)));

  group.students = [...current];
  await group.save();

  return ok(res, { studentCount: group.students.length }, 'Group members updated');
});

/**
 * DELETE /api/groups/:id
 * Removing a group also removes it from any module that used it. A module left
 * with no groups becomes open to everyone, so the teacher is told how many
 * modules that affects.
 */
const deleteGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({ _id: req.params.id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  const affected = await Module.find({ isDeleted: false, groups: group._id })
    .select('title groups')
    .lean();

  const wouldOpenUp = affected.filter((m) => (m.groups || []).length === 1).map((m) => m.title);

  await Module.updateMany({ groups: group._id }, { $pull: { groups: group._id } });
  await LiveMeeting.updateMany({ groups: group._id }, { $pull: { groups: group._id } });

  group.isDeleted = true;
  await group.save();

  return ok(
    res,
    { modulesUpdated: affected.length, modulesNowOpenToEveryone: wouldOpenUp },
    'Group deleted'
  );
});

module.exports = {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  changeMembers,
  deleteGroup,
};
