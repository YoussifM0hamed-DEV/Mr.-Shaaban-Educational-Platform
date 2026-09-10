const express = require('express');
const controller = require('../controllers/studentController');
const analyticsController = require('../controllers/analyticsController');
const { authenticate, requireStaff, requireTeacher } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/constants');
const { paginationQuery } = require('../validators/common');
const {
  studentListQuery,
  reviewStudentSchema,
  bulkReviewSchema,
  updateStudentSchema,
  setStudentPasswordSchema,
} = require('../validators/userValidators');

const router = express.Router();

router.use(authenticate, requireStaff);

router.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_STUDENTS),
  validate({ query: studentListQuery }),
  controller.listStudents
);

router.get(
  '/pending',
  requirePermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.MANAGE_STUDENT_APPROVAL),
  validate({ query: paginationQuery }),
  controller.listPendingStudents
);

router.get(
  '/stats/summary',
  requirePermission(PERMISSIONS.VIEW_STUDENTS),
  controller.studentStats
);

router.get(
  '/options/approved',
  requirePermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.MANAGE_MEETINGS),
  controller.approvedStudentOptions
);

router.patch(
  '/bulk-review',
  requirePermission(PERMISSIONS.MANAGE_STUDENT_APPROVAL),
  validate({ body: bulkReviewSchema }),
  controller.bulkReviewStudents
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  controller.getStudentDetails
);

router.get(
  '/:id/activity',
  requirePermission(PERMISSIONS.VIEW_STUDENT_ACTIVITY, PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  validate({ query: paginationQuery }),
  controller.getStudentActivity
);

router.get(
  '/:id/progress',
  requirePermission(PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  analyticsController.studentProgress
);

router.patch(
  '/:id/review',
  requirePermission(PERMISSIONS.MANAGE_STUDENT_APPROVAL),
  validateObjectId(),
  validate({ body: reviewStudentSchema }),
  controller.reviewStudent
);

router.patch(
  '/:id/password',
  requirePermission(PERMISSIONS.MANAGE_STUDENT_APPROVAL),
  validateObjectId(),
  validate({ body: setStudentPasswordSchema }),
  controller.setStudentPassword
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.VIEW_STUDENTS),
  validateObjectId(),
  validate({ body: updateStudentSchema }),
  controller.updateStudent
);

// Removing a student record is an owner-only action.
router.delete('/:id', requireTeacher, validateObjectId(), controller.deleteStudent);

module.exports = router;
