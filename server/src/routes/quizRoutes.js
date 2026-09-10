const express = require('express');
const controller = require('../controllers/quizController');
const { authenticate, requireStaff, requireApprovedStudent, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS, ROLES } = require('../config/constants');
const {
  createQuizSchema,
  updateQuizSchema,
  submitAttemptSchema,
} = require('../validators/contentValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

// ---------- Student ----------
router.post('/:id/start', authorize(ROLES.STUDENT), validateObjectId(), controller.startQuiz);
router.get('/:id/my-attempts', authorize(ROLES.STUDENT), validateObjectId(), controller.myAttempts);

// ---------- Staff ----------
router.get('/', requireStaff, controller.listQuizzes);

router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_QUIZZES, PERMISSIONS.MANAGE_CONTENT),
  validate({ body: createQuizSchema }),
  controller.createQuiz
);

router.get(
  '/:id/results',
  requireStaff,
  requirePermission(PERMISSIONS.REVIEW_RESULTS, PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  controller.quizResults
);

router.get('/:id', requireStaff, validateObjectId(), controller.getQuiz);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_QUIZZES, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: updateQuizSchema }),
  controller.updateQuiz
);

router.patch(
  '/:id/publish',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_QUIZZES, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.togglePublish
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.CREATE_QUIZZES, PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteQuiz
);

module.exports = router;

// ---------- Attempt submission (mounted separately at /api/quiz-attempts) ----------
const attemptRouter = express.Router();
attemptRouter.use(authenticate, requireApprovedStudent, authorize(ROLES.STUDENT));
attemptRouter.post(
  '/:attemptId/submit',
  validateObjectId('attemptId'),
  validate({ body: submitAttemptSchema }),
  controller.submitQuiz
);

module.exports.attemptRouter = attemptRouter;
