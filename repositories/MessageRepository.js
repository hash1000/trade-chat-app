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
      {
        model: PaymentRequest,
        as: "paymentRequest",
        // Only what formatPayment() reads — the table also carries wallet/
        // transaction bookkeeping columns nothing here needs.
        attributes: [
          "id", "amount", "currency", "description", "status", "kind",
          "requesterId", "requesteeId", "createdAt", "updatedAt",
        ],
      },
      { model: Order, as: "order", attributes: ["id", "status"] },
      {
        model: Address,
        as: "address",
        attributes: ["id", "companyName", "firstName", "lastName", "country", "city", "street", "postalCode"],
      },
      {
        model: BankAccount,
        as: "bankAccount",
        attributes: ["id", "accountName", "bank_name", "iban", "swift_code", "accountNo", "accountCurrency"],
      },
      { model: ShortList, as: "shortList", attributes: ["id", "title", "type", "description"] },
      { model: Ledger, as: "balanceSheet", attributes: ["id", "title", "description", "archived"] },
      // separate: true — reads/deletes/mentions are all hasMany on Message.
      // Joining 3+ hasMany associations into one query multiplies rows
      // (cartesian product: N reads x M deletes x K mentions per message),
      // which Sequelize then has to deduplicate in JS after transferring
      // every combination over the wire. separate:true instead issues one
      // extra lightweight "WHERE messageId IN (...)" query per association,
      // which is far cheaper for a page of 30-50 messages in an active chat.
      {
        model: MessageRead,
        as: "reads",
        attributes: ["userId", "seenAt"],
        separate: true,
      },
      {
        model: MessageDelete,
        as: "deletes",
        attributes: ["userId", "isDeleteAll"],
        separate: true,
      },
      {
        model: MessageMention,
        as: "mentions",
        separate: true,
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
        raw: true,
      });
      excludeIds = deletedRows.map((r) => r.messageId);
    }

    const where = { chatId };
    if (excludeIds.length > 0) {
      where.id = { [Op.notIn]: excludeIds };
    }

    // id as a tiebreaker: createdAt is a DATETIME (second precision), so two
    // messages sent within the same second would otherwise sort
    // non-deterministically.
    const order = [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ];

    // Plain Message.count() (no includes) run alongside the detailed page
    // fetch, instead of findAndCountAll's combined query — now that
    // buildDetailIncludes() has no hasMany joins left (separate: true on
    // reads/deletes/mentions), there's nothing left that could multiply
    // rows, so a distinct-aware combined count buys nothing but still costs
    // an extra JOIN plan on every call.
    const [count, rows] = await Promise.all([
      Message.count({ where }),
      Message.findAll({
        where,
        include: this.buildDetailIncludes(),
        order,
        limit: pageSize,
        offset,
      }),
    ]);

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

  // "Delete for me" — hides the message from just this one user. A single
  // row; everyone else's view is untouched.
  async markDeletedForMe(messageId, userId) {
    await MessageDelete.findOrCreate({
      where: { messageId, userId },
      defaults: { messageId, userId, isDeleteAll: false },
    });
  }

  // "Delete for everyone" (recall) — one row per chat member, so the
  // message disappears from every participant's history at once, not just
  // the caller's. ignoreDuplicates skips anyone who'd already deleted it
  // for themselves individually (the unique (messageId, userId) index would
  // otherwise reject them) — they're already hidden from it either way.
  async markDeletedForAll(messageId, memberUserIds) {
    if (memberUserIds.length === 0) return;
    await MessageDelete.bulkCreate(
      memberUserIds.map((userId) => ({ messageId, userId, isDeleteAll: true })),
      { ignoreDuplicates: true }
    );
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

  // Bulk version of markDeletedForAll — recalls every existing message in a
  // chat for every member at once (one row per message x member), instead
  // of one message at a time. Used by ChatService.recallAllMessagesForEveryone
  // (admin-only "recall all"). Returns the affected message ids so the
  // caller can broadcast which ones just disappeared.
  async markAllDeletedForEveryone(chatId, memberUserIds) {
    if (memberUserIds.length === 0) return [];

    const messages = await Message.findAll({ where: { chatId }, attributes: ["id"] });
    if (messages.length === 0) return [];

    const rows = [];
    for (const { id: messageId } of messages) {
      for (const userId of memberUserIds) {
        rows.push({ messageId, userId, isDeleteAll: true });
      }
    }
    await MessageDelete.bulkCreate(rows, { ignoreDuplicates: true });

    return messages.map((m) => m.id);
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

  // Breaks every in-chat reply link before a hard delete of the chat.
  // replyToMessageId references messages.id with no ON DELETE CASCADE (see
  // the create-messages migration), so a message that's a reply target
  // would otherwise throw a FK constraint error mid-cascade when its own
  // row gets deleted along with the rest of the chat.
  async clearRepliesForChat(chatId, t) {
    await Message.update(
      { replyToMessageId: null },
      { where: { chatId }, transaction: t }
    );
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
