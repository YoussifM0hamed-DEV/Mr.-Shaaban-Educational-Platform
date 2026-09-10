const express = require('express');
const controller = require('../controllers/meetingController');
const { authenticate, requireStaff, requireApprovedStudent } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS, ROLES } = require('../config/constants');
const {
  createMeetingSchema,
  updateMeetingSchema,
  cancelMeetingSchema,
  meetingListQuery,
} = require('../validators/meetingValidators');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (req.user.role === ROLES.STUDENT) return requireApprovedStudent(req, res, next);
  return next();
});

// Must sit above /:id so "integrations" is not read as a meeting id.
router.get(
  '/integrations',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  controller.listIntegrations
);

router.get('/', validate({ query: meetingListQuery }), controller.listMeetings);
router.get('/:id', validateObjectId(), controller.getMeeting);

// Joining is what hands out the meeting URL, so every role goes through the same guard.
router.post('/:id/join', validateObjectId(), controller.joinMeeting);
router.post('/:id/leave', validateObjectId(), controller.leaveMeeting);

router.get(
  '/:id/attendance',
  requireStaff,
  requirePermission(PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.MANAGE_MEETINGS),
  validateObjectId(),
  controller.meetingAttendance
);

router.post(
  '/',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  validate({ body: createMeetingSchema }),
  controller.createMeeting
);

router.put(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  validateObjectId(),
  validate({ body: updateMeetingSchema }),
  controller.updateMeeting
);

router.patch(
  '/:id/cancel',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  validateObjectId(),
  validate({ body: cancelMeetingSchema }),
  controller.cancelMeeting
);

router.post(
  '/:id/finalize',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  validateObjectId(),
  controller.finalizeMeeting
);

router.delete(
  '/:id',
  requireStaff,
  requirePermission(PERMISSIONS.MANAGE_MEETINGS),
  validateObjectId(),
  controller.deleteMeeting
);

module.exports = router;
