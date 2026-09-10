const StudentActivity = require('../models/StudentActivity');
const User = require('../models/User');
const logger = require('../utils/logger');
const { emitToStaff, EVENTS } = require('../sockets');

/**
 * Records one educational event.
 * Timestamps are always server-side; the client can only say WHAT happened, not when.
 * Failures are swallowed so tracking can never break a learning action.
 */
async function logActivity({
  studentId,
  activityType,
  moduleId = null,
  lessonId = null,
  contentId = null,
  contentType = null,
  metadata = {},
  touchUser = true,
}) {
  try {
    const activity = await StudentActivity.create({
      student: studentId,
      activityType,
      module: moduleId,
      lesson: lessonId,
      contentId,
      contentType,
      metadata,
    });

    if (touchUser) {
      await User.updateOne({ _id: studentId }, { $set: { lastActivityAt: new Date() } });
    }

    emitToStaff(EVENTS.ACTIVITY, {
      studentId: String(studentId),
      activityType,
      lessonId: lessonId ? String(lessonId) : null,
      moduleId: moduleId ? String(moduleId) : null,
      at: activity.createdAt,
    });

    return activity;
  } catch (err) {
    logger.error('Failed to record activity:', err.message);
    return null;
  }
}

/**
 * Same as logActivity but collapses repeats inside a time window.
 * Used for VIDEO_PROGRESS and LESSON_OPENED so the log stays readable.
 */
async function logThrottled(params, windowMinutes = 5) {
  try {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const existing = await StudentActivity.findOne({
      student: params.studentId,
      activityType: params.activityType,
      contentId: params.contentId ?? null,
      createdAt: { $gte: since },
    }).select('_id');

    if (existing) {
      await User.updateOne({ _id: params.studentId }, { $set: { lastActivityAt: new Date() } });
      return existing;
    }
    return logActivity(params);
  } catch (err) {
    logger.error('Failed to record throttled activity:', err.message);
    return null;
  }
}

module.exports = { logActivity, logThrottled };
