const { Module, Exam, ExamAttempt, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  ROLES,
  ACCOUNT_STATUS,
  ACTIVITY_TYPES,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const gradingService = require('../services/gradingService');
const analyticsService = require('../services/analyticsService');
const activityService = require('../services/activityService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');
const { EVENTS } = require('../sockets');

const isStaff = (user) => user.role === ROLES.TEACHER || user.role === ROLES.ASSISTANT;

/** POST /api/exams */
const createExam = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ _id: req.body.module, isDeleted: false });
  if (!module) throw ApiError.badRequest('The selected module does not exist');

  const exam = await Exam.create({ ...req.body, createdBy: req.user._id });
  if (exam.isPublished) await announceExam(exam, module);

  return created(res, exam, 'Exam created');
});

async function announceExam(exam, module) {
  await notificationService.notifyModuleStudents(module._id, {
    type: NOTIFICATION_TYPES.NEW_EXAM,
    title: 'New exam published',
    message: `"${exam.title}" is available in ${module.title}.`,
    link: `/student/exams/${exam._id}`,
    action: { label: 'VIEW EXAM', url: `/student/exams/${exam._id}` },
    meta: { examId: String(exam._id), moduleId: String(module._id) },
  });
}

/**
 * GET /api/exams
 * Students only see published exams and get their own attempt state attached.
 */
const listExams = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { isDeleted: false };
  if (!staff) {
    filter.isPublished = true;
    // Only exams belonging to a module this student's groups can open.
    filter.module = { $in: await accessService.accessibleModuleIds(req.user._id) };
  }
  if (req.query.module) filter.module = req.query.module;

  const exams = await Exam.find(filter).populate('module', 'title order').sort({ createdAt: -1 });

  if (staff) {
    return ok(
      res,
      exams.map((e) => ({
        _id: e._id,
        title: e.title,
        description: e.description,
        module: e.module,
        questionCount: e.questions.length,
        totalPoints: e.totalPoints,
        passingGrade: e.passingGrade,
        timeLimit: e.timeLimit,
        attemptsAllowed: e.attemptsAllowed,
        availableFrom: e.availableFrom,
        availableTo: e.availableTo,
        isPublished: e.isPublished,
        createdAt: e.createdAt,
      }))
    );
  }

  const attempts = await ExamAttempt.find({
    student: req.user._id,
    exam: { $in: exams.map((e) => e._id) },
  }).lean();

  const bestByExam = new Map();
  for (const a of attempts) {
    if (a.status === 'IN_PROGRESS') continue;
    const key = String(a.exam);
    const cur = bestByExam.get(key);
    if (!cur || a.percentage > cur.percentage) bestByExam.set(key, a);
  }

  return ok(
    res,
    exams.map((e) => {
      const best = bestByExam.get(String(e._id));
      const used = attempts.filter(
        (a) => String(a.exam) === String(e._id) && a.status !== 'IN_PROGRESS'
      ).length;
      return {
        _id: e._id,
        title: e.title,
        description: e.description,
        module: e.module,
        questionCount: e.questions.length,
        totalPoints: e.totalPoints,
        passingGrade: e.passingGrade,
        timeLimit: e.timeLimit,
        attemptsAllowed: e.attemptsAllowed,
        availableFrom: e.availableFrom,
        availableTo: e.availableTo,
        availability: e.availabilityState(),
        taken: Boolean(best),
        attemptsUsed: used,
        canAttempt: used < e.attemptsAllowed && e.availabilityState() === 'OPEN',
        score: best && e.showResultsImmediately ? best.percentage : null,
        passed: best && e.showResultsImmediately ? best.passed : null,
        inProgressAttemptId:
          attempts.find((a) => String(a.exam) === String(e._id) && a.status === 'IN_PROGRESS')
            ?._id?.toString() || null,
      };
    })
  );
});

/** GET /api/exams/:id */
const getExam = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { _id: req.params.id, isDeleted: false };
  if (!staff) filter.isPublished = true;

  const exam = await Exam.findOne(filter).populate('module', 'title');
  if (!exam) throw ApiError.notFound('Exam not found');

  await accessService.assertModuleAccess(req.user, exam.module?._id || exam.module);

  if (staff) return ok(res, exam);

  const attempts = await ExamAttempt.find({ student: req.user._id, exam: exam._id })
    .sort({ attemptNumber: 1 })
    .lean();
  const used = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  const best = used.reduce((acc, a) => (!acc || a.percentage > acc.percentage ? a : acc), null);

  return ok(res, {
    _id: exam._id,
    title: exam.title,
    description: exam.description,
    module: exam.module,
    questionCount: exam.questions.length,
    totalPoints: exam.totalPoints,
    passingGrade: exam.passingGrade,
    timeLimit: exam.timeLimit,
    attemptsAllowed: exam.attemptsAllowed,
    availableFrom: exam.availableFrom,
    availableTo: exam.availableTo,
    availability: exam.availabilityState(),
    attemptsUsed: used.length,
    canAttempt: used.length < exam.attemptsAllowed && exam.availabilityState() === 'OPEN',
    showResults: exam.showResultsImmediately,
    bestScore: best && exam.showResultsImmediately ? best.percentage : null,
    attempts: used.map((a) => ({
      _id: a._id,
      attemptNumber: a.attemptNumber,
      submittedAt: a.submittedAt,
      percentage: exam.showResultsImmediately ? a.percentage : null,
      passed: exam.showResultsImmediately ? a.passed : null,
    })),
    inProgressAttemptId: attempts.find((a) => a.status === 'IN_PROGRESS')?._id?.toString() || null,
  });
});

/** PUT /api/exams/:id */
const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, isDeleted: false });
  if (!exam) throw ApiError.notFound('Exam not found');

  const wasPublished = exam.isPublished;
  Object.assign(exam, req.body);
  await exam.save();

  if (!wasPublished && exam.isPublished) {
    const module = await Module.findById(exam.module);
    if (module) await announceExam(exam, module);
  }

  return ok(res, exam, 'Exam updated');
});

/** PATCH /api/exams/:id/publish */
const togglePublish = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, isDeleted: false });
  if (!exam) throw ApiError.notFound('Exam not found');

  exam.isPublished = !exam.isPublished;
  await exam.save();

  if (exam.isPublished) {
    const module = await Module.findById(exam.module);
    if (module) await announceExam(exam, module);
  }

  return ok(res, exam, exam.isPublished ? 'Exam published' : 'Exam unpublished');
});

/** DELETE /api/exams/:id */
const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, isDeleted: false });
  if (!exam) throw ApiError.notFound('Exam not found');

  exam.isDeleted = true;
  exam.isPublished = false;
  await exam.save();

  return ok(res, null, 'Exam deleted');
});

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildStudentPayload(exam, attempt) {
  const sanitized = gradingService.sanitizeForStudent(exam);
  return {
    attemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt || null,
    exam: {
      _id: exam._id,
      title: exam.title,
      description: exam.description,
      timeLimit: exam.timeLimit,
      passingGrade: exam.passingGrade,
      totalPoints: exam.questions.reduce((s, q) => s + (q.points || 0), 0),
      questions: exam.shuffleQuestions ? shuffle(sanitized.questions) : sanitized.questions,
    },
  };
}

/** POST /api/exams/:id/start */
const startExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, isDeleted: false, isPublished: true });
  if (!exam) throw ApiError.notFound('Exam not found');

  await accessService.assertModuleAccess(req.user, exam.module);

  const availability = exam.availabilityState();
  if (availability === 'UPCOMING') throw ApiError.forbidden('This exam has not opened yet');
  if (availability === 'CLOSED') throw ApiError.forbidden('This exam is closed');

  const attempts = await ExamAttempt.find({ student: req.user._id, exam: exam._id }).sort({
    attemptNumber: 1,
  });

  const open = attempts.find((a) => a.status === 'IN_PROGRESS');
  if (open) {
    if (!open.expiresAt || open.expiresAt > new Date()) {
      return ok(res, buildStudentPayload(exam, open), 'Resuming your attempt');
    }
    const graded = gradingService.gradeSubmission(exam, open.answers);
    Object.assign(open, graded, { status: 'EXPIRED', submittedAt: new Date() });
    await open.save();
  }

  const used = attempts.filter((a) => a.status !== 'IN_PROGRESS');
  if (used.length >= exam.attemptsAllowed) {
    throw ApiError.forbidden('You have used all of your attempts for this exam');
  }

  const attempt = await ExamAttempt.create({
    exam: exam._id,
    module: exam.module,
    student: req.user._id,
    attemptNumber: attempts.length + 1,
    totalPoints: exam.questions.reduce((s, q) => s + (q.points || 0), 0),
    startedAt: new Date(),
    expiresAt: exam.timeLimit ? new Date(Date.now() + exam.timeLimit * 60000) : undefined,
  });

  await activityService.logActivity({
    studentId: req.user._id,
    activityType: ACTIVITY_TYPES.EXAM_STARTED,
    moduleId: exam.module,
    contentId: exam._id,
    contentType: 'EXAM',
    metadata: { attemptNumber: attempt.attemptNumber, title: exam.title },
  });

  return created(res, buildStudentPayload(exam, attempt), 'Exam started');
});

/** POST /api/exam-attempts/:attemptId/submit */
const submitExam = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({
    _id: req.params.attemptId,
    student: req.user._id,
  });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (attempt.status !== 'IN_PROGRESS') throw ApiError.badRequest('This attempt is already closed');

  const exam = await Exam.findById(attempt.exam);
  if (!exam) throw ApiError.notFound('Exam not found');

  const timedOut = attempt.expiresAt && attempt.expiresAt.getTime() + 5000 < Date.now();

  const graded = gradingService.gradeSubmission(exam, req.body.answers || []);
  attempt.answers = graded.answers;
  attempt.score = graded.score;
  attempt.totalPoints = graded.totalPoints;
  attempt.percentage = graded.percentage;
  attempt.passed = graded.passed;
  attempt.status = timedOut ? 'EXPIRED' : 'SUBMITTED';
  attempt.submittedAt = new Date();
  await attempt.save();

  await activityService.logActivity({
    studentId: req.user._id,
    activityType: ACTIVITY_TYPES.EXAM_COMPLETED,
    moduleId: exam.module,
    contentId: exam._id,
    contentType: 'EXAM',
    metadata: { score: graded.percentage, passed: graded.passed },
  });

  await notificationService.notifyTeacher(
    {
      type: NOTIFICATION_TYPES.EXAM_COMPLETED,
      title: 'Exam completed',
      message: `${req.user.name} scored ${graded.percentage}% on "${exam.title}".`,
      link: `/teacher/exams/${exam._id}/results`,
      meta: { examId: String(exam._id), studentId: String(req.user._id) },
    },
    EVENTS.EXAM_COMPLETED,
    {
      examId: String(exam._id),
      studentId: String(req.user._id),
      studentName: req.user.name,
      percentage: graded.percentage,
    }
  );

  const showResults = exam.showResultsImmediately;
  return ok(
    res,
    {
      submitted: true,
      timedOut,
      showResults,
      result: showResults
        ? {
            score: graded.score,
            totalPoints: graded.totalPoints,
            percentage: graded.percentage,
            passed: graded.passed,
            passingGrade: exam.passingGrade,
            review: exam.showCorrectAnswers ? gradingService.buildReview(exam, attempt) : null,
          }
        : null,
    },
    showResults ? 'Exam submitted' : 'Exam submitted. Your teacher will publish the result.'
  );
});

/** GET /api/exams/:id/results - who took it, who did not, and the scores. */
const examResults = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const exam = await Exam.findOne({ _id: req.params.id, isDeleted: false })
    .populate('module', 'title')
    .lean();
  if (!exam) throw ApiError.notFound('Exam not found');

  const studentFilter = {
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  };

  const [students, total] = await Promise.all([
    User.find(studentFilter).select('name email avatarUrl').sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(studentFilter),
  ]);

  const attempts = await ExamAttempt.find({
    exam: exam._id,
    student: { $in: students.map((s) => s._id) },
    status: { $ne: 'IN_PROGRESS' },
  }).lean();

  const byStudent = new Map();
  for (const a of attempts) {
    const key = String(a.student);
    const cur = byStudent.get(key);
    if (!cur || a.percentage > cur.percentage) byStudent.set(key, a);
  }

  const rows = students.map((s) => {
    const a = byStudent.get(String(s._id));
    return {
      student: s,
      taken: Boolean(a),
      score: a ? a.score : null,
      percentage: a ? a.percentage : null,
      passed: a ? a.passed : false,
      submittedAt: a ? a.submittedAt : null,
    };
  });

  const stats = await analyticsService.getAssessmentAnalytics({ examId: exam._id });

  return paginated(
    res,
    rows,
    { page, limit, total },
    { exam: { ...exam, questions: undefined, questionCount: exam.questions.length }, stats }
  );
});

module.exports = {
  createExam,
  listExams,
  getExam,
  updateExam,
  togglePublish,
  deleteExam,
  startExam,
  submitExam,
  examResults,
};
