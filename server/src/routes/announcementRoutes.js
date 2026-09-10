const express = require('express');
const controller = require('../controllers/announcementController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS, ROLES } = require('../config/constants');
const { announcementSchema } = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

router.get('/', controller.listAnnouncements);

router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS),
  validate({ body: announcementSchema }),
  controller.createAnnouncement
);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS),
  validateObjectId(),
  validate({ body: announcementSchema.partial() }),
  controller.updateAnnouncement
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS),
  validateObjectId(),
  controller.deleteAnnouncement
);

module.exports = router;
