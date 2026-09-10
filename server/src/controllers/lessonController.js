const {
  Module,
  Lesson,
  Video,
  Material,
  Quiz,
  VideoProgress,
  MaterialAccess,
  QuizAttempt,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { ROLES, ACTIVITY_TYPES, NOTIFICATION_TYPES } = require('../config/constants');
const activityService = require('../services/activityService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');
const { emitToStudents, EVENTS } = require('../sockets');

const isStaff = (user) => user.role === ROLES.TEACHER || user.role === ROLES.ASSISTANT;

/** GET /api/lessons?module=... */
const listLessons = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { isDeleted: false };
  if (!staff) filter.isPublished = true;
  if (req.query.module) filter.module = req.query.module;

  const lessons = await Lesson.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .populate('module', 'title order')
    .lean();

  return ok(res, lessons);
});

/**
 * GET /api/lessons/:id
 * Returns the lesson with its video, materials and quiz.
 * For a student it also returns their own watch/open/attempt state and logs the visit.
 */
const getLesson = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { _id: req.params.id, isDeleted: false };
  if (!staff) filter.isPublished = true;

  const lesson = await Lesson.findOne(filter).populate('module', 'title order isPublished').lean();
  if (!lesson) throw ApiError.notFound('Lesson not found');

  // A published lesson inside an unpublished module stays hidden from students.
  if (!staff && (!lesson.module || !lesson.module.isPublished)) {
    throw ApiError.notFound('Lesson not found');
  }

  // And a lesson in a module reserved for other groups stays hidden too.
  await accessService.assertModuleAccess(req.user, lesson.module._id);

  const [video, materials, quiz] = await Promise.all([
    Video.findOne({ lesson: lesson._id }).lean(),
    Material.find({ lesson: lesson._id }).sort({ createdAt: 1 }).lean(),
    Quiz.findOne({
      lesson: lesson._id,
      isDeleted: false,
      ...(staff ? {} : { isPublished: true }),
    })
      .select('-questions.correctAnswer -questions.acceptedAnswers -questions.explanation')
      .lean(),
  ]);

  const payload = {
    lesson,
    video,
    materials,
    quiz: quiz
      ? {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          questionCount: quiz.questions.length,
          passingGrade: quiz.passingGrade,
          timeLimit: quiz.timeLimit,
          attemptsAllowed: quiz.attemptsAllowed,
          isPublished: quiz.isPublished,
        }
      : null,
  };

  if (!staff) {
    const [videoProgress, accessed, attempts] = await Promise.all([
      video ? VideoProgress.findOne({ student: req.user._id, video: video._id }).lean() : null,
      MaterialAccess.find({ student: req.user._id, lesson: lesson._id }).lean(),
      quiz
        ? QuizAttempt.find({ student: req.user._id, quiz: quiz._id }).sort({ attemptNumber: 1 }).lean()
        : [],
    ]);

    const openedIds = new Set(accessed.map((a) => String(a.material)));
    const submitted = attempts.filter((a) => a.status === 'SUBMITTED');
    const best = submitted.reduce(
      (acc, a) => (!acc || a.percentage > acc.percentage ? a : acc),
      null
    );

    payload.myProgress = {
      video: videoProgress
        ? {
            lastPosition: videoProgress.lastPosition,
            percentage: videoProgress.percentage,
            completed: videoProgress.completed,
          }
        : { lastPosition: 0, percentage: 0, completed: false },
      materials: materials.map((m) => ({ materialId: String(m._id), opened: openedIds.has(String(m._id)) })),
      quiz: quiz
        ? {
            attemptsUsed: submitted.length,
            attemptsAllowed: quiz.attemptsAllowed,
            canAttempt: submitted.length < quiz.attemptsAllowed,
            bestScore: best ? best.percentage : null,
            passed: best ? best.passed : false,
            inProgressAttemptId:
              attempts.find((a) => a.status === 'IN_PROGRESS')?._id?.toString() || null,
          }
        : null,
    };

    activityService.logThrottled(
      {
        studentId: req.user._id,
        activityType: ACTIVITY_TYPES.LESSON_OPENED,
        moduleId: lesson.module._id,
        lessonId: lesson._id,
        contentId: lesson._id,
        contentType: 'LESSON',
      },
      30
    );
  }

  return ok(res, payload);
});

/** POST /api/lessons */
const createLesson = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ _id: req.body.module, isDeleted: false });
  if (!module) throw ApiError.badRequest('The selected module does not exist');

  const last = await Lesson.findOne({ module: module._id, isDeleted: false })
    .sort({ order: -1 })
    .select('order');

  const lesson = await Lesson.create({
    ...req.body,
    order: req.body.order ?? (last ? last.order + 1 : 0),
    createdBy: req.user._id,
  });

  if (lesson.isPublished && module.isPublished) await announceLesson(lesson, module);

  return created(res, lesson, 'Lesson created');
});

async function announceLesson(lesson, module) {
  await notificationService.notifyModuleStudents(module._id, {
    type: NOTIFICATION_TYPES.NEW_LESSON,
    title: 'New lesson available',
    message: `"${lesson.title}" was added to ${module.title}.`,
    link: `/student/lessons/${lesson._id}`,
    action: { label: 'OPEN LESSON', url: `/student/lessons/${lesson._id}` },
    meta: { lessonId: String(lesson._id), moduleId: String(module._id) },
  });
  emitToStudents(EVENTS.CONTENT_UPDATED, { type: 'LESSON', lessonId: String(lesson._id) });
}

/** PUT /api/lessons/:id */
const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const wasPublished = lesson.isPublished;
  Object.assign(lesson, req.body);
  await lesson.save();

  if (!wasPublished && lesson.isPublished) {
    const module = await Module.findById(lesson.module);
    if (module && module.isPublished) await announceLesson(lesson, module);
  }

  return ok(res, lesson, 'Lesson updated');
});

/** PATCH /api/lessons/:id/publish */
const togglePublish = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) throw ApiError.notFound('Lesson not found');

  lesson.isPublished = !lesson.isPublished;
  await lesson.save();

  if (lesson.isPublished) {
    const module = await Module.findById(lesson.module);
    if (module && module.isPublished) await announceLesson(lesson, module);
  }

  return ok(res, lesson, lesson.isPublished ? 'Lesson published' : 'Lesson unpublished');
});

/** PATCH /api/lessons/reorder */
const reorderLessons = asyncHandler(async (req, res) => {
  const ops = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id, isDeleted: false },
      update: { $set: { order: item.order } },
    },
  }));
  await Lesson.bulkWrite(ops);
  return ok(res, null, 'Lessons reordered');
});

/** DELETE /api/lessons/:id */
const deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findOne({ _id: req.params.id, isDeleted: false });
  if (!lesson) throw ApiError.notFound('Lesson not found');

  lesson.isDeleted = true;
  lesson.isPublished = false;
  await lesson.save();

  await Quiz.updateMany({ lesson: lesson._id }, { $set: { isDeleted: true } });

  return ok(res, null, 'Lesson deleted');
});

module.exports = {
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  togglePublish,
  reorderLessons,
  deleteLesson,
};
