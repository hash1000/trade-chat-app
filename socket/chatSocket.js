const ChatRepository = require("../repositories/ChatRepository");
const ChatService = require("../services/ChatService");
const MessageService = require("../services/MessageService");
const { authenticateSocket } = require("../middlewares/socketAuth");
const chatRepository = new ChatRepository();
const chatService = new ChatService();
const messageService = new MessageService();

// Online/offline presence lives in socket/userSocket.js now — it's a
// global fact about a user, not something this (chat-scoped) module needs
// to know about. See that file for the connect/disconnect handling.

function initChatSocket(io) {
  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    // Personal room for user-targeted events (e.g. "added to a new chat").
    socket.join(`user-${socket.userId}`);
    console.log(`Socket ${socket.id} connected for user ${socket.userId}`);

    // Auto-join every chat this user is already part of, Firebase/Stream
    // style: "connected" and "subscribed to your conversations" are the
    // same event, instead of requiring a separate "join chat room" call
    // per conversation before typing/message events reach the client.
    // Only covers chats that exist at connect time — see
    // config/socket.js's joinUsersToChat for chats created afterward.
    try {
      const chatIds = await chatRepository.getUserChatIds(socket.userId);
      chatIds.forEach((chatId) => socket.join(`chat-${chatId}`));
    } catch (err) {
      console.error(`Auto-join failed for user ${socket.userId}:`, err);
    }

    socket.on("join chat room", async (payload, callback) => {
      const chatId = Number(
        payload && typeof payload === "object" ? payload.chatId : payload
      );

      if (!Number.isInteger(chatId) || chatId <= 0) {
        if (typeof callback === "function") callback({ error: "Invalid chatId" });
        return;
      }

      try {
        if (!(await chatRepository.isParticipant(chatId, socket.userId))) {
          if (typeof callback === "function") {
            callback({ error: "Not a participant of this chat" });
          }
          return;
        }

        socket.join(`chat-${chatId}`);
        if (typeof callback === "function") callback({ joined: chatId });
      } catch (err) {
        console.error("join chat room error:", err);
        if (typeof callback === "function") callback({ error: "Failed to join chat" });
      }
    });

    // Self-service join for an existing GROUP chat — e.g. landing here from
    // a scanned group QR code / invite link, with no admin or current
    // member having to add you first. Unlike "join chat room" above (which
    // only moves your socket into a room you're ALREADY a member of), this
    // actually creates your chat_members row too — see
    // ChatService.joinGroup. Rejected for a 1:1 "chat" (nothing to
    // self-join there — see the "convert chat to group" REST endpoint
    // instead, routes/chatRoutes.js). Re-emitting for a group you're
    // already in is a harmless no-op (no duplicate row, no second system
    // message), same idempotency as addMembers.
    socket.on("join group", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const chatId = Number(
        payload && typeof payload === "object" ? payload.chatId : payload
      );

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return ack({ error: "Invalid chatId" });
      }

      try {
        const chat = await chatService.joinGroup(chatId, socket.userId);
        // ChatService.joinGroup -> addMembers already calls
        // joinUsersToChat, which moves every socket this user currently
        // has open (this one included, via the user-<id> room from
        // connect) into chat-<chatId> — no separate socket.join needed here.
        ack({ chat: chatService.formatChat(chat, socket.userId) });
      } catch (err) {
        console.error("join group error:", err);
        ack({ error: err.message || "Failed to join group" });
      }
    });

    // One-shot existence + membership check — e.g. before opening a chat
    // screen, or to find out you were removed/the chat was deleted after
    // missing the live "message"/room-eviction that happens at the time
    // (see ChatService.removeMember / leaveChat).
    socket.on("check chat membership", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const chatId = Number(payload && payload.chatId);

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return ack({ error: "Invalid chatId" });
      }

      try {
        const exists = await chatRepository.exists(chatId);
        if (!exists) {
          return ack({ exists: false, isMember: false });
        }

        const isMember = await chatRepository.isParticipant(chatId, socket.userId);
        ack({ exists: true, isMember });
      } catch (err) {
        console.error("check chat membership error:", err);
        ack({ error: "Failed to check chat membership" });
      }
    });

    // Same data/shape as GET /api/chat/:chatId/messages (MessageService.
    // getHistory) — lets the client fetch a page of history without a
    // separate REST round-trip, e.g. right after "join chat room".
    socket.on("get messages", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const chatId = Number(payload && payload.chatId);
      const page = Math.max(1, parseInt(payload && payload.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(payload && payload.pageSize, 10) || 30));

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return ack({ error: "chatId is required" });
      }

      try {
        if (!(await chatRepository.isParticipant(chatId, socket.userId))) {
          return ack({ error: "Not a participant of this chat" });
        }

        const result = await messageService.getHistory(chatId, socket.userId, { page, pageSize });
        ack(result);
      } catch (err) {
        console.error("get messages error:", err);
        ack({ error: "Failed to fetch messages" });
      }
    });

    socket.on("leave chat room", (payload, callback) => {
      const chatId = Number(
        payload && typeof payload === "object" ? payload.chatId : payload
      );
      if (Number.isInteger(chatId) && chatId > 0) {
        socket.leave(`chat-${chatId}`);
      }
      if (typeof callback === "function") callback({ left: chatId });
    });

    socket.on("typing", async (payload) => {
      const chatId = Number(payload && payload.chatId);
      if (!Number.isInteger(chatId) || chatId <= 0) return;

      // socket.to() (not io.to()) excludes the sender — only the other
      // participant(s) see the indicator, never yourself.
      if (await chatRepository.isParticipant(chatId, socket.userId)) {
        socket.to(`chat-${chatId}`).emit("typing", {
          chatId,
          userId: socket.userId,
          isTyping: Boolean(payload.isTyping ?? true),
        });
      }
    });

    // WhatsApp-style send: client emits with an optional client-generated
    // localId, server persists + acks back the real row (so the client can
    // flip "sending" -> "sent" and reconcile its optimistic local copy),
    // then broadcasts to everyone else in the room. A retried emit after a
    // dropped ack (same localId) returns the already-created row instead
    // of creating a duplicate — see MessageRepository.findByLocalId.
    socket.on("send message", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const chatId = Number(payload && payload.chatId);

      if (!Number.isInteger(chatId) || chatId <= 0) {
        return ack({ error: "Invalid chatId" });
      }

      try {
        if (!(await chatRepository.isParticipant(chatId, socket.userId))) {
          return ack({ error: "Not a participant of this chat" });
        }

        const { message, isDuplicate } = await messageService.sendMessage(
          chatId,
          socket.userId,
          payload || {}
        );
        const formatted = messageService.formatMessage(message, socket.userId);

        ack({ message: formatted });

        // Don't re-broadcast a duplicate retry — everyone already got it
        // the first time this localId was sent.
        if (!isDuplicate) {
          socket.to(`chat-${chatId}`).emit("message", formatted);
        }
      } catch (err) {
        console.error("send message error:", err);
        ack({ error: "Failed to send message" });
      }
    });

    // Re-sends an existing message (verbatim content, isForward force-set to
    // 1) into one or more chats at once. Requires access to the source
    // message (participant of its chat, not deleted-for-you) plus
    // participancy in each target chat — see MessageService.forwardMessage.
    // One "message" broadcast per successful target, same as a normal send;
    // a target you're not a member of just comes back with its own `error`
    // in the ack instead of failing the whole call.
    socket.on("forward message", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const messageId = Number(payload && payload.messageId);
      const chatIds = Array.isArray(payload && payload.chatIds)
        ? payload.chatIds.map(Number)
        : [Number(payload && payload.chatId)];

      if (!Number.isInteger(messageId) || messageId <= 0) {
        return ack({ error: "Invalid messageId" });
      }
      if (chatIds.length === 0 || chatIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        return ack({ error: "Invalid chatIds" });
      }

      try {
        const results = await messageService.forwardMessage(messageId, socket.userId, chatIds);

        results.forEach(({ chatId, message }) => {
          if (message) socket.to(`chat-${chatId}`).emit("message", message);
        });

        ack({ results });
      } catch (err) {
        console.error("forward message error:", err);
        ack({ error: err.message || "Failed to forward message" });
      }
    });

    // Client edits the text of their own message. Text-only — media/contact/
    // payment/reference messages have no editable caption, so the type check
    // lives in MessageService.editMessage. Ownership check doubles as the
    // participant check: only a chat member could have sent it originally.
    socket.on("edit message", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const messageId = Number(payload && payload.messageId);
      const text = payload && typeof payload.message === "string" ? payload.message.trim() : "";

      if (!Number.isInteger(messageId) || messageId <= 0 || !text) {
        return ack({ error: "messageId and message are required" });
      }

      try {
        const updated = await messageService.editMessage(messageId, socket.userId, text);
        const formatted = messageService.formatMessage(updated, socket.userId);

        ack({ message: formatted });

        // io.to() (not socket.to()) — same "message updated" convention as
        // markUploaded/payment accept-reject: reaches the editor's own other
        // tabs too, not just other participants.
        io.to(`chat-${formatted.chat_id}`).emit("message updated", formatted);
      } catch (err) {
        console.error("edit message error:", err);
        ack({ error: err.message || "Failed to edit message" });
      }
    });

    // Client deletes a message either "for me" (hides it only from their
    // own history/devices — default) or "for everyone" via isDeleteAll:true,
    // a WhatsApp-style recall restricted to the sender that hides it from
    // every participant at once. Ownership/participant checks live in
    // MessageService (deleteForMe / deleteForEveryone), same split REST uses.
    socket.on("delete message", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const messageId = Number(payload && payload.messageId);
      const isDeleteAll = Boolean(payload && payload.isDeleteAll);

      if (!Number.isInteger(messageId) || messageId <= 0) {
        return ack({ error: "messageId is required" });
      }

      try {
        const formatted = isDeleteAll
          ? await messageService.deleteForEveryone(messageId, socket.userId)
          : await messageService.deleteForMe(messageId, socket.userId);

        ack({ message: formatted });

        if (isDeleteAll) {
          // Recalled — everyone in the room just lost this message.
          io.to(`chat-${formatted.chat_id}`).emit("message deleted", formatted);
        } else {
          // Hidden for this user only — sync their OTHER tabs/devices;
          // nobody else in the chat is affected.
          io.to(`user-${socket.userId}`).emit("message deleted", formatted);
        }
      } catch (err) {
        console.error("delete message error:", err);
        ack({ error: err.message || "Failed to delete message" });
      }
    });

    // Client explicitly marks message(s) as read by them — the frontend
    // decides when that's true (e.g. scrolled into view), there's no
    // server-side auto-detection based on room membership. Accepts either
    // a single messageId or messageIds[]. Also resets this user's unread
    // counter on the chat (same effect as PUT /:id/read), and broadcasts
    // "message seen" so the sender's client can show a read receipt live
    // instead of having to re-fetch history.
    socket.on("mark message seen", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const chatId = Number(payload && payload.chatId);
      const messageIds = Array.isArray(payload && payload.messageIds)
        ? payload.messageIds
        : payload && payload.messageId
        ? [payload.messageId]
        : [];

      if (!Number.isInteger(chatId) || chatId <= 0 || messageIds.length === 0) {
        return ack({ error: "chatId and messageId/messageIds are required" });
      }

      try {
        if (!(await chatRepository.isParticipant(chatId, socket.userId))) {
          return ack({ error: "Not a participant of this chat" });
        }

        await messageService.markSeen(messageIds, socket.userId);
        await chatRepository.resetUnread(chatId, socket.userId);
        // resetUnread always sets this to exactly 0 — no extra query needed
        // to know the reader's new count.
        const unreadCount = 0;
        // Full latest message (not just Chat.lastMessage's preview string)
        // so the client can refresh its chat-list row / last-bubble render
        // from this one event instead of a separate fetch.
        const latestMessage = await messageService.getLatestFormatted(chatId, socket.userId);

        ack({ seen: messageIds, unreadCount, latestMessage });

        // io.to() (not socket.to()) — the reader's OTHER tabs should also
        // see this reflected, not just the sender. unreadCount here is the
        // READER's own count (userId), not the recipient's — everyone else
        // in the room only cares about their own badge, which this event
        // doesn't change. latestMessage is chat-wide (same for everyone),
        // unlike unreadCount.
        io.to(`chat-${chatId}`).emit("message seen", {
          chatId,
          messageIds,
          userId: socket.userId,
          unreadCount,
          latestMessage,
        });
      } catch (err) {
        console.error("mark message seen error:", err);
        ack({ error: "Failed to mark message(s) seen" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected (${reason})`);
      // Presence (online/offline) is handled in socket/userSocket.js's own
      // "disconnect" listener on this same socket — Socket.IO allows
      // multiple listeners per event, so that module doesn't need this
      // one to do anything on its behalf.
    });
  });
}

module.exports = initChatSocket;
