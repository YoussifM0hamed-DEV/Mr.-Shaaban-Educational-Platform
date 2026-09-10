const express = require('express');
const controller = require('../controllers/examController');
const {
  authenticate,
  requireStaff,
  requireApprovedStudent,
  authorize,
} = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS, ROLES } = require('../config/constants');
const {
  createExamSchema,
  updateExamSchema,
  submitAttemptSchema,
} = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

router.get('/', controller.listExams);

// ---------- Student ----------
router.post('/:id/start', authorize(ROLES.STUDENT), validateObjectId(), controller.startExam);

// ---------- Staff ----------
router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_EXAMS, PERMISSIONS.MANAGE_CONTENT),
  validate({ body: createExamSchema }),
  controller.createExam
);

router.get(
  '/:id/results',
  requireStaff,
  requirePermission(PERMISSIONS.REVIEW_RESULTS, PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  controller.examResults
);

router.get('/:id', validateObjectId(), controller.getExam);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_EXAMS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: updateExamSchema }),
  controller.updateExam
);

router.patch(
  '/:id/publish',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_EXAMS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.togglePublish
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_EXAMS, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteExam
);

module.exports = router;

// ---------- Attempt submission (mounted separately at /api/exam-attempts) ----------
const attemptRouter = express.Router();
attemptRouter.use(authenticate, requireApprovedStudent, authorize(ROLES.STUDENT));
attemptRouter.post(
  '/:attemptId/submit',
  validateObjectId('attemptId'),
  validate({ body: submitAttemptSchema }),
  controller.submitExam
);

module.exports.attemptRouter = attemptRouter;
