const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const authenticate = require('../middlewares/authenticate');
const checkIntegerParam = require('../middlewares/paramIntegerValidation');

const notificationController = new NotificationController();

// Every route is scoped to the authenticated user's own notifications —
// admins and users use the same endpoints; recipients are decided at creation time.
router.get('/my', authenticate, notificationController.getNotifications);
router.get('/my/unread-count', authenticate, notificationController.getUnreadCount);
router.put('/my/read-all', authenticate, notificationController.markAllRead);
router.put('/my/:id/read', authenticate, checkIntegerParam("id"), notificationController.markRead);
router.delete('/my/all', authenticate, notificationController.deleteAllNotifications);
router.delete('/my/:id', authenticate, checkIntegerParam("id"), notificationController.deleteNotification);

module.exports = router;
