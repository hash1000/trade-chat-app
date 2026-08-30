// services/ChatService.js
const sequelize = require("../config/database");
const { User, Role } = require("../models");
const ChatRepository = require("../repositories/ChatRepository");
const MessageRepository = require("../repositories/MessageRepository");
const FriendsRepository = require("../repositories/FriendsRepository");
const MessageService = require("./MessageService");
const { joinUsersToChat, leaveUsersFromChat, getIO } = require("../config/socket");

class ChatService {
  constructor() {
    this.chatRepository = new ChatRepository();
    this.messageRepository = new MessageRepository();
    this.friendsRepository = new FriendsRepository();
    this.messageService = new MessageService();
  }

  // Everything the caller needs to decide "start a chat" vs "open existing"
  // before hitting POST /chat/direct — friendship is one-directional (only
  // my own added-them entry counts, see FriendsRepository.get), and hasChat
  // only looks at a 1:1 direct chat (type "chat"), not groups/service/order
  // threads the two of them might also share.
  async getRelationship(userId, otherUserId) {
    const [friendRow, existingChat] = await Promise.all([
      this.friendsRepository.get(userId, otherUserId),
      this.chatRepository.findExistingDirectChat(userId, otherUserId),
    ]);

    return {
      userId: otherUserId,
      isFriend: !!friendRow,
      hasChat: !!existingChat,
      chatId: existingChat ? existingChat.id : null,
    };
  }

  // Moves already-connected sockets for these members into the new
  // chat-<id> room immediately — otherwise they'd only pick it up on
  // their next reconnect (chatSocket.js auto-joins at connect time only).
  // Also emits "new chat" to every OTHER member's personal room
  // (user-<id>) — the creator already has the chat from their own REST
  // response, so this is the only way anyone else finds out one exists
  // without polling GET /api/chat.
  notifyNewChat(chat, creatorId) {
    const memberIds = (chat.members || []).map((m) => m.userId);
    joinUsersToChat(memberIds, chat.id);

    const otherMemberIds = memberIds.filter((id) => id !== creatorId);
    if (otherMemberIds.length === 0) return;

    try {
      const io = getIO();
      otherMemberIds.forEach((userId) => {
        io.to(`user-${userId}`).emit("new chat", this.formatChat(chat, userId));
      });
    } catch (err) {
      console.warn("Socket.IO not initialized, skipping new-chat broadcast");
    }
  }

  formatDisplayName(user) {
    if (!user) return "Someone";
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Someone";
  }

  async getUserName(userId) {
    const user = await User.findByPk(userId, { attributes: ["firstName", "lastName", "username"] });
    return this.formatDisplayName(user);
  }

  // "group" vs "chat" — wording for the system messages below.
  async getGroupLabel(chatId) {
    const type = await this.chatRepository.getChatType(chatId);
    return type === "group" ? "group" : "chat";
  }

  // Creates + broadcasts a member-joined/left/removed announcement.
  // messageService.createSystemMessage gets it the same lastMessage-preview
  // update, unread increment, and push notification as a normal message —
  // the only thing missing versus a real "send message" call is the
  // socket ack (there's no per-request socket here, this is called from
  // plain REST controllers), so the room broadcast goes over io.to()
  // directly, same as notifyNewChat above.
  async postSystemMessage(chatId, actingUserId, text) {
    const message = await this.messageService.createSystemMessage(chatId, actingUserId, text);
    const formatted = this.messageService.formatMessage(message, actingUserId);

    try {
      getIO().to(`chat-${chatId}`).emit("message", formatted);
    } catch (err) {
      console.warn("Socket.IO not initialized, skipping system-message broadcast");
    }

    return formatted;
  }

  // --- response shaping -----------------------------------------------
  // Matches the client-facing chat/group JSON shape (group_members,
  // counterMessageNo, statusMembers, etc.) on top of the normalized
  // Chat/ChatMember/ChatService rows.

  formatMember(member) {
    const user = member.user || {};
    const image = user.profilePic || null;
    return {
      memberId: member.userId,
      memberName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      memberImage: image,
      memberPhone: user.phoneNumber || null,
      // Always mirrors memberImage now — this used to be null unless
      // memberStatus === "online", but that made a client that only reads
      // onlineImage lose the avatar entirely for anyone offline.
      onlineImage: image,
    };
  }

  formatChat(chat, viewerUserId) {
    const plain = typeof chat.get === "function" ? chat.get({ plain: true }) : chat;
    const members = plain.members || [];
    const chatServices = plain.chatServices || [];

    const viewerMember = plain.viewer || members.find((m) => m.userId === viewerUserId) || {};

    const result = {
      id: plain.id,
      group_name: plain.groupName,
      group_image: plain.groupImage,
      group_online_image: plain.groupOnlineImage,
      type: plain.type,
      group_admin_id: plain.adminId || 0,
      allowMembersToAddOthers: !!plain.allowMembersToAddOthers,
      allowMembersToViewProfile: !!plain.allowMembersToViewProfile,
      enableAIAnswer: !!plain.enableAIAnswer,
      lockSettings: !!plain.lockSettings,
      simpleModeOn: !!plain.simpleModeOn,
      group_last_message: plain.lastMessage,
      created_at: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
      updated_at: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
      memberIds: members.map((m) => m.userId),
      group_members: members.map((m) => this.formatMember(m)),
      isFav: members.filter((m) => m.isFavourite).map((m) => m.userId),
      archive: members.filter((m) => m.isArchived).map((m) => m.userId),
      blockData: members.filter((m) => m.isBlocked).map((m) => m.userId),
      mutedMembers: members.filter((m) => m.isMuted).map((m) => m.userId),
      counterMessageNo: members.map((m) => ({
        userId: m.userId,
        counter: m.unreadCount,
        isMention: m.isMention ? 1 : 0,
      })),
      isAllDeleteMainChat: members
        .filter((m) => m.isDeleteAll)
        .map((m) => ({ userId: m.userId, isDeleteAll: 1 })),
      statusMembers: members.map((m) => ({
        userId: m.userId,
        updatedAt: m.statusUpdatedAt
          ? new Date(m.statusUpdatedAt).toISOString()
          : null,
        memberStatus: m.memberStatus,
      })),
      viewer: viewerMember
        ? {
            unreadCount: viewerMember.unreadCount,
            isMention: !!viewerMember.isMention,
            isFavourite: !!viewerMember.isFavourite,
            isArchived: !!viewerMember.isArchived,
            isBlocked: !!viewerMember.isBlocked,
            isAdmin: !!viewerMember.isAdmin,
            isMuted: !!viewerMember.isMuted,
          }
        : null,
    };

    if (plain.orderId) {
      // Order-combined chat: multiple bundled services.
      result.service = this.formatServiceGroup(plain, chatServices);
    } else if (chatServices.length === 1) {
      result.service = this.formatSingleService(plain, chatServices[0]);
    }

    return result;
  }

  formatSingleService(chat, chatService) {
    const service = chatService.service || {};
    return {
      service_id: chatService.serviceId,
      team_id: chatService.teamId,
      customer_id: chat.customerId,
      status: chatService.status,
      service_name: service.name,
      location: service.location,
      description: service.description,
      user_service_subject: chatService.requestSubject,
      user_service_desc: chatService.requestDesc,
      pricing_type: service.pricing_type,
      price: service.price,
      is_paid: !!chatService.isPaid,
    };
  }

  formatServiceGroup(chat, chatServices) {
    const serviceIds = chatServices.map((cs) => cs.serviceId);
    const primary = chatServices[0];
    const service = (primary && primary.service) || {};
    return {
      service_id: primary ? primary.serviceId : null,
      team_id: primary ? primary.teamId : null,
      customer_id: chat.customerId,
      status: primary ? primary.status : null,
      service_name: service.name,
      location: service.location,
      description: service.description,
      service_order_id: chat.orderId,
      service_ids: serviceIds,
      pricing_type: service.pricing_type,
      price: service.price,
      is_paid: chatServices.every((cs) => cs.isPaid),
    };
  }

  // --- creation ----------------------------------------------------------

  async createDirectChat(userAId, userBId) {
    const existing = await this.chatRepository.findExistingDirectChat(userAId, userBId);
    if (existing) return this.chatRepository.findByPk(existing.id);

    const chat = await this.chatRepository.create({ type: "chat" }, [userAId, userBId]);
    const fullChat = await this.chatRepository.findByPk(chat.id);
    this.notifyNewChat(fullChat, userAId);
    return fullChat;
  }

  async createGroup({ groupName, groupImage, adminId, memberIds, lockSettings = false }) {
    const allMemberIds = [...new Set([adminId, ...memberIds])];
    const chat = await this.chatRepository.create(
      {
        type: "group",
        groupName,
        groupImage,
        adminId,
        lockSettings,
      },
      allMemberIds
    );
    const fullChat = await this.chatRepository.findByPk(chat.id);
    this.notifyNewChat(fullChat, adminId);
    return fullChat;
  }

  // Single-service request chat: customer <-> service team.
  async createServiceChat({ serviceId, teamId, customerId, ownerId, requestSubject, requestDesc }) {
    const chat = await sequelize.transaction(async (t) => {
      const chat = await this.chatRepository.create(
        { type: "chat", customerId },
        [customerId, ownerId],
        t
      );
      await this.chatRepository.attachServices(
        chat.id,
        [{ serviceId, teamId, status: 1, requestSubject, requestDesc, isPaid: false }],
        t
      );
      return chat;
    });
    const fullChat = await this.chatRepository.findByPk(chat.id);
    this.notifyNewChat(fullChat, customerId);
    return fullChat;
  }

  // Order-combined chat: bundles every isChat service in the order into
  // one thread. Reuses the existing chat if this order already has one.
  async createOrGetOrderChat({ orderId, customerId, ownerId, services }) {
    const existing = await this.chatRepository.findByOrderId(orderId);
    if (existing) return this.chatRepository.findByPk(existing.id);

    const chat = await sequelize.transaction(async (t) => {
      const chat = await this.chatRepository.create(
        { type: "chat", orderId, customerId },
        [customerId, ownerId],
        t
      );
      await this.chatRepository.attachServices(
        chat.id,
        services.map((s) => ({
          serviceId: s.serviceId,
          teamId: s.teamId,
          status: s.status || 1,
          isPaid: !!s.isPaid,
        })),
        t
      );
      return chat;
    });
    const fullChat = await this.chatRepository.findByPk(chat.id);
    this.notifyNewChat(fullChat, customerId);
    return fullChat;
  }

  // --- reads ---------------------------------------------------------

  async getById(chatId, viewerUserId) {
    const chat = await this.chatRepository.findByPk(chatId);
    if (!chat) return null;
    return this.formatChat(chat, viewerUserId);
  }

  async listForUser(userId, { archived = false } = {}) {
    const chats = await this.chatRepository.findAllForUser(userId, { archived });
    return chats.map((chat) => this.formatChat(chat, userId));
  }

  // --- member actions --------------------------------------------------

  // Only actually-new members get a system message and a socket-room join —
  // chatRepository.addMembers already de-dupes anyone already in the chat
  // and returns just the ones it created.
  //
  // Gated by assertCanAddMembers below: this chat's admin / a platform
  // admin, OR any current member if Group settings' "Allow members to add
  // others" is turned on.
  //
  // Exception: adding *only yourself* (userIds === [actingUserId]) is
  // exempt from all of that — that's self-join (the QR-scanned "request to
  // join a service group" flow, not member-management), same spirit as
  // removeMembers' self-removal exemption below (redirected to /leave
  // instead of being blocked). Adding anyone else, alone or mixed with
  // yourself, still goes through the full check.
  async addMembers(chatId, userIds, actingUserId) {
    const isSelfJoinOnly = userIds.length === 1 && userIds[0] === actingUserId;
    if (!isSelfJoinOnly) {
      await this.assertCanAddMembers(chatId, actingUserId);
    }

    const added = await this.chatRepository.addMembers(chatId, userIds);
    const fullChat = await this.chatRepository.findByPk(chatId);
    joinUsersToChat(added.map((m) => m.userId), chatId);

    const label = await this.getGroupLabel(chatId);
    for (const { userId } of added) {
      const name = await this.getUserName(userId);
      await this.postSystemMessage(chatId, userId, `${name} joined this ${label}`);
    }

    return fullChat;
  }

  // Removes one or more members at once — mirrors addMembers' bulk shape.
  // Each actually-removed member gets its own "removed" system message
  // (same one-per-member convention as addMembers' "joined" messages).
  // Anyone in targetUserIds who isn't currently a member is skipped, not
  // errored — same "partial success" spirit as addMembers de-duping
  // already-present ids. Removing yourself through this is refused (that's
  // leaveChat's job, see below) so the two flows can't be conflated —
  // self-removal here would post a "you removed you" message and skip the
  // admin-reassignment leaveChat does.
  //
  // Admin-only: same check as addMembers/hardDeleteChat — previously
  // unchecked entirely (any member could remove any other member).
  async removeMembers(chatId, targetUserIds, actingUserId) {
    await this.assertCanManageMembers(chatId, actingUserId, "remove members");

    const actorName = await this.getUserName(actingUserId);

    const removed = [];
    const skipped = [];

    for (const targetUserId of targetUserIds) {
      if (targetUserId === actingUserId) {
        skipped.push({ userId: targetUserId, reason: "Use POST /:id/leave to remove yourself" });
        continue;
      }

      const wasRemoved = await this.chatRepository.removeMember(chatId, targetUserId);
      if (!wasRemoved) {
        skipped.push({ userId: targetUserId, reason: "Not a member of this chat" });
        continue;
      }

      const targetName = await this.getUserName(targetUserId);
      // Broadcast BEFORE evicting: if the removed member's socket is still
      // connected, this is the one live notice that tells them it happened
      // (chat-<id> is still their room at this point). Evicting first would
      // silently deny them even that, leaving `check chat membership` (§2)
      // as their only way to find out.
      await this.postSystemMessage(chatId, actingUserId, `${actorName} removed ${targetName}`);
      leaveUsersFromChat([targetUserId], chatId);

      removed.push(targetUserId);
    }

    return { removed, skipped };
  }

  // Backward-compatible single-target wrapper — used by the existing
  // DELETE /:id/members/:userId route.
  async removeMember(chatId, targetUserId, actingUserId) {
    const { removed } = await this.removeMembers(chatId, [targetUserId], actingUserId);
    return removed.length > 0;
  }

  // Self-service leave. If the leaver was the group admin and other
  // members remain, the oldest remaining member is auto-promoted so the
  // group always has exactly one admin.
  async leaveChat(chatId, userId) {
    const chat = await this.chatRepository.findByPk(chatId);
    if (!chat) return null;

    const wasAdmin = chat.adminId === userId;
    const leavingMember = (chat.members || []).find((m) => m.userId === userId);

    await sequelize.transaction(async (t) => {
      await this.chatRepository.removeMember(chatId, userId, t);

      if (wasAdmin) {
        const nextAdmin = await this.chatRepository.findOldestMember(chatId, userId, t);
        if (nextAdmin) {
          await this.chatRepository.promoteAdmin(chatId, nextAdmin.userId, t);
        } else {
          // No members left — nothing to promote, chat is now empty.
          await this.chatRepository.updateChat(chatId, { adminId: null }, t);
        }
      }
    });

    const name = this.formatDisplayName(leavingMember && leavingMember.user);
    const label = chat.type === "group" ? "group" : "chat";
    // Broadcast before evicting, same ordering as removeMember above — any
    // other tab the leaver still has open in this room sees the notice too.
    await this.postSystemMessage(chatId, userId, `${name} left this ${label}`);

    leaveUsersFromChat([userId], chatId);

    return { left: true };
  }

  // Fire-and-forget emit to one user's own personal room (all their
  // connected devices/tabs), used for every per-member state change below
  // (favourite/archive/block/mute/read) — these only ever affect the
  // caller's own view of the chat, so unlike "group settings updated" or
  // "chat deleted" they never go to the shared chat-<id> room.
  emitToUser(userId, event, payload) {
    try {
      getIO().to(`user-${userId}`).emit(event, payload);
    } catch (err) {
      console.warn(`Socket.IO not initialized, skipping "${event}" broadcast`);
    }
  }

  async setFavourite(chatId, userId, isFavourite) {
    const member = await this.chatRepository.updateMemberState(chatId, userId, { isFavourite });
    if (member) this.emitToUser(userId, "chat favourite updated", { chatId, isFavourite: !!isFavourite });
    return member;
  }

  async setArchived(chatId, userId, isArchived) {
    const member = await this.chatRepository.updateMemberState(chatId, userId, { isArchived });
    if (member) this.emitToUser(userId, "chat archived updated", { chatId, isArchived: !!isArchived });
    return member;
  }

  async setBlocked(chatId, userId, isBlocked) {
    const member = await this.chatRepository.updateMemberState(chatId, userId, { isBlocked });
    if (member) this.emitToUser(userId, "chat blocked updated", { chatId, isBlocked: !!isBlocked });
    return member;
  }

  // Personal — no admin gate, this only ever affects the caller's own
  // notifications (see MessageService.notifyNewMessage, which skips muted
  // recipients). Broadcast to the caller's own personal room only (not the
  // whole chat) so their other tabs/devices stay in sync — nobody else's
  // view needs to change when you mute a chat.
  async setMuted(chatId, userId, isMuted) {
    const member = await this.chatRepository.updateMemberState(chatId, userId, { isMuted });
    if (member) this.emitToUser(userId, "chat muted", { chatId, isMuted: !!isMuted });
    return member;
  }

  async setDeleteAll(chatId, userId, isDeleteAll) {
    return this.chatRepository.updateMemberState(chatId, userId, { isDeleteAll });
  }

  async setStatus(chatId, userId, memberStatus) {
    return this.chatRepository.updateMemberState(chatId, userId, {
      memberStatus,
      statusUpdatedAt: new Date(),
    });
  }

  async markRead(chatId, userId) {
    await this.chatRepository.resetUnread(chatId, userId);
    const member = await this.chatRepository.findMember(chatId, userId);
    if (member) this.emitToUser(userId, "chat read updated", { chatId, unreadCount: 0 });
    return member;
  }

  async recordIncomingMessage(chatId, senderId, messageText) {
    await this.chatRepository.setLastMessage(chatId, messageText);
    await this.chatRepository.incrementUnreadForOthers(chatId, senderId);
  }

  // Admin-only (this chat's adminId or a platform admin) — previously
  // unchecked entirely, same gap add/removeMembers had before their own
  // gates were added. Broadcasts "group settings updated" (whole room) so
  // every connected member's client reflects the change live instead of
  // only whoever called this getting it back in the REST response.
  async updateSettings(chatId, data, actingUserId) {
    await this.assertCanManageMembers(chatId, actingUserId, "update group settings");

    const allowed = {};
    if ("allowMembersToAddOthers" in data) allowed.allowMembersToAddOthers = !!data.allowMembersToAddOthers;
    if ("allowMembersToViewProfile" in data) allowed.allowMembersToViewProfile = !!data.allowMembersToViewProfile;
    if ("enableAIAnswer" in data) allowed.enableAIAnswer = !!data.enableAIAnswer;
    if ("lockSettings" in data) allowed.lockSettings = !!data.lockSettings;
    if ("simpleModeOn" in data) allowed.simpleModeOn = !!data.simpleModeOn;
    if ("groupName" in data) allowed.groupName = data.groupName;
    if ("groupImage" in data) allowed.groupImage = data.groupImage;

    const updated = await this.chatRepository.updateChat(chatId, allowed);
    if (!updated) return null;

    try {
      getIO().to(`chat-${chatId}`).emit("group settings updated", {
        chatId,
        groupName: updated.groupName,
        groupImage: updated.groupImage,
        allowMembersToAddOthers: !!updated.allowMembersToAddOthers,
        allowMembersToViewProfile: !!updated.allowMembersToViewProfile,
        enableAIAnswer: !!updated.enableAIAnswer,
        lockSettings: !!updated.lockSettings,
        simpleModeOn: !!updated.simpleModeOn,
      });
    } catch (err) {
      console.warn("Socket.IO not initialized, skipping group-settings-updated broadcast");
    }

    return updated;
  }

  // Soft, per-caller delete: hides the chat from the caller's own list and
  // clears their own message history for it — the other participant(s)
  // keep the chat and every message exactly as before, this never touches
  // their data. A later message in this chat — from either side, including
  // the caller re-messaging it themselves — clears this again (see
  // MessageService.sendMessage -> ChatRepository.clearDeleteAllForChat),
  // so the chat comes back into the caller's list with their old history
  // still hidden but that new message (and any after it) visible.
  async deleteChatForUser(chatId, userId) {
    const isParticipant = await this.chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      const err = new Error("Not a participant of this chat");
      err.statusCode = 403;
      throw err;
    }

    await this.chatRepository.updateMemberState(chatId, userId, { isDeleteAll: true });
    await this.messageRepository.markAllDeletedForChat(chatId, userId);
  }

  // "Clear chat" — wipes the caller's own message history for this chat,
  // same underlying markAllDeletedForChat as deleteChatForUser above, but
  // deliberately does NOT touch isDeleteAll — so unlike deleteChatForUser,
  // the chat stays exactly where it is in the caller's list (now just
  // empty) instead of disappearing until the other side sends something
  // new. WhatsApp's "Clear Chat" vs "Delete Chat" distinction. Other
  // participant(s) are completely unaffected either way.
  //
  // Known limitation: Chat.lastMessage (the list-preview string) is a
  // single column shared by every viewer, not per-user — clearing your own
  // history can't blank just your copy of it, so your chat-list row may
  // keep showing the old preview text even though opening the chat now
  // shows nothing. Same shared-column limitation deleteChatForUser has,
  // just more visible here since the chat itself stays listed.
  async clearMessagesForUser(chatId, userId) {
    const isParticipant = await this.chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      const err = new Error("Not a participant of this chat");
      err.statusCode = 403;
      throw err;
    }

    await this.messageRepository.markAllDeletedForChat(chatId, userId);
    await this.chatRepository.resetUnread(chatId, userId);
  }

  // Admin-only "recall all" — DELETE /:id/messages with { forEveryone: true
  // } (contrast clearMessagesForUser above, which needs no admin check
  // since it only ever touches the caller's own view). Same "delete for
  // everyone" semantics DELETE /messages/:messageId (isDeleteAll: true)
  // already has per-message (MessageService.deleteForEveryone) — this just
  // applies it across the chat's entire existing history in one call
  // instead of one message at a time. The chat itself is untouched (still
  // listed, still open) — only its messages disappear, for every
  // participant, same as if each had been individually recalled.
  // Gated the same way as add/removeMembers/hardDeleteChat.
  async recallAllMessagesForEveryone(chatId, actingUserId) {
    await this.assertCanManageMembers(chatId, actingUserId, "recall all messages");

    const memberIds = await this.chatRepository.getMemberIds(chatId);
    const messageIds = await this.messageRepository.markAllDeletedForEveryone(chatId, memberIds);

    if (messageIds.length === 0) {
      return { recalledCount: 0 };
    }

    // Unlike clearMessagesForUser's per-viewer limitation, this actually IS
    // the right moment to reset the shared lastMessage column — the
    // messages are gone for every participant, not just one viewer.
    await this.chatRepository.setLastMessage(chatId, null);

    // One lightweight event for the whole batch rather than a full
    // "message deleted" (§3) per message — a chat's entire history could be
    // thousands of rows, and every client here just needs to know which
    // ids to strike from whatever it already has loaded.
    try {
      getIO().to(`chat-${chatId}`).emit("all messages deleted", { chatId, messageIds });
    } catch (err) {
      console.warn("Socket.IO not initialized, skipping all-messages-deleted broadcast");
    }

    return { recalledCount: messageIds.length };
  }

  async isPlatformAdmin(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "roles", attributes: ["name"] }],
    });
    return !!(user && (user.roles || []).some((r) => r.name === "admin"));
  }

  // Shared gate for every chat-management action that's admin-only (add
  // members, remove members, hard-delete): the caller must be either this
  // specific chat's own admin (Chat.adminId) or hold the platform "admin"
  // role. Checked here rather than by route middleware, since "admin of
  // THIS chat" is resource-specific and authorize() only knows about global
  // roles. [action] only flavors the 403 message (e.g. "add members").
  async assertCanManageMembers(chatId, actingUserId, action) {
    const chat = await this.chatRepository.findMeta(chatId);
    if (!chat) {
      const err = new Error("Chat not found.");
      err.statusCode = 404;
      throw err;
    }

    const isGroupAdmin = chat.adminId === actingUserId;
    if (!isGroupAdmin && !(await this.isPlatformAdmin(actingUserId))) {
      const err = new Error(`Only this chat's admin or a platform admin can ${action}.`);
      err.statusCode = 403;
      throw err;
    }

    return chat;
  }

  // Add-members gate — same admin-or-platform-admin baseline as
  // assertCanManageMembers above, but also allows ANY current participant
  // when this chat's allowMembersToAddOthers is turned on (Group settings
  // -> "Allow members to add others"). removeMembers/hardDeleteChat/
  // updateSettings stay admin-only regardless — this toggle only ever
  // relaxes ADDING.
  async assertCanAddMembers(chatId, actingUserId) {
    const chat = await this.chatRepository.findMeta(chatId);
    if (!chat) {
      const err = new Error("Chat not found.");
      err.statusCode = 404;
      throw err;
    }

    const isGroupAdmin = chat.adminId === actingUserId;
    if (isGroupAdmin) return chat;

    const isParticipant = await this.chatRepository.isParticipant(chatId, actingUserId);
    if (chat.allowMembersToAddOthers && isParticipant) return chat;

    if (await this.isPlatformAdmin(actingUserId)) return chat;

    // Two different reasons to fail, worth telling apart: a non-participant
    // is rejected regardless of the setting (it only ever relaxes things
    // for people already in the chat); a participant blocked here means
    // the setting is genuinely off.
    const err = new Error(
      isParticipant
        ? 'Only this chat\'s admin or a platform admin can add members (ask the admin to enable "Allow members to add others" in Group settings).'
        : "Not a participant of this chat."
    );
    err.statusCode = 403;
    throw err;
  }

  // Real, permanent delete — unlike deleteChatForUser (soft, per-caller
  // only, above), this destroys the chat for EVERY participant at once and
  // cannot be undone. Any chat type (1:1, group, service, order), not just
  // groups.
  async hardDeleteChat(chatId, actingUserId) {
    await this.assertCanManageMembers(chatId, actingUserId, "hard-delete it");

    // Member ids first — chat_members cascades away the moment the chat
    // row is destroyed, so this is the last chance to know who to evict.
    const memberIds = await this.chatRepository.getMemberIds(chatId);

    await sequelize.transaction(async (t) => {
      // See MessageRepository.clearRepliesForChat — replyToMessageId has no
      // ON DELETE CASCADE, so this has to run before the chat (and its
      // messages) actually get destroyed below.
      await this.messageRepository.clearRepliesForChat(chatId, t);
      await this.chatRepository.destroy(chatId, t);
    });

    // Broadcast before evicting — same ordering as removeMember/leaveChat
    // above — so anyone still connected gets this one live notice before
    // losing the room.
    try {
      getIO().to(`chat-${chatId}`).emit("chat deleted", { chatId });
    } catch (err) {
      console.warn("Socket.IO not initialized, skipping chat-deleted broadcast");
    }
    leaveUsersFromChat(memberIds, chatId);

    return true;
  }
}

module.exports = ChatService;
