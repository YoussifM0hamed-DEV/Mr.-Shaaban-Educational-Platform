const { Group, Module, User } = require('../models');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');

/**
 * Decides which curriculum a given student is allowed to see.
 *
 * A module with no groups is open to every approved student. A module with
 * groups is open only to members of those groups. Everything inside a module -
 * its lessons, videos, materials, quizzes and exam - inherits that rule, so
 * access is decided in exactly one place.
 */

/** The group ids a student belongs to. */
async function getStudentGroupIds(studentId) {
  const groups = await Group.find({ students: studentId, isDeleted: false }).select('_id').lean();
  return groups.map((g) => g._id);
}

/**
 * A mongo filter fragment restricting modules to what this student may open.
 * Merge it into any module query for a student.
 */
async function moduleAccessFilter(studentId) {
  const groupIds = await getStudentGroupIds(studentId);
  return {
    $or: [
      { groups: { $size: 0 } },
      { groups: { $exists: false } },
      ...(groupIds.length ? [{ groups: { $in: groupIds } }] : []),
    ],
  };
}

/** The ids of every module this student may open, published ones only. */
async function accessibleModuleIds(studentId) {
  const filter = await moduleAccessFilter(studentId);
  const modules = await Module.find({ isDeleted: false, isPublished: true, ...filter })
    .select('_id')
    .lean();
  return modules.map((m) => m._id);
}

/**
 * Throws unless this user may open the module. Staff always may.
 * The message matches a missing module so another group's curriculum cannot be
 * discovered by probing ids.
 */
async function assertModuleAccess(user, moduleId) {
  if (!user || user.role !== ROLES.STUDENT) return;
  const allowed = await canAccessModule(user._id, moduleId);
  if (!allowed) throw ApiError.notFound('This content is not available for you');
}

/** True when the student may open this specific module. */
async function canAccessModule(studentId, moduleId) {
  const filter = await moduleAccessFilter(studentId);
  const found = await Module.findOne({
    _id: moduleId,
    isDeleted: false,
    isPublished: true,
    ...filter,
  }).select('_id');
  return Boolean(found);
}

/**
 * Every approved student who may open a module, for one module or for many.
 * Used by analytics so a percentage is measured against the right denominator
 * instead of the whole school.
 */
async function studentsWithAccess(moduleIds) {
  const ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];

  const modules = await Module.find({ _id: { $in: ids } }).select('groups').lean();
  const [approved, groups] = await Promise.all([
    User.find({ role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false })
      .select('_id')
      .lean(),
    Group.find({ isDeleted: false }).select('students').lean(),
  ]);

  const membersOf = new Map(groups.map((g) => [String(g._id), new Set(g.students.map(String))]));
  const allStudentIds = approved.map((s) => String(s._id));

  const perModule = new Map();
  for (const mod of modules) {
    const modGroups = mod.groups || [];
    if (!modGroups.length) {
      perModule.set(String(mod._id), new Set(allStudentIds));
      continue;
    }
    const allowed = new Set();
    for (const gid of modGroups) {
      const members = membersOf.get(String(gid));
      if (members) members.forEach((sid) => allowed.add(sid));
    }
    perModule.set(String(mod._id), allowed);
  }

  return perModule;
}

/**
 * The students who should be told about new content in a module.
 * Keeps a Grade 2 student from being pinged about a Grade 3 lesson.
 */
async function studentsToNotifyForModule(moduleId) {
  const perModule = await studentsWithAccess([moduleId]);
  return [...(perModule.get(String(moduleId)) || [])];
}

/** Flattens a set of groups into the students inside them, deduplicated. */
async function studentsInGroups(groupIds) {
  if (!groupIds || !groupIds.length) return [];

  const groups = await Group.find({ _id: { $in: groupIds }, isDeleted: false })
    .select('students')
    .lean();

  const ids = new Set();
  groups.forEach((g) => g.students.forEach((s) => ids.add(String(s))));
  if (!ids.size) return [];

  // Only approved students can ever be given access or invited.
  const approved = await User.find({
    _id: { $in: [...ids] },
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  })
    .select('_id')
    .lean();

  return approved.map((s) => s._id);
}

module.exports = {
  getStudentGroupIds,
  moduleAccessFilter,
  accessibleModuleIds,
  canAccessModule,
  assertModuleAccess,
  studentsWithAccess,
  studentsToNotifyForModule,
  studentsInGroups,
};
