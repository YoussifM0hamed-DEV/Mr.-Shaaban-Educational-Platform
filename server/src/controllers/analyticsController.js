const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { StudentActivity, Lesson } = require('../models');
const analyticsService = require('../services/analyticsService');
const progressService = require('../services/progressService');

/** GET /api/analytics/dashboard - everything the teacher dashboard needs in one call. */
const dashboard = asyncHandler(async (_req, res) => {
  const [stats, attention, trend, meetings] = await Promise.all([
    analyticsService.getDashboardStats(),
    analyticsService.getStudentsNeedingAttention(6),
    analyticsService.getActivityTrend(14),
    analyticsService.getMeetingAnalytics(6),
  ]);

  return ok(res, { stats, studentsNeedingAttention: attention, activityTrend: trend, meetings });
});

/** GET /api/analytics/students-needing-attention */
const studentsNeedingAttention = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 12);
  const rows = await analyticsService.getStudentsNeedingAttention(limit);
  return ok(res, rows);
});

/** GET /api/analytics/lessons - "did my students actually study this lesson?" */
const lessonAnalytics = asyncHandler(async (req, res) => {
  let lessonIds = null;
  if (req.query.module) {
    const lessons = await Lesson.find({ module: req.query.module, isDeleted: false }).select('_id');
    lessonIds = lessons.map((l) => l._id);
  }
  const rows = await analyticsService.getLessonAnalytics(lessonIds);
  return ok(res, rows);
});

/** GET /api/analytics/lessons/:id */
const singleLessonAnalytics = asyncHandler(async (req, res) => {
  const rows = await analyticsService.getLessonAnalytics([req.params.id]);
  if (!rows.length) throw ApiError.notFound('Lesson not found');
  return ok(res, rows[0]);
});

/** GET /api/analytics/meetings */
const meetingAnalytics = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const rows = await analyticsService.getMeetingAnalytics(limit);
  return ok(res, rows);
});

/** GET /api/analytics/activity-trend */
const activityTrend = asyncHandler(async (req, res) => {
  const days = Math.min(90, Number(req.query.days) || 14);
  const rows = await analyticsService.getActivityTrend(days);
  return ok(res, rows);
});

/** GET /api/activities - platform-wide activity feed for staff. */
const listActivities = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (req.query.student) filter.student = req.query.student;
  if (req.query.type) filter.activityType = req.query.type;
  if (req.query.lesson) filter.lesson = req.query.lesson;
  if (req.query.module) filter.module = req.query.module;

  const [items, total] = await Promise.all([
    StudentActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('student', 'name email avatarUrl')
      .populate('module', 'title')
      .populate('lesson', 'title')
      .lean(),
    StudentActivity.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total });
});

/** GET /api/progress/me - the signed-in student's own progress tree. */
const myProgress = asyncHandler(async (req, res) => {
  const progress = await progressService.getStudentProgress(req.user._id);
  return ok(res, progress);
});

/** GET /api/progress/students/:id - a specific student's progress tree, for staff. */
const studentProgress = asyncHandler(async (req, res) => {
  const progress = await progressService.getStudentProgress(req.params.id);
  return ok(res, progress);
});

module.exports = {
  dashboard,
  studentsNeedingAttention,
  lessonAnalytics,
  singleLessonAnalytics,
  meetingAnalytics,
  activityTrend,
  listActivities,
  myProgress,
  studentProgress,
};
