const { authenticateSocket } = require("../middlewares/socketAuth");
const { redisClient } = require("../config/redis");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();

// Presence — global, not chat-scoped (see docs/CHAT_SOCKET.md §3, "user
// online" / "user offline"). Deliberately its own module, separate from
// chatSocket.js: online/offline is a fact about a *user*, and computing
// "who should hear about it" used to mean scanning every chat this user
// belongs to (and every other member in each one) — expensive for an
// account sitting in thousands of chats. Now nobody is told unless they
// explicitly ask via "watch user", so there's no scan at all.

// Redis key for "how many sockets does this user have open, across every
// server process" — a plain in-memory Map only sees the sockets connected
// to this one process, which is wrong the moment there's more than one app
// server behind the load balancer.
const onlineCountKey = (userId) => `presence:online-count:${userId}`;

async function broadcastPresence(io, userId, isOnline) {
  const user = await userRepository.setPresence(userId, isOnline);
  const event = isOnline ? "user online" : "user offline";
  io.to(`presence-${userId}`).emit(event, {
    userId,
    isOnline,
    lastSeenAt: user && user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
  });
}

function initUserSocket(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    // First socket for this user across ALL processes -> they just came
    // online. INCR is atomic, so two servers handling this user's tabs
    // connecting at the same instant can't both see "I was the first".
    (async () => {
      try {
        const newCount = await redisClient.incr(onlineCountKey(socket.userId));
        if (newCount === 1) {
          await broadcastPresence(io, socket.userId, true);
        }
      } catch (err) {
        console.error(`presence incr failed for user ${socket.userId}:`, err);
      }
    })();

    // Subscribe to another user's live presence — call this when opening
    // their profile or a 1:1 chat with them, not for every chat member of
    // every group you're in. Ack returns their current state immediately
    // so the caller doesn't need a separate REST round-trip just to paint
    // the initial online dot.
    socket.on("watch user", async (payload, callback) => {
      const targetUserId = Number(
        payload && typeof payload === "object" ? payload.userId : payload
      );
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        if (typeof callback === "function") callback({ error: "Invalid userId" });
        return;
      }

      try {
        const user = await userRepository.getPresence(targetUserId);
        if (!user) {
          if (typeof callback === "function") callback({ error: "User not found" });
          return;
        }
        socket.join(`presence-${targetUserId}`);
        if (typeof callback === "function") {
          callback({
            userId: targetUserId,
            isOnline: !!user.isOnline,
            lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
          });
        }
      } catch (err) {
        console.error(`watch user failed for target ${targetUserId}:`, err);
        if (typeof callback === "function") callback({ error: "Failed to watch user" });
      }
    });

    // Stop receiving that user's presence updates — call this when leaving
    // their profile/chat screen. Not required on disconnect; Socket.IO
    // already drops a closed socket out of every room it was in.
    socket.on("unwatch user", (payload) => {
      const targetUserId = Number(
        payload && typeof payload === "object" ? payload.userId : payload
      );
      if (Number.isInteger(targetUserId) && targetUserId > 0) {
        socket.leave(`presence-${targetUserId}`);
      }
    });

    socket.on("disconnect", async () => {
      // Last socket for this user across ALL processes -> they just went
      // offline. DECR is atomic; clamp at 0 so a Redis restart or a missed
      // INCR can't leave the counter permanently negative.
      try {
        const remaining = await redisClient.decr(onlineCountKey(socket.userId));
        if (remaining <= 0) {
          await redisClient.del(onlineCountKey(socket.userId));
          await broadcastPresence(io, socket.userId, false);
        }
      } catch (err) {
        console.error(`presence decr failed for user ${socket.userId}:`, err);
      }
    });
  });
}

module.exports = initUserSocket;
