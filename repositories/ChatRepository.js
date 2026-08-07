// repositories/ChatRepository.js
const { Op } = require("sequelize");
const sequelize = require("../config/database");
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

  async findAllForUser(userId, { archived = false } = {}) {
    const memberships = await ChatMember.findAll({
      where: { userId, isArchived: archived },
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
        memberStatus: m.memberStatus,
        isAdmin: m.isAdmin,
      },
    }));
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

  async deleteChat(chatId) {
    return sequelize.transaction(async (t) => {
      await ChatService.destroy({ where: { chatId }, transaction: t });
      await ChatMember.destroy({ where: { chatId }, transaction: t });
      await Chat.destroy({ where: { id: chatId }, transaction: t });
    });
  }
}

module.exports = ChatRepository;
