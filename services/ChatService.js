// services/ChatService.js
const sequelize = require("../config/database");
const ChatRepository = require("../repositories/ChatRepository");

class ChatService {
  constructor() {
    this.chatRepository = new ChatRepository();
  }

  // --- response shaping -----------------------------------------------
  // Matches the client-facing chat/group JSON shape (group_members,
  // counterMessageNo, statusMembers, etc.) on top of the normalized
  // Chat/ChatMember/ChatService rows.

  formatMember(member) {
    const user = member.user || {};
    return {
      memberId: member.userId,
      memberName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      memberImage: user.profilePic || null,
      memberPhone: user.phoneNumber || null,
      onlineImage: member.memberStatus === "online" ? user.profilePic || null : null,
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
      allowMembersToViewProfile: !!plain.allowMembersToViewProfile,
      enableAIAnswer: !!plain.enableAIAnswer,
      lockSettings: !!plain.lockSettings,
      simpleModeOn: !!plain.simpleModeOn,
      group_last_message: plain.lastMessage,
      created_at: plain.createdAt ? Math.floor(new Date(plain.createdAt).getTime() / 1000) : null,
      memberIds: members.map((m) => m.userId),
      group_members: members.map((m) => this.formatMember(m)),
      isFav: members.filter((m) => m.isFavourite).map((m) => m.userId),
      archive: members.filter((m) => m.isArchived).map((m) => m.userId),
      blockData: members.filter((m) => m.isBlocked).map((m) => m.userId),
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
          ? Math.floor(new Date(m.statusUpdatedAt).getTime() / 1000)
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
    return this.chatRepository.findByPk(chat.id);
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
    return this.chatRepository.findByPk(chat.id);
  }

  // Single-service request chat: customer <-> service team.
  async createServiceChat({ serviceId, teamId, customerId, ownerId, requestSubject, requestDesc }) {
    return sequelize.transaction(async (t) => {
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
    }).then((chat) => this.chatRepository.findByPk(chat.id));
  }

  // Order-combined chat: bundles every isChat service in the order into
  // one thread. Reuses the existing chat if this order already has one.
  async createOrGetOrderChat({ orderId, customerId, ownerId, services }) {
    const existing = await this.chatRepository.findByOrderId(orderId);
    if (existing) return this.chatRepository.findByPk(existing.id);

    return sequelize.transaction(async (t) => {
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
    }).then((chat) => this.chatRepository.findByPk(chat.id));
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

  async addMembers(chatId, userIds) {
    await this.chatRepository.addMembers(chatId, userIds);
    return this.chatRepository.findByPk(chatId);
  }

  async removeMember(chatId, userId) {
    return this.chatRepository.removeMember(chatId, userId);
  }

  async setFavourite(chatId, userId, isFavourite) {
    return this.chatRepository.updateMemberState(chatId, userId, { isFavourite });
  }

  async setArchived(chatId, userId, isArchived) {
    return this.chatRepository.updateMemberState(chatId, userId, { isArchived });
  }

  async setBlocked(chatId, userId, isBlocked) {
    return this.chatRepository.updateMemberState(chatId, userId, { isBlocked });
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
    return this.chatRepository.findMember(chatId, userId);
  }

  async recordIncomingMessage(chatId, senderId, messageText) {
    await this.chatRepository.setLastMessage(chatId, messageText);
    await this.chatRepository.incrementUnreadForOthers(chatId, senderId);
  }

  async updateSettings(chatId, data) {
    const allowed = {};
    if ("allowMembersToViewProfile" in data) allowed.allowMembersToViewProfile = data.allowMembersToViewProfile;
    if ("enableAIAnswer" in data) allowed.enableAIAnswer = data.enableAIAnswer;
    if ("lockSettings" in data) allowed.lockSettings = data.lockSettings;
    if ("simpleModeOn" in data) allowed.simpleModeOn = data.simpleModeOn;
    if ("groupName" in data) allowed.groupName = data.groupName;
    if ("groupImage" in data) allowed.groupImage = data.groupImage;

    return this.chatRepository.updateChat(chatId, allowed);
  }

  async deleteChat(chatId) {
    return this.chatRepository.deleteChat(chatId);
  }
}

module.exports = ChatService;
