// controllers/MessageController.js
const MessageService = require("../services/MessageService");
const ChatRepository = require("../repositories/ChatRepository");
const { getIO } = require("../config/socket");
const messageService = new MessageService();
const chatRepository = new ChatRepository();

class MessageController {
  // GET /api/chat/:chatId/messages?page=1&pageSize=30
  async history(req, res) {
    try {
      const { chatId } = req.params;
      const { id: userId } = req.user;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 30));

      if (!(await chatRepository.isParticipant(chatId, userId))) {
        return res.status(403).json({ success: false, error: "Not a participant of this chat." });
      }

      const result = await messageService.getHistory(chatId, userId, { page, pageSize });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("MessageController.history error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // PUT /api/chat/:chatId/messages/seen  { messageIds: [1,2,3] }
  async markSeen(req, res) {
    try {
      const { id: userId } = req.user;
      const { messageIds } = req.body;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ success: false, error: "messageIds is required." });
      }

      await messageService.markSeen(messageIds, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("MessageController.markSeen error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // PUT /api/chat/messages/:messageId/uploaded  { uploadingPercentage?: number }
  async markUploaded(req, res) {
    try {
      const { messageId } = req.params;
      const { uploadingPercentage } = req.body;

      const message = await messageService.markUploaded(
        messageId,
        uploadingPercentage === undefined ? 100 : uploadingPercentage
      );
      if (!message) {
        return res.status(404).json({ success: false, error: "Message not found." });
      }

      const formatted = messageService.formatMessage(message, req.user.id);

      try {
        getIO().to(`chat-${formatted.chat_id}`).emit("message updated", formatted);
      } catch (err) {
        console.warn("Socket.IO not initialized, skipping message-updated broadcast");
      }

      return res.status(200).json({ success: true, data: formatted });
    } catch (error) {
      console.error("MessageController.markUploaded error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // DELETE /api/chat/messages/:messageId  { isDeleteAll?: boolean }
  async deleteForMe(req, res) {
    try {
      const { messageId } = req.params;
      const { id: userId } = req.user;
      const { isDeleteAll } = req.body;

      await messageService.deleteForMe(messageId, userId, !!isDeleteAll);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("MessageController.deleteForMe error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }
}

module.exports = MessageController;
