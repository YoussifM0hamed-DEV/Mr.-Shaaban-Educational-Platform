const express = require('express');
const controller = require('../controllers/lessonController');
const videoController = require('../controllers/videoController');
const materialController = require('../controllers/materialController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { materialUpload, handleUploadError } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const { PERMISSIONS, ROLES } = require('../config/constants');
const {
  createLessonSchema,
  updateLessonSchema,
  reorderSchema,
  attachVideoSchema,
} = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

router.get('/', controller.listLessons);

router.patch(
  '/reorder',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validate({ body: reorderSchema }),
  controller.reorderLessons
);

router.get('/:id', validateObjectId(), controller.getLesson);

router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validate({ body: createLessonSchema }),
  controller.createLesson
);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: updateLessonSchema }),
  controller.updateLesson
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
  controller.deleteLesson
);

// ---------- Nested video ----------
// Videos are linked, not uploaded, so this takes JSON rather than multipart.
router.post(
  '/:lessonId/video',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_VIDEOS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId('lessonId'),
  validate({ body: attachVideoSchema }),
  videoController.attachVideo
);

// ---------- Nested materials ----------
router.get('/:lessonId/materials', validateObjectId('lessonId'), materialController.listMaterials);

router.post(
  '/:lessonId/materials',
  requireStaff,
  requirePermission(PERMISSIONS.UPLOAD_MATERIALS, PERMISSIONS.MANAGE_CONTENT),
  uploadLimiter,
  validateObjectId('lessonId'),
  materialUpload.array('files', 5),
  handleUploadError,
  materialController.uploadMaterials
);

module.exports = router;
