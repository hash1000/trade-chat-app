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

  // Upgrades an existing 1:1 chat into a multi-member group in place (same
  // chat id/history) — see ChatService.convertToGroup. Any current
  // participant, not admin-gated (a 1:1 has no admin to gate on); the
  // caller becomes the new group's admin. 400 if it's already a group.
  async convertToGroup(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { groupName, groupImage, memberIds } = req.body;

      const chat = await chatService.convertToGroup(id, userId, {
        groupName,
        groupImage,
        memberIds: Array.isArray(memberIds) ? memberIds : [],
      });
      return res.status(200).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.convertToGroup error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
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

      const chat = await chatService.addMembers(id, memberIds, userId);
      return res.status(200).json({
        success: true,
        data: chatService.formatChat(chat, userId),
      });
    } catch (error) {
      console.error("ChatController.addMembers error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
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
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // Bulk remove — mirrors addMembers' { memberIds[] } shape. Returns which
  // ids were actually removed vs skipped (not a member / tried to remove
  // yourself) instead of a single true/false, since a batch can partially
  // succeed.
  async removeMembers(req, res) {
    try {
      const { id } = req.params;
      const { id: actingUserId } = req.user;
      const { memberIds } = req.body;

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ success: false, error: "memberIds is required." });
      }

      const result = await chatService.removeMembers(id, memberIds, actingUserId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("ChatController.removeMembers error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
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

  // Personal — mutes/unmutes push notifications for this chat, for the
  // caller only. No admin gate, unlike updateSettings below.
  async setMuted(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { isMuted } = req.body;

      const member = await chatService.setMuted(id, userId, !!isMuted);
      if (!member) {
        return res.status(404).json({ success: false, error: "Not a participant of this chat." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.setMuted error:", error);
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

  // Admin-only (this chat's adminId or a platform admin) — see
  // ChatService.updateSettings / assertCanManageMembers.
  async updateSettings(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;

      const updated = await chatService.updateSettings(id, req.body, userId);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Chat not found." });
      }
      const chat = await chatService.getById(id, userId);
      return res.status(200).json({ success: true, data: chat });
    } catch (error) {
      console.error("ChatController.updateSettings error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
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

  // "Clear chat" — see ChatService.clearMessagesForUser. Wipes the caller's
  // own message history for this chat but, unlike remove() above, the chat
  // stays in their list (just empty) instead of disappearing.
  // { forEveryone: true } switches this from "clear my own view" (anyone,
  // no admin check) to "recall all" (admin-only — see
  // ChatService.recallAllMessagesForEveryone) — same isDeleteAll-style flag
  // idiom DELETE /messages/:messageId already uses to pick between its two
  // modes.
  async clearMessages(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { forEveryone } = req.body || {};

      if (forEveryone) {
        const result = await chatService.recallAllMessagesForEveryone(id, userId);
        return res.status(200).json({ success: true, data: result });
      }

      await chatService.clearMessagesForUser(id, userId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("ChatController.clearMessages error:", error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
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
