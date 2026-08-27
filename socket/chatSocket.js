const jwt = require("jsonwebtoken");
const ChatRepository = require("../repositories/ChatRepository");
const MessageService = require("../services/MessageService");
const { redisClient } = require("../config/redis");
const chatRepository = new ChatRepository();
const messageService = new MessageService();

// Redis key for "how many sockets does this user have open, across every
// server process" — a plain in-memory Map only sees the sockets connected
// to this one process, which is wrong the moment there's more than one app
// server behind the load balancer.
const onlineCountKey = (userId) => `presence:online-count:${userId}`;

// Mirrors middlewares/authenticate.js, but reads the token from the
// Socket.IO handshake instead of an Express header. Accepts either
// auth.token (preferred) or an Authorization header, for clients that
// reuse their REST setup.
function readToken(socket) {
  const fromAuth = socket.handshake.auth && socket.handshake.auth.token;
  if (fromAuth) {
    return String(fromAuth).replace(/^Bearer /, "");
  }
  const header = socket.handshake.headers && socket.handshake.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.substring(7);
  }
  return null;
}

function authenticateSocket(socket, next) {
  const token = readToken(socket);
  if (!token) {
    return next(new Error("Missing token"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (!decoded || !decoded.userId) {
      return next(new Error("Invalid or expired token"));
    }
    socket.userId = Number(decoded.userId);
    return next();
  } catch (err) {
    return next(new Error("Invalid or expired token"));
  }
}

// True if chat-<chatId> currently has a connected socket belonging to
// someone other than `userId`, on ANY server process — i.e. there's
// actually an audience for the presence event. fetchSockets() is the
// Redis-adapter-aware, cross-process version of room membership; the
// plain io.sockets.adapter.rooms map only sees sockets on this process.
async function hasOtherLiveMember(io, chatId, userId) {
  const sockets = await io.in(`chat-${chatId}`).fetchSockets();
  return sockets.some((s) => s.userId !== userId);
}

async function broadcastStatus(io, userId, memberStatus) {
  // Always persist across every chat — statusMembers over REST must be
  // accurate regardless of who's currently connected to see it live.
  const chatIds = await chatRepository.setStatusForAllChats(userId, memberStatus);

  // But only emit into rooms someone is actually watching right now — a
  // user with thousands of chats shouldn't fan out thousands of no-op
  // emits into empty rooms on every connect/disconnect. WhatsApp-style:
  // presence is pushed to active viewers, not broadcast to every chat you
  // have.
  const event = memberStatus === "online" ? "user online" : "user offline";
  await Promise.all(
    chatIds.map(async (chatId) => {
      if (await hasOtherLiveMember(io, chatId, userId)) {
        console.log(`[presence] emitting ${event} into chat-${chatId} (has live audience)`);
        io.to(`chat-${chatId}`).emit(event, { userId, chatId, memberStatus });
      } else {
        console.log(`[presence] SKIPPED chat-${chatId} (no live audience)`);
      }
    })
  );
}

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

    // First socket for this user across ALL processes -> they just came
    // online. INCR is atomic, so two servers handling this user's tabs
    // connecting at the same instant can't both see "I was the first".
    try {
      const newCount = await redisClient.incr(onlineCountKey(socket.userId));
      if (newCount === 1) {
        broadcastStatus(io, socket.userId, "online").catch((err) =>
          console.error(`online broadcast failed for user ${socket.userId}:`, err)
        );
      }
    } catch (err) {
      console.error(`presence incr failed for user ${socket.userId}:`, err);
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

    socket.on("disconnect", async (reason) => {
      console.log(`Socket ${socket.id} disconnected (${reason})`);

      // Last socket for this user across ALL processes -> they just went
      // offline. DECR is atomic; clamp at 0 so a Redis restart or a missed
      // INCR can't leave the counter permanently negative.
      try {
        const remaining = await redisClient.decr(onlineCountKey(socket.userId));
        if (remaining <= 0) {
          await redisClient.del(onlineCountKey(socket.userId));
          broadcastStatus(io, socket.userId, "offline").catch((err) =>
            console.error(`offline broadcast failed for user ${socket.userId}:`, err)
          );
        }
      } catch (err) {
        console.error(`presence decr failed for user ${socket.userId}:`, err);
      }
    });
  });
}

module.exports = initChatSocket;
