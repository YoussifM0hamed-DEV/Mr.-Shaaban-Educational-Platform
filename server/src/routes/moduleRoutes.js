const express = require('express');
const controller = require('../controllers/moduleController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS, ROLES } = require('../config/constants');
const {
  createModuleSchema,
  updateModuleSchema,
  reorderSchema,
} = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);

// Students must be approved before any curriculum endpoint answers them.
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

router.get('/', controller.listModules);

router.patch(
  '/reorder',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validate({ body: reorderSchema }),
  controller.reorderModules
);

router.get('/:id', validateObjectId(), controller.getModule);

router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validate({ body: createModuleSchema }),
  controller.createModule
);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: updateModuleSchema }),
  controller.updateModule
);

router.patch(
  '/:id/publish',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.togglePublish
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteModule
);

module.exports = router;
