const { Announcement } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { ROLES, NOTIFICATION_TYPES } = require('../config/constants');
const notificationService = require('../services/notificationService');
const accessService = require('../services/accessService');

const isStaff = (user) => user.role === ROLES.TEACHER || user.role === ROLES.ASSISTANT;

/** GET /api/announcements */
const listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = { isDeleted: false };
  if (!isStaff(req.user)) {
    filter.isPublished = true;
    // A student only sees announcements aimed at everyone or at one of their groups.
    const groupIds = await accessService.getStudentGroupIds(req.user._id);
    filter.$or = [
      { groups: { $size: 0 } },
      { groups: { $exists: false } },
      ...(groupIds.length ? [{ groups: { $in: groupIds } }] : []),
    ];
  }

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name')
      .populate('groups', 'name color')
      .lean(),
    Announcement.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total });
});

/** POST /api/announcements */
const createAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.create({ ...req.body, createdBy: req.user._id });

  if (announcement.isPublished) {
    const payload = {
      type: NOTIFICATION_TYPES.ANNOUNCEMENT,
      title: announcement.title,
      message: announcement.body.slice(0, 200),
      link: '/student/announcements',
      meta: { announcementId: String(announcement._id) },
    };

    if (announcement.groups.length) {
      const ids = await accessService.studentsInGroups(announcement.groups);
      await notificationService.notifyUsers(ids, payload);
    } else {
      await notificationService.notifyAllStudents(payload);
    }
  }

  return created(res, announcement, 'Announcement published');
});

/** PUT /api/announcements/:id */
const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return ok(res, announcement, 'Announcement updated');
});

/** DELETE /api/announcements/:id */
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { isDeleted: true, isPublished: false } },
    { new: true }
  );
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return ok(res, null, 'Announcement deleted');
});

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
