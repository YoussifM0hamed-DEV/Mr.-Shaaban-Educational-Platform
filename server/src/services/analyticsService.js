const {
  User,
  Module,
  Lesson,
  Video,
  Material,
  Quiz,
  Exam,
  QuizAttempt,
  ExamAttempt,
  VideoProgress,
  MaterialAccess,
  LiveMeeting,
  MeetingAttendance,
  StudentActivity,
} = require('../models');
const {
  ROLES,
  ACCOUNT_STATUS,
  MEETING_STATUS,
  ATTENDANCE_STATUS,
  ENGAGEMENT,
} = require('../config/constants');
const env = require('../config/env');
const progressService = require('./progressService');
const accessService = require('./accessService');

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Headline counters plus cohort-wide engagement percentages for the teacher dashboard. */
async function getDashboardStats() {
  const now = new Date();
  const activeSince = new Date(now.getTime() - env.AT_RISK_DAYS_THRESHOLD * 86400000);

  const studentBase = { role: ROLES.STUDENT, isDeleted: false };

  const [
    totalStudents,
    pendingStudents,
    approvedStudents,
    rejectedStudents,
    activeStudents,
    totalAssistants,
    totalModules,
    publishedModules,
    totalLessons,
    totalQuizzes,
    totalExams,
    totalVideos,
    totalMaterials,
    upcomingMeetings,
    liveMeetings,
  ] = await Promise.all([
    User.countDocuments(studentBase),
    User.countDocuments({ ...studentBase, status: ACCOUNT_STATUS.PENDING }),
    User.countDocuments({ ...studentBase, status: ACCOUNT_STATUS.APPROVED }),
    User.countDocuments({ ...studentBase, status: ACCOUNT_STATUS.REJECTED }),
    User.countDocuments({
      ...studentBase,
      status: ACCOUNT_STATUS.APPROVED,
      lastActivityAt: { $gte: activeSince },
    }),
    User.countDocuments({ role: ROLES.ASSISTANT, isDeleted: false }),
    Module.countDocuments({ isDeleted: false }),
    Module.countDocuments({ isDeleted: false, isPublished: true }),
    Lesson.countDocuments({ isDeleted: false }),
    Quiz.countDocuments({ isDeleted: false }),
    Exam.countDocuments({ isDeleted: false }),
    Video.countDocuments({}),
    Material.countDocuments({}),
    LiveMeeting.countDocuments({
      isDeleted: false,
      status: MEETING_STATUS.UPCOMING,
      startTime: { $gte: now },
    }),
    LiveMeeting.countDocuments({ isDeleted: false, status: MEETING_STATUS.LIVE }),
  ]);

  const engagement = await getEngagementRates();

  return {
    students: {
      total: totalStudents,
      pending: pendingStudents,
      approved: approvedStudents,
      rejected: rejectedStudents,
      active: activeStudents,
    },
    assistants: totalAssistants,
    content: {
      modules: totalModules,
      publishedModules,
      lessons: totalLessons,
      videos: totalVideos,
      materials: totalMaterials,
      quizzes: totalQuizzes,
      exams: totalExams,
    },
    meetings: { upcoming: upcomingMeetings, live: liveMeetings },
    engagement,
  };
}

/**
 * Counts every (student x content) pair that actually exists.
 *
 * With groups this is not students multiplied by content: a Grade 3 module is
 * only owed by Grade 3 students. Getting this wrong would make every rate on
 * the dashboard look worse than reality.
 */
async function countExpectedPairs() {
  const modules = await Module.find({ isDeleted: false, isPublished: true })
    .select('_id')
    .lean();
  const moduleIds = modules.map((m) => m._id);
  if (!moduleIds.length) return { videos: 0, materials: 0, quizzes: 0, exams: 0 };

  const lessons = await Lesson.find({ module: { $in: moduleIds }, isDeleted: false })
    .select('_id module')
    .lean();
  const lessonIds = lessons.map((l) => l._id);
  const moduleOfLesson = new Map(lessons.map((l) => [String(l._id), String(l.module)]));

  const [videos, materials, quizzes, exams, accessByModule] = await Promise.all([
    Video.find({ lesson: { $in: lessonIds } }).select('lesson').lean(),
    Material.find({ lesson: { $in: lessonIds } }).select('lesson').lean(),
    Quiz.find({ lesson: { $in: lessonIds }, isDeleted: false, isPublished: true })
      .select('lesson')
      .lean(),
    Exam.find({ module: { $in: moduleIds }, isDeleted: false, isPublished: true })
      .select('module')
      .lean(),
    accessService.studentsWithAccess(moduleIds),
  ]);

  const cohortSize = (moduleKey) => (accessByModule.get(moduleKey) || new Set()).size;

  const byLesson = (rows) =>
    rows.reduce((sum, r) => sum + cohortSize(moduleOfLesson.get(String(r.lesson)) || ''), 0);

  return {
    videos: byLesson(videos),
    materials: byLesson(materials),
    quizzes: byLesson(quizzes),
    exams: exams.reduce((sum, e) => sum + cohortSize(String(e.module)), 0),
  };
}

/**
 * Cohort completion rates.
 * Each rate is completed-interactions divided by every (student x content) pair
 * that the groups actually create.
 */
async function getEngagementRates() {
  const expected = await countExpectedPairs();

  const [videoCompleted, materialOpened, quizDone, examDone, attendance] = await Promise.all([
    VideoProgress.countDocuments({ completed: true }),
    MaterialAccess.estimatedDocumentCount(),
    QuizAttempt.aggregate([
      { $match: { status: 'SUBMITTED' } },
      { $group: { _id: { s: '$student', q: '$quiz' } } },
      { $count: 'n' },
    ]),
    ExamAttempt.aggregate([
      { $match: { status: 'SUBMITTED' } },
      { $group: { _id: { s: '$student', e: '$exam' } } },
      { $count: 'n' },
    ]),
    MeetingAttendance.aggregate([
      { $match: { invited: true } },
      {
        $group: {
          _id: null,
          invited: { $sum: 1 },
          attended: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const quizCount = quizDone[0]?.n || 0;
  const examCount = examDone[0]?.n || 0;
  const att = attendance[0] || { invited: 0, attended: 0 };

  return {
    videoCompletion: pct(videoCompleted, expected.videos),
    materialAccess: pct(materialOpened, expected.materials),
    quizCompletion: pct(quizCount, expected.quizzes),
    examCompletion: pct(examCount, expected.exams),
    liveAttendance: pct(att.attended, att.invited),
  };
}

/**
 * Students who are falling behind, ordered by how little they have done.
 * This is the list the teacher acts on first.
 */
async function getStudentsNeedingAttention(limit = 8) {
  const students = await User.find({
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  })
    .select('name email avatarUrl lastActivityAt createdAt')
    .lean();

  if (!students.length) return [];

  const ids = students.map((s) => s._id);
  const summaries = await progressService.getBulkProgressSummary(ids);

  const enriched = students.map((s) => {
    const summary = summaries.get(String(s._id)) || {};
    const engagement = progressService.computeEngagement(s, summary);
    return {
      _id: s._id,
      name: s.name,
      email: s.email,
      avatarUrl: s.avatarUrl,
      lastActivityAt: s.lastActivityAt,
      engagement,
      overall: summary.overall || 0,
      videoProgress: summary.videoProgress || 0,
      materialsOpened: summary.materialsOpened || 0,
      materialsTotal: summary.materialsTotal || 0,
      quizzesCompleted: summary.quizzesCompleted || 0,
      quizzesTotal: summary.quizzesTotal || 0,
    };
  });

  return enriched
    .filter((s) => s.engagement !== ENGAGEMENT.ACTIVE)
    .sort((a, b) => {
      if (a.engagement !== b.engagement) return a.engagement === ENGAGEMENT.INACTIVE ? -1 : 1;
      return a.overall - b.overall;
    })
    .slice(0, limit);
}

/**
 * Per-lesson engagement: did the cohort actually study this lesson?
 */
async function getLessonAnalytics(lessonIds = null) {
  const lessonFilter = { isDeleted: false };
  if (lessonIds) lessonFilter._id = { $in: lessonIds };

  const lessons = await Lesson.find(lessonFilter)
    .sort({ order: 1 })
    .populate('module', 'title order')
    .lean();

  if (!lessons.length) return [];
  const ids = lessons.map((l) => l._id);

  // Percentages are only meaningful against the students who can open the module.
  const moduleIds = [...new Set(lessons.map((l) => String(l.module?._id || l.module)))];
  const accessByModule = await accessService.studentsWithAccess(moduleIds);

  const [videoStats, materialStats, quizStats, materialCounts] = await Promise.all([
    VideoProgress.aggregate([
      { $match: { lesson: { $in: ids } } },
      {
        $group: {
          _id: '$lesson',
          started: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          avgProgress: { $avg: '$percentage' },
        },
      },
    ]),
    MaterialAccess.aggregate([
      { $match: { lesson: { $in: ids } } },
      { $group: { _id: { lesson: '$lesson', student: '$student' } } },
      { $group: { _id: '$_id.lesson', studentsOpened: { $sum: 1 } } },
    ]),
    QuizAttempt.aggregate([
      { $match: { lesson: { $in: ids }, status: 'SUBMITTED' } },
      {
        $group: {
          _id: { lesson: '$lesson', student: '$student' },
          best: { $max: '$percentage' },
          passed: { $max: { $cond: ['$passed', 1, 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.lesson',
          completed: { $sum: 1 },
          avgScore: { $avg: '$best' },
          passedCount: { $sum: '$passed' },
        },
      },
    ]),
    Material.aggregate([
      { $match: { lesson: { $in: ids } } },
      { $group: { _id: '$lesson', count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const vMap = toMap(videoStats);
  const mMap = toMap(materialStats);
  const qMap = toMap(quizStats);
  const mcMap = toMap(materialCounts);

  const videosByLesson = new Map(
    (await Video.find({ lesson: { $in: ids } }).select('lesson title').lean()).map((v) => [
      String(v.lesson),
      v,
    ])
  );
  const quizzesByLesson = new Map(
    (await Quiz.find({ lesson: { $in: ids }, isDeleted: false }).select('lesson title').lean()).map(
      (q) => [String(q.lesson), q]
    )
  );

  return lessons.map((lesson) => {
    const key = String(lesson._id);
    const v = vMap.get(key);
    const m = mMap.get(key);
    const q = qMap.get(key);

    const moduleKey = String(lesson.module?._id || lesson.module);
    const cohort = accessByModule.get(moduleKey);

    return {
      lessonId: key,
      title: lesson.title,
      order: lesson.order,
      isPublished: lesson.isPublished,
      module: lesson.module ? { _id: lesson.module._id, title: lesson.module.title } : null,
      totalStudents: cohort ? cohort.size : 0,
      video: {
        exists: videosByLesson.has(key),
        started: v ? v.started : 0,
        completed: v ? v.completed : 0,
        avgProgress: v && v.avgProgress != null ? Math.round(v.avgProgress) : 0,
      },
      material: {
        count: mcMap.get(key)?.count || 0,
        studentsOpened: m ? m.studentsOpened : 0,
      },
      quiz: {
        exists: quizzesByLesson.has(key),
        completed: q ? q.completed : 0,
        passed: q ? q.passedCount : 0,
        avgScore: q && q.avgScore != null ? Math.round(q.avgScore) : 0,
      },
    };
  });
}

/** Aggregate results for one quiz or exam, used on the results screens. */
async function getAssessmentAnalytics({ quizId = null, examId = null }) {
  const Model = quizId ? QuizAttempt : ExamAttempt;
  const field = quizId ? 'quiz' : 'exam';
  const id = quizId || examId;

  // Only the students whose groups can open the parent module.
  const source = quizId
    ? await require('../models').Quiz.findById(quizId).select('module').lean()
    : await require('../models').Exam.findById(examId).select('module').lean();

  const cohort = source
    ? (await accessService.studentsWithAccess([source.module])).get(String(source.module))
    : null;
  const approvedStudents = cohort ? cohort.size : 0;

  const rows = await Model.aggregate([
    { $match: { [field]: id, status: 'SUBMITTED' } },
    {
      $group: {
        _id: '$student',
        best: { $max: '$percentage' },
        attempts: { $sum: 1 },
        lastSubmittedAt: { $max: '$submittedAt' },
        passed: { $max: { $cond: ['$passed', 1, 0] } },
      },
    },
  ]);

  const scores = rows.map((r) => r.best);
  const taken = rows.length;

  return {
    totalStudents: approvedStudents,
    taken,
    notTaken: Math.max(0, approvedStudents - taken),
    completionRate: pct(taken, approvedStudents),
    passed: rows.filter((r) => r.passed).length,
    failed: rows.filter((r) => !r.passed).length,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
  };
}

/** Daily activity counts for the dashboard trend chart. */
async function getActivityTrend(days = 14) {
  const since = new Date(Date.now() - days * 86400000);
  since.setHours(0, 0, 0, 0);

  const rows = await StudentActivity.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: 1 },
        students: { $addToSet: '$student' },
      },
    },
    { $project: { total: 1, activeStudents: { $size: '$students' } } },
    { $sort: { _id: 1 } },
  ]);

  const byDate = new Map(rows.map((r) => [r._id, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    series.push({
      date: key,
      total: row ? row.total : 0,
      activeStudents: row ? row.activeStudents : 0,
    });
  }
  return series;
}

/** Attendance across recent meetings, for the meetings analytics chart. */
async function getMeetingAnalytics(limit = 10) {
  const meetings = await LiveMeeting.find({
    isDeleted: false,
    status: { $in: [MEETING_STATUS.ENDED, MEETING_STATUS.LIVE] },
  })
    .sort({ startTime: -1 })
    .limit(limit)
    .lean();

  if (!meetings.length) return [];

  const ids = meetings.map((m) => m._id);
  const rows = await MeetingAttendance.aggregate([
    { $match: { meeting: { $in: ids } } },
    {
      $group: {
        _id: '$meeting',
        invited: { $sum: { $cond: ['$invited', 1, 0] } },
        attended: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] } },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [String(r._id), r]));

  return meetings
    .map((m) => {
      const r = map.get(String(m._id)) || { invited: 0, attended: 0 };
      return {
        meetingId: String(m._id),
        title: m.title,
        startTime: m.startTime,
        invited: r.invited,
        attended: r.attended,
        absent: Math.max(0, r.invited - r.attended),
        attendancePercentage: r.invited ? Math.round((r.attended / r.invited) * 1000) / 10 : 0,
      };
    })
    .reverse();
}

module.exports = {
  getDashboardStats,
  getEngagementRates,
  getStudentsNeedingAttention,
  getLessonAnalytics,
  getAssessmentAnalytics,
  getActivityTrend,
  getMeetingAnalytics,
};
