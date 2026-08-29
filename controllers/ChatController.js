// controllers/ChatController.js
const ChatService = require("../services/ChatService");
const chatService = new ChatService();

class ChatController {
  // GET /api/chat/relationship/:userId — "is this user my friend, do we
  // already have a 1:1 chat" — the two signals a client needs before
  // deciding whether to show "Add friend" / "Message" / "Open chat".
  async getRelationship(req, res) {
    try {
      const { id: userId } = req.user;
      const otherUserId = Number(req.params.userId);

      if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
        return res.status(400).json({ success: false, error: "Invalid userId." });
      }

      const data = await chatService.getRelationship(userId, otherUserId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("ChatController.getRelationship error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

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
      const { id: actingUserId } = req.user;

      const removed = await chatService.removeMember(id, targetUserId, actingUserId);
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

  async leave(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;

      const result = await chatService.leaveChat(id, userId);
      if (!result) {
        return res.status(404).json({ success: false, error: "Chat not found." });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.leave error:", error);
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

  // Soft, per-caller delete — see ChatService.deleteChatForUser. Only ever
  // affects the caller's own membership row and their own message history;
  // the other participant(s) are completely unaffected.
  async remove(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      await chatService.deleteChatForUser(id, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.remove error:", error);
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // Real, permanent delete — see ChatService.hardDeleteChat. Destroys the
  // chat for every participant at once, cannot be undone. 403 unless the
  // caller is this chat's own admin or holds the platform "admin" role.
  async hardDeleteChat(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      await chatService.hardDeleteChat(id, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.hardDeleteChat error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }
}

module.exports = ChatController;
