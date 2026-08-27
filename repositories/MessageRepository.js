// repositories/MessageRepository.js
const { Op } = require("sequelize");
const {
  Message,
  MessageRead,
  MessageDelete,
  MessageMention,
  User,
  PaymentRequest,
  Order,
  Address,
  BankAccount,
  ShortList,
  Ledger,
} = require("../models");

const USER_ATTRIBUTES = [
  "id",
  "firstName",
  "lastName",
  "username",
  "phoneNumber",
  "profilePic",
];

class MessageRepository {
  buildDetailIncludes() {
    return [
      { model: User, as: "sender", attributes: USER_ATTRIBUTES },
      { model: User, as: "contactCard", attributes: USER_ATTRIBUTES },
      {
        model: Message,
        as: "replyToMessage",
        attributes: ["id", "message", "messageType", "senderId"],
        include: [{ model: User, as: "sender", attributes: ["id", "firstName", "lastName"] }],
      },
      { model: PaymentRequest, as: "paymentRequest" },
      { model: Order, as: "order", attributes: ["id", "status"] },
      { model: Address, as: "address" },
      { model: BankAccount, as: "bankAccount" },
      { model: ShortList, as: "shortList" },
      { model: Ledger, as: "balanceSheet" },
      {
        model: MessageRead,
        as: "reads",
        attributes: ["userId", "seenAt"],
      },
      {
        model: MessageDelete,
        as: "deletes",
        attributes: ["userId", "isDeleteAll"],
      },
      {
        model: MessageMention,
        as: "mentions",
        include: [{ model: User, as: "user", attributes: USER_ATTRIBUTES }],
      },
    ];
  }

  async findByLocalId(chatId, senderId, localId) {
    if (!localId) return null;
    return Message.findOne({
      where: { chatId, senderId, localId },
      include: this.buildDetailIncludes(),
    });
  }

  async create(data, mentionUserIds = []) {
    const message = await Message.create(data);

    if (mentionUserIds.length > 0) {
      await MessageMention.bulkCreate(
        [...new Set(mentionUserIds)].map((userId) => ({ messageId: message.id, userId }))
      );
    }

    // Sending a message counts as having seen it — the sender wrote it,
    // there's no "unread" state for your own message.
    await MessageRead.create({
      messageId: message.id,
      userId: data.senderId,
      seenAt: new Date(),
    });

    return this.findByPk(message.id);
  }

  async findByPk(id) {
    return Message.findByPk(id, { include: this.buildDetailIncludes() });
  }

  // The message that carries a given payment request, so accepting/rejecting
  // it can push a "message updated" broadcast into the right chat room.
  async findByPaymentRequestId(paymentRequestId) {
    return Message.findOne({
      where: { paymentRequestId },
      include: this.buildDetailIncludes(),
    });
  }

  // Most recent message in a chat, full shape (not just the lastMessage
  // preview string stored on Chat). id DESC as a tiebreaker — see the
  // ordering note on findForChat below.
  async findLatestForChat(chatId) {
    return Message.findOne({
      where: { chatId },
      include: this.buildDetailIncludes(),
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });
  }

  // Paginated history, newest-first page order but chronological within
  // the page (typical chat-scroll shape). excludeDeletedFor hides messages
  // the requesting user has deleted for themselves.
  async findForChat(chatId, { page = 1, pageSize = 30, excludeDeletedFor } = {}) {
    const offset = (page - 1) * pageSize;

    let excludeIds = [];
    if (excludeDeletedFor) {
      const deletedRows = await MessageDelete.findAll({
        where: { userId: excludeDeletedFor },
        include: [{ model: Message, as: "message", attributes: ["chatId"], where: { chatId } }],
        attributes: ["messageId"],
      });
      excludeIds = deletedRows.map((r) => r.messageId);
    }

    const where = { chatId };
    if (excludeIds.length > 0) {
      where.id = { [Op.notIn]: excludeIds };
    }

    const { count, rows } = await Message.findAndCountAll({
      where,
      include: this.buildDetailIncludes(),
      // id as a tiebreaker: createdAt is a DATETIME (second precision), so
      // two messages sent within the same second would otherwise sort
      // non-deterministically.
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: pageSize,
      offset,
      distinct: true,
    });

    return {
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
      messages: rows.reverse(), // chronological ascending for rendering
    };
  }

  async markSeen(messageIds, userId) {
    if (messageIds.length === 0) return;

    // Filter to ids that actually exist first — messageId has a hard FK to
    // messages.id, so one stale/wrong id in the batch would otherwise throw
    // a SequelizeForeignKeyConstraintError and make Promise.all reject the
    // whole batch, silently dropping the valid ids along with it.
    const existing = await Message.findAll({
      where: { id: { [Op.in]: messageIds } },
      attributes: ["id"],
    });
    const validIds = existing.map((m) => m.id);
    if (validIds.length === 0) return;

    const seenAt = new Date();
    await Promise.all(
      validIds.map((messageId) =>
        MessageRead.findOrCreate({
          where: { messageId, userId },
          defaults: { messageId, userId, seenAt },
        })
      )
    );
  }

  async markDeleted(messageId, userId, isDeleteAll = false) {
    const [row] = await MessageDelete.findOrCreate({
      where: { messageId, userId },
      defaults: { messageId, userId, isDeleteAll },
    });
    if (row.isDeleteAll !== isDeleteAll) {
      row.isDeleteAll = isDeleteAll;
      await row.save();
    }
    return row;
  }

  // Soft-deletes every existing message in a chat for one user only — used
  // when the chat itself is deleted "for me" (see ChatService.deleteChatForUser).
  // isDeleteAll: false because this only ever hides messages for THIS user,
  // same meaning the flag already has on the single-message delete endpoint.
  // ignoreDuplicates skips messages this user already deleted individually
  // (the unique (messageId, userId) index on message_deletes would otherwise
  // reject them).
  async markAllDeletedForChat(chatId, userId) {
    const messages = await Message.findAll({ where: { chatId }, attributes: ["id"] });
    if (messages.length === 0) return;
    await MessageDelete.bulkCreate(
      messages.map((m) => ({ messageId: m.id, userId, isDeleteAll: false })),
      { ignoreDuplicates: true }
    );
  }

  async setUploaded(messageId, uploadingPercentage = 100) {
    const [count] = await Message.update(
      { isUploading: false, uploadingPercentage },
      { where: { id: messageId } }
    );
    if (count === 0) return null;
    return this.findByPk(messageId);
  }

  async updateText(messageId, message) {
    const [count] = await Message.update(
      { message, isEdit: true },
      { where: { id: messageId } }
    );
    if (count === 0) return null;
    return this.findByPk(messageId);
  }

  async getUnreadCountForUser(chatId, userId, lastReadAt) {
    return Message.count({
      where: {
        chatId,
        senderId: { [Op.ne]: userId },
        createdAt: lastReadAt ? { [Op.gt]: lastReadAt } : { [Op.ne]: null },
      },
    });
  }
}

module.exports = MessageRepository;
