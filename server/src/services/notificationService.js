const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');
const { emitToUser, emitToTeacher, EVENTS } = require('../sockets');

async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, read: false });
}

/** Creates one notification and pushes it over Socket.IO if the user is connected. */
async function notifyUser(userId, payload) {
  try {
    const notification = await Notification.create({ user: userId, ...payload });
    emitToUser(userId, EVENTS.NOTIFICATION, notification.toJSON());
    emitToUser(userId, EVENTS.NOTIFICATION_COUNT, { unread: await unreadCount(userId) });
    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err.message);
    return null;
  }
}

/** Fan-out to many users with a single bulk insert. */
async function notifyUsers(userIds = [], payload) {
  const ids = [...new Set(userIds.map(String))].filter(Boolean);
  if (!ids.length) return [];

  try {
    const docs = await Notification.insertMany(
      ids.map((id) => ({ user: id, ...payload })),
      { ordered: false }
    );

    for (const doc of docs) {
      emitToUser(doc.user, EVENTS.NOTIFICATION, doc.toJSON());
      emitToUser(doc.user, EVENTS.NOTIFICATION_COUNT, { unread: await unreadCount(doc.user) });
    }
    return docs;
  } catch (err) {
    logger.error('Failed to create notifications:', err.message);
    return [];
  }
}

/** Every approved student - the audience for new content and announcements. */
async function approvedStudentIds() {
  const students = await User.find({
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  }).select('_id');
  return students.map((s) => s._id);
}

/**
 * Notifies only the students whose groups can open this module, so a Grade 2
 * student is never told about a Grade 3 lesson.
 */
async function notifyModuleStudents(moduleId, payload) {
  // Required lazily: accessService also reads notifications indirectly.
  const accessService = require('./accessService');
  const ids = await accessService.studentsToNotifyForModule(moduleId);
  return notifyUsers(ids, payload);
}

async function notifyAllStudents(payload) {
  const ids = await approvedStudentIds();
  return notifyUsers(ids, payload);
}

/** Teacher plus every enabled assistant. */
async function staffIds() {
  const staff = await User.find({
    role: { $in: [ROLES.TEACHER, ROLES.ASSISTANT] },
    isDeleted: false,
    status: { $ne: ACCOUNT_STATUS.DISABLED },
  }).select('_id role');
  return staff.map((s) => s._id);
}

async function notifyTeacher(payload, socketEvent = null, socketPayload = null) {
  const teacher = await User.findOne({ role: ROLES.TEACHER, isDeleted: false }).select('_id');
  if (!teacher) return null;
  const notification = await notifyUser(teacher._id, payload);
  if (socketEvent) emitToTeacher(socketEvent, socketPayload || payload);
  return notification;
}

module.exports = {
  notifyUser,
  notifyUsers,
  notifyAllStudents,
  notifyModuleStudents,
  notifyTeacher,
  approvedStudentIds,
  staffIds,
  unreadCount,
};
