const {
  Module,
  Lesson,
  Quiz,
  Exam,
  QuizAttempt,
  ExamAttempt,
  LiveMeeting,
  MeetingAttendance,
  Announcement,
  StudentActivity,
  User,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const env = require('../config/env');
const { ROLES, MEETING_STATUS, ATTENDANCE_STATUS } = require('../config/constants');
const progressService = require('../services/progressService');

/**
 * GET /api/student/dashboard
 * One call that powers the student home screen: progress, what to do next,
 * live classes and the latest announcements.
 */
const dashboard = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const now = new Date();

  const [progress, teacher] = await Promise.all([
    progressService.getStudentProgress(studentId),
    User.findOne({ role: ROLES.TEACHER, isDeleted: false }).select('name avatarUrl phone').lean(),
  ]);

  // "Continue where you stopped": the first lesson that is started but unfinished,
  // otherwise the first untouched lesson.
  let continueLesson = null;
  outer: for (const mod of progress.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.percentage > 0 && lesson.percentage < 100) {
        continueLesson = { ...lesson, moduleTitle: mod.title, moduleId: mod.moduleId };
        break outer;
      }
    }
  }
  if (!continueLesson) {
    outer2: for (const mod of progress.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.percentage === 0) {
          continueLesson = { ...lesson, moduleTitle: mod.title, moduleId: mod.moduleId };
          break outer2;
        }
      }
    }
  }

  const pendingQuizzes = progress.modules
    .flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })))
    .filter((l) => l.quiz && !l.quiz.completed)
    .slice(0, 5)
    .map((l) => ({
      quizId: l.quiz.quizId,
      title: l.quiz.title,
      lessonId: l.lessonId,
      lessonTitle: l.title,
      moduleTitle: l.moduleTitle,
    }));

  const [exams, examAttempts, liveMeetings, upcomingMeetings, announcements, attendance] =
    await Promise.all([
      Exam.find({ isDeleted: false, isPublished: true })
        .select('title module timeLimit availableFrom availableTo passingGrade questions')
        .populate('module', 'title')
        .lean(),
      ExamAttempt.find({ student: studentId, status: { $ne: 'IN_PROGRESS' } }).lean(),
      LiveMeeting.find({
        isDeleted: false,
        attendees: studentId,
        isPublished: true,
        startTime: { $lte: now },
        endTime: { $gt: now },
        status: { $ne: MEETING_STATUS.CANCELLED },
      })
        .populate('module', 'title')
        .sort({ startTime: 1 })
        .lean(),
      LiveMeeting.find({
        isDeleted: false,
        attendees: studentId,
        isPublished: true,
        startTime: { $gt: now },
        status: { $ne: MEETING_STATUS.CANCELLED },
      })
        .populate('module', 'title')
        .sort({ startTime: 1 })
        .limit(5)
        .lean(),
      Announcement.find({ isDeleted: false, isPublished: true })
        .sort({ pinned: -1, createdAt: -1 })
        .limit(4)
        .lean(),
      MeetingAttendance.aggregate([
        { $match: { student: studentId, invited: true } },
        {
          $group: {
            _id: null,
            invited: { $sum: 1 },
            attended: {
              $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

  const takenExamIds = new Set(examAttempts.map((a) => String(a.exam)));
  const upcomingExams = exams
    .filter((e) => !takenExamIds.has(String(e._id)))
    .filter((e) => !e.availableTo || new Date(e.availableTo) >= now)
    .slice(0, 4)
    .map((e) => ({
      _id: e._id,
      title: e.title,
      moduleTitle: e.module ? e.module.title : '',
      questionCount: e.questions.length,
      timeLimit: e.timeLimit,
      availableFrom: e.availableFrom,
      availableTo: e.availableTo,
    }));

  const strip = (m) => ({
    _id: m._id,
    title: m.title,
    description: m.description,
    startTime: m.startTime,
    endTime: m.endTime,
    provider: m.provider,
    moduleTitle: m.module ? m.module.title : '',
    status: m.status,
  });

  const att = attendance[0] || { invited: 0, attended: 0 };

  return ok(res, {
    teacher: {
      name: teacher ? teacher.name : env.TEACHER_NAME,
      avatarUrl: teacher ? teacher.avatarUrl : '',
      subject: env.TEACHER_SUBJECT,
      platformName: env.PLATFORM_NAME,
    },
    progress: {
      overall: progress.overall,
      summary: progress.summary,
      modules: progress.modules.map((m) => ({
        moduleId: m.moduleId,
        title: m.title,
        percentage: m.percentage,
        lessonCount: m.lessonCount,
        color: m.color,
      })),
    },
    continueLesson,
    pendingQuizzes,
    upcomingExams,
    liveNow: liveMeetings.map(strip),
    upcomingMeetings: upcomingMeetings.map(strip),
    announcements,
    attendance: {
      invited: att.invited,
      attended: att.attended,
      percentage: att.invited ? Math.round((att.attended / att.invited) * 100) : 0,
    },
  });
});

/** GET /api/student/activity - the student's own recent activity. */
const myActivity = asyncHandler(async (req, res) => {
  const items = await StudentActivity.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('module', 'title')
    .populate('lesson', 'title')
    .lean();
  return ok(res, items);
});

module.exports = { dashboard, myActivity };
