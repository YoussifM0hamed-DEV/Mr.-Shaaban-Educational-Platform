const { Lesson, Video, VideoProgress, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const env = require('../config/env');
const { detectVideoSource, UNSUPPORTED_SOURCE_MESSAGE } = require('../utils/videoSource');
const {
  ROLES,
  ACCOUNT_STATUS,
  ACTIVITY_TYPES,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const activityService = require('../services/activityService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');

async function announceVideo(lesson, video) {
  if (!lesson.isPublished) return;
  await notificationService.notifyModuleStudents(lesson.module, {
    type: NOTIFICATION_TYPES.NEW_VIDEO,
    title: 'New video available',
    message: `A video was added to "${lesson.title}".`,
    link: `/student/lessons/${lesson._id}`,
    action: { label: 'WATCH', url: `/student/lessons/${lesson._id}` },
    meta: { lessonId: String(lesson._id), videoId: String(video._id) },
  });
}

/**
 * POST /api/lessons/:lessonId/video
 * Attaches a video by link. The platform stores no video files of its own.
 */
const attachVideo = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findOne({ _id: req.params.lessonId, isDeleted: false });
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const source = detectVideoSource(req.body.videoUrl);
  if (!source) throw ApiError.badRequest(UNSUPPORTED_SOURCE_MESSAGE);

  // A lesson holds one video, so replacing it clears the old watch records too.
  const previous = await Video.findOne({ lesson: lesson._id });
  if (previous) {
    await previous.deleteOne();
    await VideoProgress.deleteMany({ video: previous._id });
  }

  const video = await Video.create({
    lesson: lesson._id,
    module: lesson.module,
    title: req.body.title,
    videoUrl: req.body.videoUrl,
    provider: source.provider,
    externalId: source.externalId,
    thumbnailUrl: req.body.thumbnailUrl || '',
    duration: req.body.duration || 0,
    addedBy: req.user._id,
  });

  await announceVideo(lesson, video);
  return created(res, video, previous ? 'Video replaced' : 'Video added');
});

/** PATCH /api/videos/:id - edit the title, the link or a corrected duration. */
const updateVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');

  if (req.body.videoUrl !== undefined && req.body.videoUrl !== video.videoUrl) {
    const source = detectVideoSource(req.body.videoUrl);
    if (!source) throw ApiError.badRequest(UNSUPPORTED_SOURCE_MESSAGE);

    video.videoUrl = req.body.videoUrl;
    video.provider = source.provider;
    video.externalId = source.externalId;

    // A different video means the recorded progress no longer describes it.
    await VideoProgress.deleteMany({ video: video._id });
  }

  if (req.body.title !== undefined) video.title = req.body.title;
  if (req.body.duration !== undefined) video.duration = req.body.duration;
  await video.save();

  return ok(res, video, 'Video updated');
});

/** DELETE /api/videos/:id */
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');

  await VideoProgress.deleteMany({ video: video._id });
  await video.deleteOne();

  return ok(res, null, 'Video removed');
});

/** Guards student access: approved, and the lesson and module must be published. */
async function assertStudentCanWatch(user, video) {
  if (user.role !== ROLES.STUDENT) return;
  if (user.status !== ACCOUNT_STATUS.APPROVED) {
    throw ApiError.forbidden('Your account is not approved');
  }

  const lesson = await Lesson.findOne({ _id: video.lesson, isDeleted: false, isPublished: true })
    .populate('module', 'isPublished isDeleted')
    .lean();

  if (!lesson || !lesson.module || !lesson.module.isPublished || lesson.module.isDeleted) {
    throw ApiError.notFound('Video not available');
  }

  await accessService.assertModuleAccess(user, lesson.module._id);
}

/**
 * POST /api/videos/:id/start
 * Marks that playback actually began. Opening the page alone does not call this.
 */
const startVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');
  await assertStudentCanWatch(req.user, video);

  const existing = await VideoProgress.findOne({ student: req.user._id, video: video._id });

  if (!existing) {
    await VideoProgress.create({
      student: req.user._id,
      video: video._id,
      lesson: video.lesson,
      module: video.module,
      duration: video.duration,
      startedAt: new Date(),
      lastWatchedAt: new Date(),
    });

    await activityService.logActivity({
      studentId: req.user._id,
      activityType: ACTIVITY_TYPES.VIDEO_STARTED,
      moduleId: video.module,
      lessonId: video.lesson,
      contentId: video._id,
      contentType: 'VIDEO',
    });
  }

  const progress = await VideoProgress.findOne({ student: req.user._id, video: video._id }).lean();
  return ok(res, progress, 'Playback started');
});

/**
 * PATCH /api/videos/:id/progress
 * The player sends the current position plus how many NEW seconds were watched
 * since the last ping. Counting the delta means seeking to the end cannot
 * complete a video the student never watched. This is identical for a YouTube
 * embed and a direct file, because both report a real playback position.
 */
const updateProgress = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');
  await assertStudentCanWatch(req.user, video);

  const { position, watchedDelta = 0, duration } = req.body;

  let progress = await VideoProgress.findOne({ student: req.user._id, video: video._id });
  if (!progress) {
    progress = await VideoProgress.create({
      student: req.user._id,
      video: video._id,
      lesson: video.lesson,
      module: video.module,
      duration: duration || video.duration,
    });
    await activityService.logActivity({
      studentId: req.user._id,
      activityType: ACTIVITY_TYPES.VIDEO_STARTED,
      moduleId: video.module,
      lessonId: video.lesson,
      contentId: video._id,
      contentType: 'VIDEO',
    });
  }

  // Trust the longest duration seen: the stored one, the record, or the player.
  const effectiveDuration = Math.max(progress.duration || 0, video.duration || 0, duration || 0);
  progress.duration = effectiveDuration;

  progress.watchedSeconds = Math.min(
    effectiveDuration || Number.MAX_SAFE_INTEGER,
    (progress.watchedSeconds || 0) + Math.max(0, watchedDelta)
  );
  progress.lastPosition = Math.max(0, Math.min(position, effectiveDuration || position));
  progress.lastWatchedAt = new Date();

  progress.percentage = effectiveDuration
    ? Math.min(100, Math.round((progress.watchedSeconds / effectiveDuration) * 100))
    : 0;

  const justCompleted = !progress.completed && progress.percentage >= env.VIDEO_COMPLETION_THRESHOLD;

  if (justCompleted) {
    progress.completed = true;
    progress.completedAt = new Date();
  }

  await progress.save();

  // The player usually learns the real duration only after it loads, so keep the
  // lesson record in step once we have a trustworthy value.
  if (duration && !video.duration) {
    video.duration = Math.round(duration);
    await video.save();
  }

  if (justCompleted) {
    await activityService.logActivity({
      studentId: req.user._id,
      activityType: ACTIVITY_TYPES.VIDEO_COMPLETED,
      moduleId: video.module,
      lessonId: video.lesson,
      contentId: video._id,
      contentType: 'VIDEO',
      metadata: { percentage: progress.percentage },
    });
  } else {
    // Collapsed to one log entry every 5 minutes so the timeline stays readable.
    activityService.logThrottled(
      {
        studentId: req.user._id,
        activityType: ACTIVITY_TYPES.VIDEO_PROGRESS,
        moduleId: video.module,
        lessonId: video.lesson,
        contentId: video._id,
        contentType: 'VIDEO',
        metadata: { percentage: progress.percentage },
      },
      5
    );
  }

  return ok(res, {
    lastPosition: progress.lastPosition,
    watchedSeconds: progress.watchedSeconds,
    percentage: progress.percentage,
    completed: progress.completed,
  });
});

/** GET /api/videos/:id/progress - used by the player to resume. */
const getMyProgress = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');

  const progress = await VideoProgress.findOne({ student: req.user._id, video: video._id }).lean();
  return ok(
    res,
    progress || { lastPosition: 0, percentage: 0, completed: false, watchedSeconds: 0 }
  );
});

/** GET /api/videos/:id/watchers - per-student watch state for the teacher. */
const listWatchers = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound('Video not found');

  const [students, progress] = await Promise.all([
    User.find({ role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false })
      .select('name email avatarUrl')
      .sort({ name: 1 })
      .lean(),
    VideoProgress.find({ video: video._id }).lean(),
  ]);

  const byStudent = new Map(progress.map((p) => [String(p.student), p]));

  const rows = students.map((s) => {
    const p = byStudent.get(String(s._id));
    return {
      student: { _id: s._id, name: s.name, email: s.email, avatarUrl: s.avatarUrl },
      percentage: p ? p.percentage : 0,
      completed: p ? p.completed : false,
      started: Boolean(p),
      lastWatchedAt: p ? p.lastWatchedAt : null,
    };
  });

  return ok(res, {
    video: { _id: video._id, title: video.title, duration: video.duration },
    watchers: rows,
    summary: {
      total: rows.length,
      started: rows.filter((r) => r.started).length,
      completed: rows.filter((r) => r.completed).length,
      averageProgress: rows.length
        ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length)
        : 0,
    },
  });
});

module.exports = {
  attachVideo,
  updateVideo,
  deleteVideo,
  startVideo,
  updateProgress,
  getMyProgress,
  listWatchers,
};
