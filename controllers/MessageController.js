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

  // PUT /api/chat/:chatId/messages/seen  { messageIds?: [1,2,3], all?: true }
  // Same effect as the socket "mark message seen": records the read, resets
  // the caller's unread counter and broadcasts "message seen" so the sender
  // sees the ticks live. `all: true` marks every unseen message from others
  // (a notification's "Mark as read").
  async markSeen(req, res) {
    try {
      const { id: userId } = req.user;
      const chatId = Number(req.params.chatId);
      const given = Array.isArray(req.body.messageIds) ? req.body.messageIds : [];

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return res.status(400).json({ success: false, error: "Invalid chatId." });
      }
      if (!(await chatRepository.isParticipant(chatId, userId))) {
        return res.status(403).json({ success: false, error: "Not a participant of this chat." });
      }

      const unseen = req.body.all === true ? await messageService.findUnseenIds(chatId, userId) : [];
      const messageIds = [...new Set([...given.map(Number).filter(Number.isInteger), ...unseen])];
      if (messageIds.length === 0 && req.body.all !== true) {
        return res.status(400).json({ success: false, error: "messageIds is required." });
      }

      await messageService.markSeen(messageIds, userId);
      await chatRepository.resetUnread(chatId, userId);
      const latestMessage = await messageService.getLatestFormatted(chatId, userId);

      if (messageIds.length > 0) {
        try {
          getIO().to(`chat-${chatId}`).emit("message seen", {
            chatId,
            messageIds,
            userId,
            unreadCount: 0,
            latestMessage,
          });
        } catch (err) {
          console.warn("Socket.IO not initialized, skipping message-seen broadcast");
        }
      }

      return res.status(200).json({ success: true, seen: messageIds, unreadCount: 0, latestMessage });
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
  // isDeleteAll:true is "delete for everyone" (recall, sender-only) — same
  // rules as the "delete message" socket event, see MessageService.
  async deleteForMe(req, res) {
    try {
      const { messageId } = req.params;
      const { id: userId } = req.user;
      const { isDeleteAll } = req.body;

      const formatted = isDeleteAll
        ? await messageService.deleteForEveryone(messageId, userId)
        : await messageService.deleteForMe(messageId, userId);

      try {
        // isDeleteAll: broadcast to the whole room, every participant just
        // lost this message. Otherwise: only this user's own other tabs/
        // devices need to know — nobody else's view changed.
        const room = isDeleteAll ? `chat-${formatted.chat_id}` : `user-${userId}`;
        getIO().to(room).emit("message deleted", formatted);
      } catch (err) {
        console.warn("Socket.IO not initialized, skipping message-deleted broadcast");
      }

      return res.status(200).json({ success: true, data: formatted });
    } catch (error) {
      console.error("MessageController.deleteForMe error:", error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        error: statusCode === 500 ? "Server error. Please try again later." : error.message,
      });
    }
  }

  // POST /api/chat/:chatId/messages  { message, localId?, replyToMessageId? }
  // Text only. For replies typed into a notification, where the app has no
  // socket connection — the socket "send message" event stays the normal
  // path. Same de-dup on localId, and the same "message" broadcast (to the
  // whole room, so the sender's own open devices get it too).
  async sendText(req, res) {
    try {
      const chatId = Number(req.params.chatId);
      const { id: userId } = req.user;
      const text = typeof req.body.message === "string" ? req.body.message.trim() : "";

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return res.status(400).json({ success: false, error: "Invalid chatId." });
      }
      if (!text) {
        return res.status(400).json({ success: false, error: "message is required." });
      }
      if (!(await chatRepository.isParticipant(chatId, userId))) {
        return res.status(403).json({ success: false, error: "Not a participant of this chat." });
      }

      const { message: created, isDuplicate } = await messageService.sendMessage(chatId, userId, {
        messageType: "text",
        message: text,
        localId: req.body.localId || null,
        replyToMessageId: req.body.replyToMessageId || null,
      });
      // Nothing to upload for text; the socket client clears this itself.
      const message = (await messageService.markUploaded(created.id, 100)) || created;
      const formatted = messageService.formatMessage(message, userId);

      if (!isDuplicate) {
        try {
          getIO().to(`chat-${chatId}`).emit("message", formatted);
        } catch (err) {
          console.warn("Socket.IO not initialized, skipping message broadcast");
        }
      }

      return res.status(201).json({ success: true, data: formatted });
    } catch (error) {
      console.error("MessageController.sendText error:", error);
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: status === 500 ? "Server error. Please try again later." : error.message,
      });
    }
  }
}

module.exports = MessageController;
