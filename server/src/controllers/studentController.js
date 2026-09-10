const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { getPagination, escapeRegex } = require('../utils/pagination');
const { ROLES, ACCOUNT_STATUS, NOTIFICATION_TYPES, ENGAGEMENT } = require('../config/constants');
const progressService = require('../services/progressService');
const notificationService = require('../services/notificationService');
const mailService = require('../services/mailService');

function baseStudent(s) {
  return {
    _id: s._id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    avatarUrl: s.avatarUrl,
    status: s.status,
    studentInfo: s.studentInfo,
    lastActivityAt: s.lastActivityAt,
    lastLoginAt: s.lastLoginAt,
    createdAt: s.createdAt,
    rejectionReason: s.rejectionReason,
  };
}

/**
 * GET /api/students
 * Search, status filter, engagement filter and backend pagination.
 * Engagement is derived, so it is applied after the roll-up is computed.
 */
const listStudents = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const { page, limit, skip } = getPagination(query);
  const { search, status, engagement, sort, withProgress = true } = query;

  const filter = { role: ROLES.STUDENT, isDeleted: false };
  if (status && status !== 'ALL') filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const sortMap = {
    name: { name: 1 },
    '-name': { name: -1 },
    createdAt: { createdAt: 1 },
    '-createdAt': { createdAt: -1 },
    lastActivityAt: { lastActivityAt: 1 },
    '-lastActivityAt': { lastActivityAt: -1 },
  };
  const sortSpec = sortMap[sort] || { createdAt: -1 };

  const wantsEngagementFilter = engagement && engagement !== 'ALL';

  // Without an engagement filter the database can paginate directly.
  if (!wantsEngagementFilter) {
    const [items, total] = await Promise.all([
      User.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    let rows = items.map(baseStudent);
    if (withProgress && rows.length) {
      const summaries = await progressService.getBulkProgressSummary(rows.map((r) => r._id));
      rows = rows.map((r) => {
        const summary = summaries.get(String(r._id)) || {};
        return {
          ...r,
          progress: summary,
          engagement:
            r.status === ACCOUNT_STATUS.APPROVED
              ? progressService.computeEngagement(r, summary)
              : null,
        };
      });
    }
    return paginated(res, rows, { page, limit, total });
  }

  // Engagement is computed, so filter the approved cohort in memory then page it.
  const all = await User.find({ ...filter, status: ACCOUNT_STATUS.APPROVED })
    .sort(sortSpec)
    .lean();

  const summaries = await progressService.getBulkProgressSummary(all.map((s) => s._id));
  const enriched = all.map((s) => {
    const summary = summaries.get(String(s._id)) || {};
    return {
      ...baseStudent(s),
      progress: summary,
      engagement: progressService.computeEngagement(s, summary),
    };
  });

  const filtered = enriched.filter((s) => s.engagement === engagement);
  return paginated(res, filtered.slice(skip, skip + limit), {
    page,
    limit,
    total: filtered.length,
  });
});

/** GET /api/students/pending - the approval queue. */
const listPendingStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.validatedQuery || req.query);
  const filter = { role: ROLES.STUDENT, isDeleted: false, status: ACCOUNT_STATUS.PENDING };

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return paginated(res, items.map(baseStudent), { page, limit, total });
});

/** GET /api/students/:id - the full student detail page payload. */
const getStudentDetails = asyncHandler(async (req, res) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  }).lean();
  if (!student) throw ApiError.notFound('Student not found');

  const [progress, summaries, assessments, timeline] = await Promise.all([
    progressService.getStudentProgress(student._id),
    progressService.getBulkProgressSummary([student._id]),
    progressService.getStudentAssessmentSummary(student._id),
    progressService.getActivityTimeline(student._id, { limit: 25 }),
  ]);

  const summary = summaries.get(String(student._id)) || {};

  return ok(res, {
    student: {
      ...baseStudent(student),
      engagement:
        student.status === ACCOUNT_STATUS.APPROVED
          ? progressService.computeEngagement(student, summary)
          : null,
    },
    progress,
    rollup: summary,
    exams: assessments.exams,
    attendance: assessments.attendance,
    timeline: timeline.items,
    timelineTotal: timeline.total,
  });
});

/** GET /api/students/:id/activity - paginated activity timeline. */
const getStudentActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.validatedQuery || req.query);

  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  }).select('_id');
  if (!student) throw ApiError.notFound('Student not found');

  const { items, total } = await progressService.getActivityTimeline(student._id, { limit, skip });
  return paginated(res, items, { page, limit, total });
});

/** PATCH /api/students/:id/review - approve or reject a registration. */
const reviewStudent = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;

  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  });
  if (!student) throw ApiError.notFound('Student not found');

  const approving = decision === 'APPROVE';
  student.status = approving ? ACCOUNT_STATUS.APPROVED : ACCOUNT_STATUS.REJECTED;
  student.reviewedBy = req.user._id;
  student.reviewedAt = new Date();
  student.rejectionReason = approving ? '' : reason || '';
  await student.save();

  await notificationService.notifyUser(student._id, {
    type: approving ? NOTIFICATION_TYPES.ACCOUNT_APPROVED : NOTIFICATION_TYPES.ACCOUNT_REJECTED,
    title: approving ? 'Your account has been approved' : 'Your registration was not approved',
    message: approving
      ? 'You can now open your modules and start learning.'
      : reason || 'Please contact the teacher for more information.',
    link: approving ? '/student' : '/pending',
  });

  return ok(res, baseStudent(student), approving ? 'Student approved' : 'Student rejected');
});

/** PATCH /api/students/bulk-review - approve or reject several at once. */
const bulkReviewStudents = asyncHandler(async (req, res) => {
  const { studentIds, decision, reason } = req.body;
  const approving = decision === 'APPROVE';

  const result = await User.updateMany(
    { _id: { $in: studentIds }, role: ROLES.STUDENT, isDeleted: false },
    {
      $set: {
        status: approving ? ACCOUNT_STATUS.APPROVED : ACCOUNT_STATUS.REJECTED,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        rejectionReason: approving ? '' : reason || '',
      },
    }
  );

  await notificationService.notifyUsers(studentIds, {
    type: approving ? NOTIFICATION_TYPES.ACCOUNT_APPROVED : NOTIFICATION_TYPES.ACCOUNT_REJECTED,
    title: approving ? 'Your account has been approved' : 'Your registration was not approved',
    message: approving
      ? 'You can now open your modules and start learning.'
      : reason || 'Please contact the teacher for more information.',
    link: approving ? '/student' : '/pending',
  });

  return ok(
    res,
    { updated: result.modifiedCount },
    `${result.modifiedCount} student${result.modifiedCount === 1 ? '' : 's'} ${
      approving ? 'approved' : 'rejected'
    }`
  );
});

/**
 * PATCH /api/students/:id/password
 *
 * For the student who cannot receive the reset email: wrong address, no access,
 * or no email habit at all. Every session that student had is ended by the
 * password change, and they are told it happened.
 */
const setStudentPassword = asyncHandler(async (req, res) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  }).select('+password');
  if (!student) throw ApiError.notFound('Student not found');

  student.password = req.body.password;
  student.clearPasswordResetToken();
  await student.save();

  await notificationService.notifyUser(student._id, {
    type: NOTIFICATION_TYPES.ACCOUNT_APPROVED,
    title: 'Your password was changed',
    message: 'Your teacher set a new password for your account.',
    link: '/student/settings',
  });

  mailService.sendPasswordChanged({ to: student.email, name: student.name });

  return ok(res, null, `New password set for ${student.name}`);
});

/** PUT /api/students/:id - edit the teacher-facing record. */
const updateStudent = asyncHandler(async (req, res) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  });
  if (!student) throw ApiError.notFound('Student not found');

  const { name, phone, grade, school, parentPhone, notes } = req.body;
  if (name !== undefined) student.name = name;
  if (phone !== undefined) student.phone = phone;
  student.studentInfo = {
    ...student.studentInfo,
    ...(grade !== undefined ? { grade } : {}),
    ...(school !== undefined ? { school } : {}),
    ...(parentPhone !== undefined ? { parentPhone } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  await student.save();
  return ok(res, baseStudent(student), 'Student updated');
});

/** DELETE /api/students/:id - soft delete so activity history stays intact. */
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
    isDeleted: false,
  });
  if (!student) throw ApiError.notFound('Student not found');

  student.isDeleted = true;
  student.email = `deleted_${student._id}_${student.email}`;
  await student.save();

  return ok(res, null, 'Student removed');
});

/** GET /api/students/options/approved - lightweight list for meeting invites. */
const approvedStudentOptions = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const filter = { role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const students = await User.find(filter)
    .select('name email avatarUrl studentInfo.grade')
    .sort({ name: 1 })
    .limit(500)
    .lean();

  return ok(res, students);
});

/** GET /api/students/stats/summary - counters for the students page header. */
const studentStats = asyncHandler(async (_req, res) => {
  const base = { role: ROLES.STUDENT, isDeleted: false };
  const [total, pending, approved, rejected] = await Promise.all([
    User.countDocuments(base),
    User.countDocuments({ ...base, status: ACCOUNT_STATUS.PENDING }),
    User.countDocuments({ ...base, status: ACCOUNT_STATUS.APPROVED }),
    User.countDocuments({ ...base, status: ACCOUNT_STATUS.REJECTED }),
  ]);

  const approvedStudents = await User.find({ ...base, status: ACCOUNT_STATUS.APPROVED })
    .select('lastActivityAt')
    .lean();
  const summaries = await progressService.getBulkProgressSummary(
    approvedStudents.map((s) => s._id)
  );

  const counts = { ACTIVE: 0, AT_RISK: 0, INACTIVE: 0 };
  for (const s of approvedStudents) {
    counts[progressService.computeEngagement(s, summaries.get(String(s._id)) || {})] += 1;
  }

  return ok(res, {
    total,
    pending,
    approved,
    rejected,
    engagement: {
      active: counts[ENGAGEMENT.ACTIVE],
      atRisk: counts[ENGAGEMENT.AT_RISK],
      inactive: counts[ENGAGEMENT.INACTIVE],
    },
  });
});

module.exports = {
  listStudents,
  listPendingStudents,
  getStudentDetails,
  getStudentActivity,
  reviewStudent,
  bulkReviewStudents,
  setStudentPassword,
  updateStudent,
  deleteStudent,
  approvedStudentOptions,
  studentStats,
};
