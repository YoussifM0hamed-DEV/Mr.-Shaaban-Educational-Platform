const express = require('express');

const authRoutes = require('./authRoutes');
const assistantRoutes = require('./assistantRoutes');
const studentRoutes = require('./studentRoutes');
const groupRoutes = require('./groupRoutes');
const moduleRoutes = require('./moduleRoutes');
const lessonRoutes = require('./lessonRoutes');
const videoRoutes = require('./videoRoutes');
const materialRoutes = require('./materialRoutes');
const quizRoutes = require('./quizRoutes');
const examRoutes = require('./examRoutes');
const meetingRoutes = require('./meetingRoutes');
const notificationRoutes = require('./notificationRoutes');
const announcementRoutes = require('./announcementRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const analyticsController = require('../controllers/analyticsController');
const studentDashboardController = require('../controllers/studentDashboardController');
const {
  authenticate,
  requireStaff,
  requireApprovedStudent,
  authorize,
} = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../config/constants');

const router = express.Router();

router.get('/health', (_req, res) =>
  res.json({ success: true, message: 'API is running', time: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/assistants', assistantRoutes);
router.use('/students', studentRoutes);
router.use('/groups', groupRoutes);
router.use('/modules', moduleRoutes);
router.use('/lessons', lessonRoutes);
router.use('/videos', videoRoutes);
router.use('/materials', materialRoutes);
router.use('/quizzes', quizRoutes);
router.use('/quiz-attempts', quizRoutes.attemptRouter);
router.use('/exams', examRoutes);
router.use('/exam-attempts', examRoutes.attemptRouter);
router.use('/meetings', meetingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/announcements', announcementRoutes);
router.use('/analytics', analyticsRoutes);

// Platform-wide activity feed for staff.
router.get(
  '/activities',
  authenticate,
  requireStaff,
  requirePermission(PERMISSIONS.VIEW_STUDENT_ACTIVITY, PERMISSIONS.VIEW_STUDENTS),
  analyticsController.listActivities
);

// The signed-in student's own progress and home screen.
router.get(
  '/progress/me',
  authenticate,
  authorize(ROLES.STUDENT),
  requireApprovedStudent,
  analyticsController.myProgress
);

router.get(
  '/student/dashboard',
  authenticate,
  authorize(ROLES.STUDENT),
  requireApprovedStudent,
  studentDashboardController.dashboard
);

router.get(
  '/student/activity',
  authenticate,
  authorize(ROLES.STUDENT),
  requireApprovedStudent,
  studentDashboardController.myActivity
);

module.exports = router;
