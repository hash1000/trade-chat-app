// repositories/ChatRepository.js
const { Op } = require("sequelize");
const {
  Chat,
  ChatMember,
  ChatService,
  User,
  Service,
  Order,
  TeamServiceLink,
  Team,
} = require("../models");

const MEMBER_USER_ATTRIBUTES = [
  "id",
  "firstName",
  "lastName",
  "username",
  "phoneNumber",
  "profilePic",
  // Global presence, sourced from the User row now (not per-chat) — see
  // socket/userSocket.js.
  "isOnline",
  "lastSeenAt",
];

class ChatRepository {
  buildDetailIncludes() {
    return [
      {
        model: ChatMember,
        as: "members",
        include: [{ model: User, as: "user", attributes: MEMBER_USER_ATTRIBUTES }],
      },
      { model: User, as: "admin", attributes: MEMBER_USER_ATTRIBUTES },
      { model: User, as: "customer", attributes: MEMBER_USER_ATTRIBUTES },
      { model: Order, as: "order", attributes: ["id", "status"] },
      {
        model: ChatService,
        as: "chatServices",
        include: [
          {
            model: Service,
            as: "service",
            attributes: [
              "id",
              "name",
              "pricing_type",
              "price",
              "min_price",
              "max_price",
              "location",
              "description",
            ],
          },
          { model: Team, as: "team", attributes: ["id", "name", "profile_image"] },
        ],
      },
    ];
  }

  async create(chatData, memberUserIds, t) {
    const chat = await Chat.create(chatData, { transaction: t });

    const uniqueMemberIds = [...new Set(memberUserIds)];
    await ChatMember.bulkCreate(
      uniqueMemberIds.map((userId) => ({
        chatId: chat.id,
        userId,
        isAdmin: userId === chatData.adminId,
      })),
      { transaction: t }
    );

    return chat;
  }

  async attachServices(chatId, serviceLinks, t) {
    if (!Array.isArray(serviceLinks) || serviceLinks.length === 0) return [];
    return ChatService.bulkCreate(
      serviceLinks.map((link) => ({ chatId, ...link })),
      { transaction: t }
    );
  }

  async findByOrderId(orderId) {
    return Chat.findOne({ where: { orderId } });
  }

  async findExistingDirectChat(userAId, userBId) {
    // A 1:1 "chat" between exactly these two users (not a group).
    const chats = await Chat.findAll({
      where: { type: "chat" },
      include: [
        {
          model: ChatMember,
          as: "members",
          attributes: ["userId"],
        },
      ],
    });

    return (
      chats.find((chat) => {
        const ids = chat.members.map((m) => m.userId);
        return ids.length === 2 && ids.includes(userAId) && ids.includes(userBId);
      }) || null
    );
  }

  async findByPk(chatId, options = {}) {
    return Chat.findByPk(chatId, {
      include: this.buildDetailIncludes(),
      ...options,
    });
  }

  async findMember(chatId, userId) {
    return ChatMember.findOne({ where: { chatId, userId } });
  }

  // Every chat this user currently belongs to — used to auto-join
  // chat-<id> socket rooms on connect.
  async getUserChatIds(userId) {
    const memberships = await ChatMember.findAll({
      where: { userId },
      attributes: ["chatId"],
    });
    return memberships.map((m) => m.chatId);
  }

  async isParticipant(chatId, userId) {
    const member = await ChatMember.findOne({
      where: { chatId, userId },
      attributes: ["id"],
    });
    return Boolean(member);
  }

  // Existence only, no includes — for the "check chat membership" socket
  // event, which needs to tell "chat doesn't exist" apart from "chat exists
  // but you're not in it" without paying for buildDetailIncludes().
  async exists(chatId) {
    const chat = await Chat.findByPk(chatId, { attributes: ["id"] });
    return Boolean(chat);
  }

  // "group" vs "chat" (1:1) — used to word system messages ("left the
  // group" vs "left the chat") without pulling the full detail includes.
  async getChatType(chatId) {
    const chat = await Chat.findByPk(chatId, { attributes: ["type"] });
    return chat ? chat.type : null;
  }

  // Just enough to authorize hardDeleteChat (adminId, type) without paying
  // for buildDetailIncludes().
  async findMeta(chatId) {
    return Chat.findByPk(chatId, {
      attributes: ["id", "adminId", "type", "allowMembersToAddOthers"],
    });
  }

  // Real, permanent delete — chat_members/chat_services/messages (and
  // messages' reads/deletes/mentions) all cascade via each table's own
  // ON DELETE CASCADE FK. Caller is responsible for anything that does NOT
  // cascade first (messages.replyToMessageId has no cascade — see
  // ChatService.hardDeleteChat).
  async destroy(chatId, t) {
    const count = await Chat.destroy({ where: { id: chatId }, transaction: t });
    return count > 0;
  }

  async findAllForUser(userId, { archived = false } = {}) {
    const memberships = await ChatMember.findAll({
      // isDeleteAll: excludes chats this user deleted "for me" (see
      // ChatService.deleteChatForUser) — cleared again the moment anyone
      // sends a new message in it, including this user themselves (see
      // clearDeleteAllForChat), which is what brings the chat back into
      // this list.
      where: { userId, isArchived: archived, isDeleteAll: false },
      include: [
        {
          model: Chat,
          as: "chat",
          include: [
            {
              model: ChatMember,
              as: "members",
              include: [{ model: User, as: "user", attributes: MEMBER_USER_ATTRIBUTES }],
            },
            {
              model: ChatService,
              as: "chatServices",
              include: [{ model: Service, as: "service", attributes: ["id", "name"] }],
            },
          ],
        },
      ],
      order: [
        [{ model: Chat, as: "chat" }, "lastMessageAt", "DESC"],
        [{ model: Chat, as: "chat" }, "updatedAt", "DESC"],
      ],
    });

    return memberships.map((m) => ({
      ...m.chat.get({ plain: true }),
      viewer: {
        unreadCount: m.unreadCount,
        isMention: m.isMention,
        isFavourite: m.isFavourite,
        isArchived: m.isArchived,
        isBlocked: m.isBlocked,
        isAdmin: m.isAdmin,
      },
    }));
  }

  // Chat ids linked to a given service via chat_services, restricted to
  // chats this user is actually a member of — for "every chat I have going
  // about service X" (there can be more than one: different teams offering
  // the same service, or separate service-request/order chats that both
  // happen to bundle it). One query: both the membership and the
  // service-link are enforced as INNER JOINs (attributes: [] on each, so
  // only Chat.id itself comes back) — replaces an earlier two-step version
  // (this user's chat ids, then a separate chat_services scan). `Set`
  // dedupes Chat.id, which can repeat in the raw join when a chat has more
  // than one matching members/chatServices row.
  async findChatIdsByServiceForUser(userId, serviceId) {
    const chats = await Chat.findAll({
      attributes: ["id"],
      include: [
        { model: ChatMember, as: "members", attributes: [], where: { userId }, required: true },
        { model: ChatService, as: "chatServices", attributes: [], where: { serviceId }, required: true },
      ],
    });
    return [...new Set(chats.map((c) => c.id))];
  }

  // Full detail rows (buildDetailIncludes) for a batch of chat ids in one
  // query — used instead of calling findByPk once per id in a loop, which
  // would fire N separate round trips for a caller with N matching chats.
  async findManyByIds(chatIds) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) return [];
    return Chat.findAll({
      where: { id: { [Op.in]: chatIds } },
      include: this.buildDetailIncludes(),
    });
  }

  async getServiceTeams(serviceId) {
    if (!serviceId) return [];
    const links = await TeamServiceLink.findAll({
      where: { serviceId },
      include: [{ model: Team, as: "team", attributes: ["id", "name", "profile_image"] }],
    });
    return links.map((l) => l.team).filter(Boolean);
  }

  // Oldest remaining member (by join order), used to auto-promote a new
  // admin when the current admin leaves.
  async findOldestMember(chatId, excludeUserId, t) {
    return ChatMember.findOne({
      where: { chatId, userId: { [Op.ne]: excludeUserId } },
      order: [["createdAt", "ASC"]],
      transaction: t,
    });
  }

  async promoteAdmin(chatId, userId, t) {
    await Chat.update({ adminId: userId }, { where: { id: chatId }, transaction: t });
    await ChatMember.update(
      { isAdmin: true },
      { where: { chatId, userId }, transaction: t }
    );
  }

  async addMembers(chatId, userIds) {
    const existing = await ChatMember.findAll({
      where: { chatId, userId: { [Op.in]: userIds } },
      attributes: ["userId"],
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const toAdd = userIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) return [];

    return ChatMember.bulkCreate(toAdd.map((userId) => ({ chatId, userId })));
  }

  async removeMember(chatId, userId, t) {
    const deleted = await ChatMember.destroy({ where: { chatId, userId }, transaction: t });
    return deleted > 0;
  }

  async updateMemberState(chatId, userId, data) {
    const [count] = await ChatMember.update(data, {
      where: { chatId, userId },
    });
    if (count === 0) return null;
    return this.findMember(chatId, userId);
  }

  async incrementUnreadForOthers(chatId, excludeUserId) {
    await ChatMember.increment("unreadCount", {
      by: 1,
      where: { chatId, userId: { [Op.ne]: excludeUserId } },
    });
  }

  // Un-hides this chat for every member who'd previously deleted it "for
  // me" — a new message revives it back into their list. Their
  // already-soft-deleted message history stays hidden; only this message
  // (and any after it) becomes visible again.
  //
  // Deliberately includes the sender too, not just "everyone else" — it
  // used to exclude excludeUserId (the sender) on the assumption that
  // whoever just sent a message obviously already has the chat in view,
  // but that's not true if THEY were the one who'd deleted it "for me" and
  // are now re-engaging with it: excluding them left their own isDeleteAll
  // flag stuck true forever, so the chat would never reappear in the
  // sender's own list even though they were actively messaging in it.
  async clearDeleteAllForChat(chatId) {
    await ChatMember.update(
      { isDeleteAll: false },
      { where: { chatId, isDeleteAll: true } }
    );
  }

  // Other participants for a chat (self excluded), with their current
  // unreadCount — used to fan out push notifications on "send message".
  // Call after incrementUnreadForOthers() so the count is already current.
  async getOtherMembers(chatId, excludeUserId) {
    const members = await ChatMember.findAll({
      where: { chatId, userId: { [Op.ne]: excludeUserId } },
      attributes: ["userId", "unreadCount", "isMuted"],
    });
    return members.map((m) => ({
      userId: m.userId,
      unreadCount: m.unreadCount,
      isMuted: !!m.isMuted,
    }));
  }

  // Every member's userId for a chat (self included) — used to fan out
  // "delete for everyone" (recall) rows across all participants at once.
  async getMemberIds(chatId) {
    const members = await ChatMember.findAll({
      where: { chatId },
      attributes: ["userId"],
    });
    return members.map((m) => m.userId);
  }

  async resetUnread(chatId, userId) {
    return ChatMember.update(
      { unreadCount: 0, isMention: false, lastReadAt: new Date() },
      { where: { chatId, userId } }
    );
  }

  async setLastMessage(chatId, lastMessage, lastMessageAt = new Date()) {
    await Chat.update({ lastMessage, lastMessageAt }, { where: { id: chatId } });
  }

  async updateChat(chatId, data, t) {
    const [count] = await Chat.update(data, { where: { id: chatId }, transaction: t });
    if (count === 0) return null;
    return Chat.findByPk(chatId, { transaction: t });
  }

}

module.exports = ChatRepository;
