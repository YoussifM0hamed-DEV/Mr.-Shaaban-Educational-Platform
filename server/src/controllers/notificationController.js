const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { emitToUser, EVENTS } = require('../sockets');

/** GET /api/notifications */
const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.read = false;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  return paginated(res, items, { page, limit, total }, { unread });
});

/** GET /api/notifications/unread-count */
const unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  return ok(res, { unread });
});

/** PATCH /api/notifications/:id/read */
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw ApiError.notFound('Notification not found');

  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  emitToUser(req.user._id, EVENTS.NOTIFICATION_COUNT, { unread });

  return ok(res, notification);
});

/** PATCH /api/notifications/read-all */
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  emitToUser(req.user._id, EVENTS.NOTIFICATION_COUNT, { unread: 0 });
  return ok(res, { unread: 0 }, 'All notifications marked as read');
});

/** DELETE /api/notifications/:id */
const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!deleted) throw ApiError.notFound('Notification not found');
  return ok(res, null, 'Notification removed');
});

module.exports = {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteNotification,
};
