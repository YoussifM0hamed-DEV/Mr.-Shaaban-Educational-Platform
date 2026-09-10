const express = require('express');
const controller = require('../controllers/analyticsController');
const { authenticate, requireStaff } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateObjectId } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/constants');

const router = express.Router();

router.use(authenticate, requireStaff, requirePermission(PERMISSIONS.VIEW_STUDENTS));

router.get('/dashboard', controller.dashboard);
router.get('/students-needing-attention', controller.studentsNeedingAttention);
router.get('/lessons', controller.lessonAnalytics);
router.get('/lessons/:id', validateObjectId(), controller.singleLessonAnalytics);
router.get('/meetings', controller.meetingAnalytics);
router.get('/activity-trend', controller.activityTrend);

module.exports = router;
