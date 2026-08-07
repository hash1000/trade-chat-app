const jwt = require("jsonwebtoken");
const ChatRepository = require("../repositories/ChatRepository");
const chatRepository = new ChatRepository();

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

// Tracks how many live sockets each user currently has open (multiple
// tabs/devices count as one "online" user — we only flip to offline when
// the last socket disconnects, not on every tab close).
const onlineCounts = new Map();

// True if chat-<chatId> currently has a connected socket belonging to
// someone other than `userId` — i.e. there's actually an audience for the
// presence event. Uses Socket.IO's own room membership, no DB query.
function hasOtherLiveMember(io, chatId, userId) {
  const room = io.sockets.adapter.rooms.get(`chat-${chatId}`);
  if (!room || room.size === 0) return false;
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId !== userId) return true;
  }
  return false;
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
  chatIds.forEach((chatId) => {
    if (hasOtherLiveMember(io, chatId, userId)) {
      console.log(`[presence] emitting ${event} into chat-${chatId} (has live audience)`);
      io.to(`chat-${chatId}`).emit(event, { userId, chatId, memberStatus });
    } else {
      console.log(`[presence] SKIPPED chat-${chatId} (no live audience)`);
    }
  });
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

    // First socket for this user -> they just came online.
    const priorCount = onlineCounts.get(socket.userId) || 0;
    onlineCounts.set(socket.userId, priorCount + 1);
    if (priorCount === 0) {
      broadcastStatus(io, socket.userId, "online").catch((err) =>
        console.error(`online broadcast failed for user ${socket.userId}:`, err)
      );
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

    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected (${reason})`);

      // Last socket for this user -> they just went offline.
      const remaining = (onlineCounts.get(socket.userId) || 1) - 1;
      if (remaining <= 0) {
        onlineCounts.delete(socket.userId);
        broadcastStatus(io, socket.userId, "offline").catch((err) =>
          console.error(`offline broadcast failed for user ${socket.userId}:`, err)
        );
      } else {
        onlineCounts.set(socket.userId, remaining);
      }
    });
  });
}

module.exports = initChatSocket;
