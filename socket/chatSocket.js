const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const Chat = require("../models/chat");
const ChatRepository = require("../repositories/ChatRepository");
const chatRepository = new ChatRepository();

// Mirrors middlewares/authenticate.js, but reads the token from the Socket.IO
// handshake instead of an Express header. Accepts either auth.token (preferred)
// or the Authorization header sent by clients that reuse their REST setup.
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

// A chat row is directional (user1Id/user2Id), so a participant may sit on
// either side. Without this check any authenticated client could join any
// chat-<id> room and read a conversation it is not part of.
async function isParticipant(chatId, userId) {
  const chat = await Chat.findOne({
    where: {
      id: chatId,
      [Op.or]: [{ user1Id: userId }, { user2Id: userId }],
    },
  });
  return Boolean(chat);
}

function initChatSocket(io) {
  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    // Personal room for user-targeted events (chat requests, invites).
    socket.join(`user-${socket.userId}`);
    console.log(`Socket ${socket.id} connected for user ${socket.userId}`);

    // Auto-join every chat this user is already part of, Firebase/Stream-style:
    // "connected" and "subscribed to your conversations" are the same event,
    // instead of requiring a separate "join chat room" call per conversation
    // before typing/message event will reach the client. Manual join/leave
    // below still work for chats created after this connection was opened.
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
        if (!(await isParticipant(chatId, socket.userId))) {
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

    socket.on("typing", async (payload) => {
      const chatId = Number(payload && payload.chatId);
      if (!Number.isInteger(chatId) || chatId <= 0) return;

      // socket.to() (not io.to()) excludes the sender - only the other
      // participant(s) see the indicator, never yourself.
      if (await isParticipant(chatId, socket.userId)) {
        socket.to(`chat-${chatId}`).emit("typing", {
          chatId,
          userId: socket.userId,
          isTyping: Boolean(payload.isTyping ?? true),
        });
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

    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected (${reason})`);
    });
  });
}

module.exports = initChatSocket;
