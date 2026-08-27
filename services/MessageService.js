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
      // Media messages (image/video/audio/file) carry no caption — plain.message
      // is null for them. Fall back to the mediaUrl so top-level "message"
      // is never empty for a client that only reads this field (the full
      // { type, mediaUrl, thumbnailUrl } shape is still available at media
      // below for anything that wants it structured).
      message: plain.message || plain.mediaUrl || null,
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
      // Flat list of userIds this message is currently hidden from. "Delete
      // for me" adds just the caller's own id; "delete for everyone" adds
      // every chat member's id at once (see deleteForEveryone), so a client
      // can tell "recalled for all" apart from "I deleted it locally" by
      // comparing this list's length against the chat's member count.
      deleteMessagePersonsIds: deletes.map((d) => d.userId),

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
    // Revives this chat for anyone who'd soft-deleted it "for me" — their
    // older history stays hidden, but the chat reappears in their list and
    // this message (and any after it) is visible. See ChatService.deleteChatForUser.
    await this.chatRepository.clearDeleteAllForOthers(chatId, senderId);

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

  // "Delete for me" — any participant can hide a message from just their
  // own history/devices, including ones they didn't send. Participant check
  // lives here (not the transport layer) so REST and the "delete message"
  // socket event enforce it identically.
  async deleteForMe(messageId, userId) {
    const message = await this.messageRepository.findByPk(messageId);
    if (!message) {
      const err = new Error("Message not found.");
      err.statusCode = 404;
      throw err;
    }
    if (!(await this.chatRepository.isParticipant(message.chatId, userId))) {
      const err = new Error("Not a participant of this chat.");
      err.statusCode = 403;
      throw err;
    }

    await this.messageRepository.markDeletedForMe(messageId, userId);
    return this.getByIdFormatted(messageId, userId);
  }

  // "Delete for everyone" (recall) — sender-only, same ownership rule as
  // editMessage. Fans a delete row out to every chat member at once, so the
  // message disappears from everyone's history immediately instead of only
  // the caller's — WhatsApp/Telegram-style recall.
  async deleteForEveryone(messageId, userId) {
    const message = await this.messageRepository.findByPk(messageId);
    if (!message) {
      const err = new Error("Message not found.");
      err.statusCode = 404;
      throw err;
    }
    if (message.senderId !== userId) {
      const err = new Error("You can only delete your own messages for everyone.");
      err.statusCode = 403;
      throw err;
    }

    const memberIds = await this.chatRepository.getMemberIds(message.chatId);
    await this.messageRepository.markDeletedForAll(messageId, memberIds);
    return this.getByIdFormatted(messageId, userId);
  }

  async markUploaded(messageId, uploadingPercentage = 100) {
    return this.messageRepository.setUploaded(messageId, uploadingPercentage);
  }

  // Text messages only — media/contact/payment/reference messages carry no
  // editable "message" body of their own (a caption isn't supported), so
  // editing them isn't a meaningful operation. Use delete-for-me instead.
  async editMessage(messageId, userId, newText) {
    const message = await this.messageRepository.findByPk(messageId);
    if (!message) {
      const err = new Error("Message not found.");
      err.statusCode = 404;
      throw err;
    }
    if (message.senderId !== userId) {
      const err = new Error("You can only edit your own messages.");
      err.statusCode = 403;
      throw err;
    }
    if (message.messageType !== "text") {
      const err = new Error("Only text messages can be edited.");
      err.statusCode = 400;
      throw err;
    }
    const text = (newText || "").trim();
    if (!text) {
      const err = new Error("message is required.");
      err.statusCode = 400;
      throw err;
    }

    return this.messageRepository.updateText(messageId, text);
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
