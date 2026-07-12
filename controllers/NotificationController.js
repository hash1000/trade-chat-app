const NotificationService = require("../services/NotificationService");
const notificationService = new NotificationService();

class NotificationController {
  async getNotifications(req, res) {
    try {
      const { id: userId } = req.user;
      const { pagination, page, limit, unread, type, autoRead } = req.query;

      const usePagination = pagination === "true";
      const options = {
        unreadOnly: unread === "true",
        type: type || null,
        // fetched notifications are marked read automatically; pass ?autoRead=false to keep them unread
        autoRead: autoRead !== "false",
      };

      if (!usePagination) {
        const result = await notificationService.listForUser(userId, options);
        return res.status(200).json({
          success: true,
          data: result.notifications,
          unreadCount: result.unreadCount,
        });
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const result = await notificationService.listForUser(userId, {
        ...options,
        pagination: true,
        page: pageNum,
        limit: limitNum,
      });

      return res.status(200).json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
          limit: limitNum,
        },
      });
    } catch (error) {
      console.error("getNotifications error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const { id: userId } = req.user;
      const unreadCount = await notificationService.getUnreadCount(userId);
      return res.status(200).json({ success: true, unreadCount });
    } catch (error) {
      console.error("getUnreadCount error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async markRead(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const notification = await notificationService.markRead(userId, id);
      if (!notification) {
        return res.status(404).json({ success: false, error: "Notification not found." });
      }
      return res.status(200).json({ success: true, data: notification });
    } catch (error) {
      console.error("markRead error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async markAllRead(req, res) {
    try {
      const { id: userId } = req.user;
      const updated = await notificationService.markAllRead(userId);
      return res.status(200).json({
        success: true,
        message: `${updated} notification(s) marked as read.`,
      });
    } catch (error) {
      console.error("markAllRead error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async deleteNotification(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const deleted = await notificationService.deleteForUser(userId, id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Notification not found." });
      }
      return res.status(200).json({ success: true, message: "Notification deleted successfully." });
    } catch (error) {
      console.error("deleteNotification error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async deleteAllNotifications(req, res) {
    try {
      const { id: userId } = req.user;
      const deleted = await notificationService.deleteAllForUser(userId);
      return res.status(200).json({
        success: true,
        message: `${deleted} notification(s) deleted successfully.`,
      });
    } catch (error) {
      console.error("deleteAllNotifications error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = NotificationController;
