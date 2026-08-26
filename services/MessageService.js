// services/MessageService.js
const MessageRepository = require("../repositories/MessageRepository");
const ChatRepository = require("../repositories/ChatRepository");
const NotificationService = require("./NotificationService");

class MessageService {
  constructor() {
    this.messageRepository = new MessageRepository();
    this.chatRepository = new ChatRepository();
    this.notificationService = new NotificationService();
  }

  formatUserRef(user) {
    if (!user) return null;
    return {
      memberId: user.id,
      memberName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      memberImage: user.profilePic || null,
      memberPhone: user.phoneNumber || null,
    };
  }

  // --- nested sub-objects -------------------------------------------

  formatMedia(plain) {
    if (!plain.mediaUrl && !plain.thumbnailUrl) return null;
    return {
      type: plain.messageType,
      mediaUrl: plain.mediaUrl,
      thumbnailUrl: plain.thumbnailUrl,
    };
  }

  formatContact(plain) {
    if (!plain.contactCardId) return null;
    const user = plain.contactCard;
    return {
      contactCardId: plain.contactCardId,
      contactCardName: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : null,
      contactCardImage: user ? user.profilePic : null,
      contactCardPhone: user ? user.phoneNumber : null,
    };
  }

  formatReply(plain) {
    if (!plain.replyToMessageId) return null;
    const parent = plain.replyToMessage;
    return {
      parentMessageId: plain.replyToMessageId,
      parentMessage: parent ? parent.message : null,
      replyType: parent ? parent.messageType : null,
      replyerId: parent ? parent.senderId : 0,
      replyerName: parent && parent.sender
        ? [parent.sender.firstName, parent.sender.lastName].filter(Boolean).join(" ")
        : "",
    };
  }

  // "direct" payments (sent via sendPayment) are already-completed transfers,
  // so their type flips per viewer: the payer sees paymentSend, the payee
  // sees paymentReceived. "request" payments (sendPaymentRequest) are always
  // paymentRequest for both sides — status (pending/accepted/rejected) is
  // what changes as the requestee acts on it.
  formatPayment(plain, viewerUserId) {
    const p = plain.paymentRequest;
    if (!p) return null;
    const type =
      p.kind === "direct"
        ? viewerUserId === p.requesterId
          ? "paymentSend"
          : "paymentReceived"
        : "paymentRequest";
    return {
      paymentRequestId: p.id,
      amount: p.amount,
      currency: p.currency,
      note: p.description,
      status: p.status,
      type,
      requesterId: p.requesterId,
      requesteeId: p.requesteeId,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
    };
  }

  // Reference attachments — snapshot-only, no side effects (§ order,
  // address, bankCard, shortList, balanceSheet).
  formatOrder(plain) {
    if (!plain.order) return null;
    return { orderId: plain.order.id, status: plain.order.status };
  }

  formatAddress(plain) {
    if (!plain.address) return null;
    const a = plain.address;
    return {
      addressId: a.id,
      companyName: a.companyName,
      firstName: a.firstName,
      lastName: a.lastName,
      country: a.country,
      city: a.city,
      street: a.street,
      postalCode: a.postalCode,
    };
  }

  formatBankCard(plain) {
    if (!plain.bankAccount) return null;
    const b = plain.bankAccount;
    return {
      bankAccountId: b.id,
      accountName: b.accountName,
      bankName: b.bank_name,
      iban: b.iban,
      swiftCode: b.swift_code,
      accountNo: b.accountNo,
      accountCurrency: b.accountCurrency,
    };
  }

  formatShortList(plain) {
    if (!plain.shortList) return null;
    const s = plain.shortList;
    return { shortListId: s.id, title: s.title, type: s.type, description: s.description };
  }

  formatBalanceSheet(plain) {
    if (!plain.balanceSheet) return null;
    const l = plain.balanceSheet;
    return { ledgerId: l.id, title: l.title, description: l.description, archived: l.archived };
  }

  // --- top-level message ---------------------------------------------

  formatMessage(message, viewerUserId) {
    const plain = typeof message.get === "function" ? message.get({ plain: true }) : message;
    const sender = plain.sender || {};
    const reads = plain.reads || [];
    const deletes = plain.deletes || [];
    const mentions = plain.mentions || [];

    return {
      id: plain.id,
      chat_id: plain.chatId,
      message_sender_id: plain.senderId,
      message_sender_name: [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.username,
      message_sender_imageUrl: sender.profilePic || null,
      message_type: plain.messageType,
      message: plain.message,
      isForward: plain.isForward ? 1 : 0,
      isEdit: plain.isEdit ? 1 : 0,
      isUploading: plain.isUploading ? 1 : 0,
      uploadingPercentage: plain.uploadingPercentage,
      hashtags: plain.hashtags || [],
      created_at: plain.createdAt ? new Date(plain.createdAt).getTime() : null,
      updated_at: plain.updatedAt ? new Date(plain.updatedAt).getTime() : null,

      media: this.formatMedia(plain),
      contact: this.formatContact(plain),
      reply: this.formatReply(plain),
      payment: this.formatPayment(plain, viewerUserId),
      order: this.formatOrder(plain),
      address: this.formatAddress(plain),
      bankCard: this.formatBankCard(plain),
      shortList: this.formatShortList(plain),
      balanceSheet: this.formatBalanceSheet(plain),

      mention_members: mentions.map((m) => this.formatUserRef(m.user)),
      seenMessagePersons: reads.map((r) => r.userId),
      deleteMessagePersonsIds: deletes.map((d) => ({ userId: d.userId, isDeleteAll: d.isDeleteAll ? 1 : 0 })),

      isDeletedForViewer: deletes.some((d) => d.userId === viewerUserId),
    };
  }

  // --- writes ----------------------------------------------------------

  // De-dups on (chatId, senderId, localId): a retried "send message" after
  // a dropped ack returns the already-created row instead of a duplicate.
  async sendMessage(chatId, senderId, payload) {
    if (payload.localId) {
      const existing = await this.messageRepository.findByLocalId(chatId, senderId, payload.localId);
      if (existing) return { message: existing, isDuplicate: true };
    }

    const data = {
      chatId,
      senderId,
      localId: payload.localId || null,
      messageType: payload.messageType || "text",
      message: payload.message || null,
      isForward: !!payload.isForward,
      // Marked uploading on create for every message type; the client
      // clears it via markUploaded() once it's confirmed ready.
      isUploading: true,
      replyToMessageId: payload.replyToMessageId || null,
      contactCardId: payload.contactCardId || null,
      mediaUrl: payload.mediaUrl || null,
      thumbnailUrl: payload.thumbnailUrl || null,
      thumbnailBlurHash: payload.thumbnailBlurHash || null,
      paymentRequestId: payload.paymentRequestId || null,
      orderId: payload.orderId || null,
      addressId: payload.addressId || null,
      bankAccountId: payload.bankAccountId || null,
      shortListId: payload.shortListId || null,
      ledgerId: payload.ledgerId || null,
      hashtags: payload.hashtags || [],
    };

    const message = await this.messageRepository.create(data, payload.mentionUserIds || []);

    await this.chatRepository.setLastMessage(chatId, this.previewText(message));
    await this.chatRepository.incrementUnreadForOthers(chatId, senderId);

    // Fire-and-forget — never blocks or fails the send itself. Skipped for
    // duplicate localId retries by the caller (see chatSocket.js), same as
    // the "message" broadcast.
    this.notifyNewMessage(chatId, senderId, message).catch((err) =>
      console.error("notifyNewMessage error:", err.message)
    );

    return { message, isDuplicate: false };
  }

  // Pushes a notification (DB row + best-effort FCM) to every other chat
  // participant. NotificationService.notifyUser never throws, but this is
  // still wrapped by the caller as a belt-and-suspenders fire-and-forget.
  async notifyNewMessage(chatId, senderId, message) {
    // Called after incrementUnreadForOthers() in sendMessage(), so each
    // member's unreadCount here already reflects this new message.
    const recipients = await this.chatRepository.getOtherMembers(chatId, senderId);
    if (recipients.length === 0) return;

    const sender = message.sender || {};
    const senderName =
      [sender.firstName, sender.lastName].filter(Boolean).join(" ") ||
      sender.username ||
      "Someone";
    const preview = this.previewText(message);

    await Promise.all(
      recipients.map(({ userId, unreadCount }) =>
        this.notificationService.notifyUser({
          userId,
          actorId: senderId,
          type: "NEW_MESSAGE",
          title: senderName,
          message: preview,
          entityType: "CHAT",
          entityId: chatId,
          // Full message (viewer-specific — e.g. payment.type/isDeletedForViewer
          // depend on who's looking) plus this recipient's own up-to-date
          // unread count for the chat, so the client can open straight into
          // the thread and refresh its badge without a round-trip.
          data: {
            chatId,
            unreadCount,
            message: this.formatMessage(message, userId),
          },
        })
      )
    );
  }

  previewText(message) {
    if (message.message) return message.message;
    const typeLabels = {
      image: "📷 Photo",
      video: "🎥 Video",
      audio: "🎵 Audio",
      file: "📎 Attachment",
      contact: "👤 Contact",
      payment: "💳 Payment request",
      order: "🧾 Order",
      address: "📍 Address",
      bankCard: "🏦 Bank details",
      shortList: "📋 Checklist",
      balanceSheet: "📊 Balance sheet",
    };
    return typeLabels[message.messageType] || "";
  }

  async getHistory(chatId, viewerUserId, { page = 1, pageSize = 30 } = {}) {
    const result = await this.messageRepository.findForChat(chatId, {
      page,
      pageSize,
      excludeDeletedFor: viewerUserId,
    });
    return {
      ...result,
      messages: result.messages.map((m) => this.formatMessage(m, viewerUserId)),
    };
  }

  async markSeen(messageIds, userId) {
    await this.messageRepository.markSeen(messageIds, userId);
  }

  async deleteForMe(messageId, userId, isDeleteAll = false) {
    return this.messageRepository.markDeleted(messageId, userId, isDeleteAll);
  }

  async markUploaded(messageId, uploadingPercentage = 100) {
    return this.messageRepository.setUploaded(messageId, uploadingPercentage);
  }

  async getByIdFormatted(messageId, viewerUserId) {
    const message = await this.messageRepository.findByPk(messageId);
    if (!message) return null;
    return this.formatMessage(message, viewerUserId);
  }

  async getLatestFormatted(chatId, viewerUserId) {
    const message = await this.messageRepository.findLatestForChat(chatId);
    if (!message) return null;
    return this.formatMessage(message, viewerUserId);
  }

  // Used after accept/reject so the caller can broadcast the updated
  // payment bubble into the chat room without the client re-fetching.
  async getByPaymentRequestFormatted(paymentRequestId, viewerUserId) {
    const message = await this.messageRepository.findByPaymentRequestId(paymentRequestId);
    if (!message) return null;
    return this.formatMessage(message, viewerUserId);
  }
}

module.exports = MessageService;
