const { Lesson, Quiz, QuizAttempt, User } = require('../models');
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

/** POST /api/quizzes - one quiz per lesson. */
const createQuiz = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findOne({ _id: req.body.lesson, isDeleted: false });
  if (!lesson) throw ApiError.badRequest('The selected lesson does not exist');

  const existing = await Quiz.findOne({ lesson: lesson._id, isDeleted: false });
  if (existing) throw ApiError.conflict('This lesson already has a quiz');

  const quiz = await Quiz.create({
    ...req.body,
    module: lesson.module,
    createdBy: req.user._id,
  });

  if (quiz.isPublished && lesson.isPublished) await announceQuiz(quiz, lesson);

  return created(res, quiz, 'Quiz created');
});

async function announceQuiz(quiz, lesson) {
  await notificationService.notifyModuleStudents(quiz.module, {
    type: NOTIFICATION_TYPES.NEW_QUIZ,
    title: 'New quiz available',
    message: `"${quiz.title}" is ready in "${lesson.title}".`,
    link: `/student/quizzes/${quiz._id}`,
    action: { label: 'START QUIZ', url: `/student/quizzes/${quiz._id}` },
    meta: { quizId: String(quiz._id), lessonId: String(lesson._id) },
  });
}

/** GET /api/quizzes - staff listing with completion counts. */
const listQuizzes = asyncHandler(async (req, res) => {
  const filter = { isDeleted: false };
  if (req.query.lesson) filter.lesson = req.query.lesson;
  if (req.query.module) filter.module = req.query.module;

  const quizzes = await Quiz.find(filter)
    .populate('lesson', 'title order')
    .populate('module', 'title order')
    .sort({ createdAt: -1 })
    .lean();

  return ok(
    res,
    quizzes.map((q) => ({
      ...q,
      questionCount: q.questions.length,
      totalPoints: q.questions.reduce((s, x) => s + (x.points || 0), 0),
      questions: undefined,
    }))
  );
});

/** GET /api/quizzes/:id - staff get the full quiz including the answer key. */
const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false })
    .populate('lesson', 'title')
    .populate('module', 'title');
  if (!quiz) throw ApiError.notFound('Quiz not found');

  return ok(res, quiz);
});

/** PUT /api/quizzes/:id */
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false });
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const wasPublished = quiz.isPublished;
  Object.assign(quiz, req.body);
  await quiz.save();

  if (!wasPublished && quiz.isPublished) {
    const lesson = await Lesson.findById(quiz.lesson);
    if (lesson && lesson.isPublished) await announceQuiz(quiz, lesson);
  }

  return ok(res, quiz, 'Quiz updated');
});

/** PATCH /api/quizzes/:id/publish */
const togglePublish = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false });
  if (!quiz) throw ApiError.notFound('Quiz not found');

  quiz.isPublished = !quiz.isPublished;
  await quiz.save();

  if (quiz.isPublished) {
    const lesson = await Lesson.findById(quiz.lesson);
    if (lesson && lesson.isPublished) await announceQuiz(quiz, lesson);
  }

  return ok(res, quiz, quiz.isPublished ? 'Quiz published' : 'Quiz unpublished');
});

/** DELETE /api/quizzes/:id */
const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false });
  if (!quiz) throw ApiError.notFound('Quiz not found');

  quiz.isDeleted = true;
  quiz.isPublished = false;
  await quiz.save();

  return ok(res, null, 'Quiz deleted');
});

/** Loads a quiz a student is actually allowed to take. */
async function loadQuizForStudent(quizId, user) {
  const quiz = await Quiz.findOne({ _id: quizId, isDeleted: false, isPublished: true });
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const lesson = await Lesson.findOne({ _id: quiz.lesson, isDeleted: false, isPublished: true })
    .populate('module', 'isPublished isDeleted')
    .lean();
  if (!lesson || !lesson.module || !lesson.module.isPublished || lesson.module.isDeleted) {
    throw ApiError.notFound('Quiz not available');
  }

  await accessService.assertModuleAccess(user, lesson.module._id);

  return { quiz, lesson };
}

/**
 * POST /api/quizzes/:id/start
 * Resumes an unfinished attempt or opens a new one, and returns the questions
 * without their answer key.
 */
const startQuiz = asyncHandler(async (req, res) => {
  const { quiz, lesson } = await loadQuizForStudent(req.params.id, req.user);

  const attempts = await QuizAttempt.find({ student: req.user._id, quiz: quiz._id }).sort({
    attemptNumber: 1,
  });

  const open = attempts.find((a) => a.status === 'IN_PROGRESS');
  if (open) {
    if (open.expiresAt && open.expiresAt < new Date()) {
      await finalizeExpired(open, quiz);
    } else {
      return ok(res, buildStudentPayload(quiz, open), 'Resuming your attempt');
    }
  }

  const submitted = attempts.filter((a) => a.status === 'SUBMITTED');
  if (submitted.length >= quiz.attemptsAllowed) {
    throw ApiError.forbidden('You have used all of your attempts for this quiz');
  }

  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    lesson: quiz.lesson,
    module: quiz.module,
    student: req.user._id,
    attemptNumber: attempts.length + 1,
    totalPoints: quiz.questions.reduce((s, q) => s + (q.points || 0), 0),
    startedAt: new Date(),
    expiresAt: quiz.timeLimit ? new Date(Date.now() + quiz.timeLimit * 60000) : undefined,
  });

  await activityService.logActivity({
    studentId: req.user._id,
    activityType: ACTIVITY_TYPES.QUIZ_STARTED,
    moduleId: quiz.module,
    lessonId: quiz.lesson,
    contentId: quiz._id,
    contentType: 'QUIZ',
    metadata: { attemptNumber: attempt.attemptNumber, lesson: lesson.title },
  });

  return created(res, buildStudentPayload(quiz, attempt), 'Quiz started');
});

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildStudentPayload(quiz, attempt) {
  const sanitized = gradingService.sanitizeForStudent(quiz);
  return {
    attemptId: attempt._id,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt || null,
    quiz: {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      passingGrade: quiz.passingGrade,
      attemptsAllowed: quiz.attemptsAllowed,
      totalPoints: quiz.questions.reduce((s, q) => s + (q.points || 0), 0),
      questions: quiz.shuffleQuestions ? shuffle(sanitized.questions) : sanitized.questions,
    },
  };
}

async function finalizeExpired(attempt, quiz) {
  const graded = gradingService.gradeSubmission(quiz, attempt.answers);
  attempt.status = 'EXPIRED';
  attempt.answers = graded.answers;
  attempt.score = graded.score;
  attempt.totalPoints = graded.totalPoints;
  attempt.percentage = graded.percentage;
  attempt.passed = graded.passed;
  attempt.submittedAt = new Date();
  await attempt.save();
  return attempt;
}

/**
 * POST /api/quiz-attempts/:attemptId/submit
 * Grading happens entirely here. The client never sends or sees the key.
 */
const submitQuiz = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findOne({
    _id: req.params.attemptId,
    student: req.user._id,
  });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (attempt.status !== 'IN_PROGRESS') throw ApiError.badRequest('This attempt is already closed');

  const quiz = await Quiz.findById(attempt.quiz);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const timedOut = attempt.expiresAt && attempt.expiresAt.getTime() + 5000 < Date.now();

  const graded = gradingService.gradeSubmission(quiz, req.body.answers || []);
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
    activityType: ACTIVITY_TYPES.QUIZ_COMPLETED,
    moduleId: quiz.module,
    lessonId: quiz.lesson,
    contentId: quiz._id,
    contentType: 'QUIZ',
    metadata: { score: graded.percentage, passed: graded.passed },
  });

  await notificationService.notifyTeacher(
    {
      type: NOTIFICATION_TYPES.QUIZ_COMPLETED,
      title: 'Quiz completed',
      message: `${req.user.name} scored ${graded.percentage}% on "${quiz.title}".`,
      link: `/teacher/quizzes/${quiz._id}/results`,
      meta: { quizId: String(quiz._id), studentId: String(req.user._id) },
    },
    EVENTS.QUIZ_COMPLETED,
    {
      quizId: String(quiz._id),
      studentId: String(req.user._id),
      studentName: req.user.name,
      percentage: graded.percentage,
    }
  );

  const showResults = quiz.showResultsImmediately;
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
            passingGrade: quiz.passingGrade,
            review: quiz.showCorrectAnswers ? gradingService.buildReview(quiz, attempt) : null,
          }
        : null,
    },
    showResults ? 'Quiz submitted' : 'Quiz submitted. Your teacher will publish the result.'
  );
});

/** GET /api/quizzes/:id/my-attempts */
const myAttempts = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false });
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const attempts = await QuizAttempt.find({ student: req.user._id, quiz: quiz._id })
    .sort({ attemptNumber: 1 })
    .lean();

  return ok(res, {
    attemptsAllowed: quiz.attemptsAllowed,
    attemptsUsed: attempts.filter((a) => a.status !== 'IN_PROGRESS').length,
    showResults: quiz.showResultsImmediately,
    attempts: attempts.map((a) => ({
      _id: a._id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      score: quiz.showResultsImmediately ? a.score : null,
      percentage: quiz.showResultsImmediately ? a.percentage : null,
      passed: quiz.showResultsImmediately ? a.passed : null,
      submittedAt: a.submittedAt,
      startedAt: a.startedAt,
    })),
  });
});

/** GET /api/quizzes/:id/results - every student's standing on this quiz. */
const quizResults = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const quiz = await Quiz.findOne({ _id: req.params.id, isDeleted: false })
    .populate('lesson', 'title')
    .lean();
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const [students, total] = await Promise.all([
    User.find({ role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false })
      .select('name email avatarUrl')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments({ role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false }),
  ]);

  const attempts = await QuizAttempt.find({
    quiz: quiz._id,
    student: { $in: students.map((s) => s._id) },
    status: { $ne: 'IN_PROGRESS' },
  }).lean();

  const byStudent = new Map();
  for (const a of attempts) {
    const key = String(a.student);
    const current = byStudent.get(key);
    if (!current || a.percentage > current.percentage) byStudent.set(key, a);
  }

  const rows = students.map((s) => {
    const a = byStudent.get(String(s._id));
    return {
      student: s,
      completed: Boolean(a),
      score: a ? a.score : null,
      percentage: a ? a.percentage : null,
      passed: a ? a.passed : false,
      submittedAt: a ? a.submittedAt : null,
      attempts: attempts.filter((x) => String(x.student) === String(s._id)).length,
    };
  });

  const stats = await analyticsService.getAssessmentAnalytics({ quizId: quiz._id });

  return paginated(res, rows, { page, limit, total }, { quiz, stats });
});

module.exports = {
  createQuiz,
  listQuizzes,
  getQuiz,
  updateQuiz,
  togglePublish,
  deleteQuiz,
  startQuiz,
  submitQuiz,
  myAttempts,
  quizResults,
};
