const express = require('express');
const controller = require('../controllers/videoController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { trackingLimiter } = require('../middleware/rateLimit');
const { PERMISSIONS, ROLES } = require('../config/constants');
const { videoMetaSchema, videoProgressSchema } = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

// ---------- Watch tracking ----------
router.get('/:id/progress', validateObjectId(), controller.getMyProgress);

router.post('/:id/start', trackingLimiter, validateObjectId(), controller.startVideo);

router.patch(
  '/:id/progress',
  trackingLimiter,
  validateObjectId(),
  validate({ body: videoProgressSchema }),
  controller.updateProgress
);

// ---------- Staff ----------
router.get(
  '/:id/watchers',
  requireStaff,
  requirePermission(PERMISSIONS.VIEW_STUDENT_ACTIVITY, PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  controller.listWatchers
);

router.patch(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_VIDEOS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: videoMetaSchema }),
  controller.updateVideo
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_VIDEOS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteVideo
);

module.exports = router;
