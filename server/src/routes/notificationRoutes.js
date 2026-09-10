const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');

const router = express.Router();

// Every notification query is scoped to the signed-in user inside the controller.
router.use(authenticate);

router.get('/', controller.listNotifications);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', validateObjectId(), controller.markRead);
router.delete('/:id', validateObjectId(), controller.deleteNotification);

module.exports = router;
