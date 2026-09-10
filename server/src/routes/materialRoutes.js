const express = require('express');
const controller = require('../controllers/materialController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { trackingLimiter } = require('../middleware/rateLimit');
const { PERMISSIONS, ROLES } = require('../config/constants');
const { materialMetaSchema } = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

// Opening a material always records the access before the URL is returned.
router.post('/:id/open', trackingLimiter, validateObjectId(), controller.openMaterial);

router.get(
  '/:id/access',
  requireStaff,
  requirePermission(PERMISSIONS.VIEW_STUDENT_ACTIVITY, PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  controller.listMaterialAccess
);

router.patch(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_MATERIALS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: materialMetaSchema }),
  controller.updateMaterial
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_MATERIALS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteMaterial
);

module.exports = router;
