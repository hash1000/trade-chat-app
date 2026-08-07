// controllers/ChatController.js
const ChatService = require("../services/ChatService");
const chatService = new ChatService();

class ChatController {
  async list(req, res) {
    try {
      const { id: userId } = req.user;
      const archived = req.query.archived === "true";

      const chats = await chatService.listForUser(userId, { archived });
      return res.status(200).json({ success: true, data: chats });
    } catch (error) {
      console.error("ChatController.list error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;

      const chat = await chatService.getById(id, userId);
      if (!chat) {
        return res.status(404).json({ success: false, error: "Chat not found." });
      }
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.getById error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async createDirect(req, res) {
    try {
      const { id: userId } = req.user;
      const { userId: otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ success: false, error: "userId is required." });
      }

      const chat = await chatService.createDirectChat(userId, otherUserId);
      return res.status(201).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.createDirect error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async createGroup(req, res) {
    try {
      const { id: userId } = req.user;
      const { groupName, groupImage, memberIds, lockSettings } = req.body;

      if (!groupName || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "groupName and memberIds are required.",
        });
      }

      const chat = await chatService.createGroup({
        groupName,
        groupImage,
        adminId: userId,
        memberIds,
        lockSettings: !!lockSettings,
      });
      return res.status(201).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.createGroup error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async createServiceChat(req, res) {
    try {
      const { id: userId } = req.user;
      const { serviceId, teamId, ownerId, requestSubject, requestDesc } = req.body;

      if (!serviceId || !ownerId) {
        return res.status(400).json({
          success: false,
          error: "serviceId and ownerId are required.",
        });
      }

      const chat = await chatService.createServiceChat({
        serviceId,
        teamId,
        customerId: userId,
        ownerId,
        requestSubject,
        requestDesc,
      });
      return res.status(201).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.createServiceChat error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async createOrGetOrderChat(req, res) {
    try {
      const { id: userId } = req.user;
      const { orderId, ownerId, services } = req.body;

      if (!orderId || !ownerId || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({
          success: false,
          error: "orderId, ownerId and services[] are required.",
        });
      }

      const chat = await chatService.createOrGetOrderChat({
        orderId,
        customerId: userId,
        ownerId,
        services,
      });
      return res.status(201).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.createOrGetOrderChat error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async addMembers(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { memberIds } = req.body;

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ success: false, error: "memberIds is required." });
      }

      const chat = await chatService.addMembers(id, memberIds);
      return res.status(200).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.addMembers error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async removeMember(req, res) {
    try {
      const { id, userId: targetUserId } = req.params;

      const removed = await chatService.removeMember(id, targetUserId);
      if (!removed) {
        return res.status(404).json({ success: false, error: "Member not found in chat." });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.removeMember error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async setFavourite(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { isFavourite } = req.body;

      const member = await chatService.setFavourite(id, userId, !!isFavourite);
      if (!member) {
        return res.status(404).json({ success: false, error: "Not a participant of this chat." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.setFavourite error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async setArchived(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { isArchived } = req.body;

      const member = await chatService.setArchived(id, userId, !!isArchived);
      if (!member) {
        return res.status(404).json({ success: false, error: "Not a participant of this chat." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.setArchived error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async setBlocked(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { isBlocked } = req.body;

      const member = await chatService.setBlocked(id, userId, !!isBlocked);
      if (!member) {
        return res.status(404).json({ success: false, error: "Not a participant of this chat." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.setBlocked error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async markRead(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;

      const member = await chatService.markRead(id, userId);
      if (!member) {
        return res.status(404).json({ success: false, error: "Not a participant of this chat." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.markRead error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async updateSettings(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;

      const updated = await chatService.updateSettings(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Chat not found." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.updateSettings error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params;
      await chatService.deleteChat(id);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.remove error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }
}

module.exports = ChatController;
