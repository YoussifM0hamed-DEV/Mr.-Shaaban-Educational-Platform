const { Module, Lesson, Video, Material, Quiz, Exam } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { ROLES, ACTIVITY_TYPES } = require('../config/constants');
const activityService = require('../services/activityService');
const progressService = require('../services/progressService');
const accessService = require('../services/accessService');

const isStaff = (user) => user.role === ROLES.TEACHER || user.role === ROLES.ASSISTANT;

/**
 * GET /api/modules
 * Staff see everything. Students only ever see published modules,
 * enriched with their own progress.
 */
const listModules = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { isDeleted: false };
  if (!staff) {
    filter.isPublished = true;
    // A student only ever sees modules open to everyone or to one of their groups.
    Object.assign(filter, await accessService.moduleAccessFilter(req.user._id));
  }

  const modules = await Module.find(filter)
    .populate('groups', 'name color')
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const moduleIds = modules.map((m) => m._id);

  const lessonFilter = { module: { $in: moduleIds }, isDeleted: false };
  if (!staff) lessonFilter.isPublished = true;

  const lessons = await Lesson.find(lessonFilter).select('module isPublished').lean();
  const counts = new Map();
  for (const l of lessons) {
    const k = String(l.module);
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  let progressByModule = new Map();
  if (!staff) {
    const progress = await progressService.getStudentProgress(req.user._id);
    progressByModule = new Map(progress.modules.map((m) => [m.moduleId, m]));
  }

  const payload = modules.map((m) => {
    const p = progressByModule.get(String(m._id));
    return {
      ...m,
      lessonCount: counts.get(String(m._id)) || 0,
      progress: p ? p.percentage : undefined,
      completedLessons: p ? p.lessons.filter((l) => l.completed).length : undefined,
    };
  });

  return ok(res, payload);
});

/** GET /api/modules/:id - module with its lessons. */
const getModule = asyncHandler(async (req, res) => {
  const staff = isStaff(req.user);
  const filter = { _id: req.params.id, isDeleted: false };
  if (!staff) {
    filter.isPublished = true;
    Object.assign(filter, await accessService.moduleAccessFilter(req.user._id));
  }

  const module = await Module.findOne(filter).populate('groups', 'name color').lean();
  // Same answer for "does not exist" and "not yours", so the curriculum of
  // another group cannot be probed.
  if (!module) throw ApiError.notFound('Module not found');

  const lessonFilter = { module: module._id, isDeleted: false };
  if (!staff) lessonFilter.isPublished = true;

  const lessons = await Lesson.find(lessonFilter).sort({ order: 1, createdAt: 1 }).lean();
  const lessonIds = lessons.map((l) => l._id);

  const [videos, materials, quizzes, exam] = await Promise.all([
    Video.find({ lesson: { $in: lessonIds } }).select('lesson title duration').lean(),
    Material.find({ lesson: { $in: lessonIds } }).select('lesson fileName fileType').lean(),
    Quiz.find({
      lesson: { $in: lessonIds },
      isDeleted: false,
      ...(staff ? {} : { isPublished: true }),
    })
      .select('lesson title questions isPublished')
      .lean(),
    Exam.findOne({ module: module._id, isDeleted: false, ...(staff ? {} : { isPublished: true }) })
      .select('title questions isPublished availableFrom availableTo passingGrade timeLimit')
      .lean(),
  ]);

  const videoMap = new Map(videos.map((v) => [String(v.lesson), v]));
  const quizMap = new Map(quizzes.map((q) => [String(q.lesson), q]));
  const materialMap = new Map();
  for (const m of materials) {
    const k = String(m.lesson);
    materialMap.set(k, (materialMap.get(k) || 0) + 1);
  }

  let lessonProgress = new Map();
  if (!staff) {
    const progress = await progressService.getStudentProgress(req.user._id);
    const mod = progress.modules.find((m) => m.moduleId === String(module._id));
    if (mod) lessonProgress = new Map(mod.lessons.map((l) => [l.lessonId, l]));

    activityService.logThrottled(
      {
        studentId: req.user._id,
        activityType: ACTIVITY_TYPES.MODULE_OPENED,
        moduleId: module._id,
        contentId: module._id,
        contentType: 'MODULE',
      },
      30
    );
  }

  const shapedLessons = lessons.map((l) => {
    const video = videoMap.get(String(l._id));
    const quiz = quizMap.get(String(l._id));
    return {
      ...l,
      hasVideo: Boolean(video),
      videoDuration: video ? video.duration : 0,
      materialCount: materialMap.get(String(l._id)) || 0,
      hasQuiz: Boolean(quiz),
      quizQuestionCount: quiz ? quiz.questions.length : 0,
      progress: lessonProgress.get(String(l._id)) || undefined,
    };
  });

  return ok(res, {
    module,
    lessons: shapedLessons,
    exam: exam
      ? {
          _id: exam._id,
          title: exam.title,
          questionCount: exam.questions.length,
          isPublished: exam.isPublished,
          availableFrom: exam.availableFrom,
          availableTo: exam.availableTo,
          passingGrade: exam.passingGrade,
          timeLimit: exam.timeLimit,
        }
      : null,
  });
});

/** POST /api/modules */
const createModule = asyncHandler(async (req, res) => {
  const last = await Module.findOne({ isDeleted: false }).sort({ order: -1 }).select('order');
  const module = await Module.create({
    ...req.body,
    order: req.body.order ?? (last ? last.order + 1 : 0),
    createdBy: req.user._id,
  });
  return created(res, module, 'Module created');
});

/** PUT /api/modules/:id */
const updateModule = asyncHandler(async (req, res) => {
  const module = await Module.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!module) throw ApiError.notFound('Module not found');
  return ok(res, module, 'Module updated');
});

/** PATCH /api/modules/:id/publish */
const togglePublish = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ _id: req.params.id, isDeleted: false });
  if (!module) throw ApiError.notFound('Module not found');

  module.isPublished = !module.isPublished;
  await module.save();

  return ok(res, module, module.isPublished ? 'Module published' : 'Module unpublished');
});

/** PATCH /api/modules/reorder */
const reorderModules = asyncHandler(async (req, res) => {
  const ops = req.body.items.map((item) => ({
    updateOne: { filter: { _id: item.id, isDeleted: false }, update: { $set: { order: item.order } } },
  }));
  await Module.bulkWrite(ops);
  return ok(res, null, 'Modules reordered');
});

/** DELETE /api/modules/:id - cascades to its lessons as a soft delete. */
const deleteModule = asyncHandler(async (req, res) => {
  const module = await Module.findOne({ _id: req.params.id, isDeleted: false });
  if (!module) throw ApiError.notFound('Module not found');

  module.isDeleted = true;
  module.isPublished = false;
  await module.save();

  await Lesson.updateMany({ module: module._id }, { $set: { isDeleted: true } });
  await Quiz.updateMany({ module: module._id }, { $set: { isDeleted: true } });
  await Exam.updateMany({ module: module._id }, { $set: { isDeleted: true } });

  return ok(res, null, 'Module deleted');
});

module.exports = {
  listModules,
  getModule,
  createModule,
  updateModule,
  togglePublish,
  reorderModules,
  deleteModule,
};
