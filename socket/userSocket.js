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

// How long a counter survives with no heartbeat before Redis drops it on
// its own. Must comfortably outlast HEARTBEAT_INTERVAL_MS below (several
// missed beats' worth of slack for a slow tick, not just one).
const COUNTER_TTL_SECONDS = 90;
// How often each connected socket refreshes its user's counter TTL while
// still genuinely open.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
// How often the whole DB is swept for isOnline:true rows the Redis side no
// longer backs up.
const RECONCILE_INTERVAL_MS = 2 * 60 * 1000;

// Without this, an ungracefully killed process (crash, hard restart, `kill
// -9`, a droplet reboot) leaves every socket it owned uncounted forever —
// nothing ever runs their DECR, since the process never got to. The
// counter is then permanently wrong: stuck above 0 even though those
// sockets are long gone, so a real user's *actual* last device
// disconnecting never brings it down to 0, and they stay "online" forever.
// Giving the key a TTL, refreshed by a heartbeat only while a real socket
// is alive, means an orphaned counter just expires on its own within
// COUNTER_TTL_SECONDS instead of staying wrong indefinitely.
async function refreshCounterTtl(userId) {
  const key = onlineCountKey(userId);
  const refreshed = await redisClient.expire(key, COUNTER_TTL_SECONDS);
  if (refreshed === 0) {
    // EXPIRE is a no-op on a key that doesn't exist (e.g. it already
    // lapsed, or was cleared manually) — recreate it so this still-live
    // socket keeps counting correctly instead of silently going untracked.
    await redisClient.incr(key);
    await redisClient.expire(key, COUNTER_TTL_SECONDS);
  }
}

async function broadcastPresence(io, userId, isOnline, user) {
  const event = isOnline ? "user online" : "user offline";
  io.to(`presence-${userId}`).emit(event, {
    userId,
    isOnline,
    lastSeenAt: user && user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
  });
}

// Second line of defense, independent of any one socket's lifecycle: finds
// every user the DB says is online whose Redis counter has since
// disappeared (expired via the TTL above, or a pre-existing ghost from
// before this fix existed) and corrects them — flips isOnline false,
// stamps lastSeenAt, and tells any live watchers. Runs on a fixed
// interval, so a user stuck online this way is never wrong for longer
// than one sweep period, even if they never reconnect to trigger the
// per-socket disconnect path at all.
// Note for a multi-process deployment: every app server runs this
// independently (no leader election), so with N processes the same sweep
// — and, for any user actually found stale, the same DB write/broadcast —
// happens N times every RECONCILE_INTERVAL_MS. Harmless (idempotent,
// infrequent, cheap) but worth knowing if this ever needs to scale down.
async function reconcileStalePresence(io) {
  try {
    const onlineUserIds = await userRepository.getOnlineUserIds();
    await Promise.all(
      onlineUserIds.map(async (userId) => {
        const stillTracked = await redisClient.exists(onlineCountKey(userId));
        if (!stillTracked) {
          const user = await userRepository.setPresence(userId, false);
          await broadcastPresence(io, userId, false, user);
        }
      })
    );
  } catch (err) {
    console.error("presence reconcile sweep failed:", err);
  }
}

function initUserSocket(io) {
  io.use(authenticateSocket);

  // Runs once for the whole process, not per-connection. setInterval's own
  // delay before its first tick already gives a just-booted server's
  // clients time to finish reconnecting before the first sweep runs.
  setInterval(() => reconcileStalePresence(io), RECONCILE_INTERVAL_MS);

  io.on("connection", (socket) => {
    // First socket for this user across ALL processes -> they just came
    // online. INCR is atomic, so two servers handling this user's tabs
    // connecting at the same instant can't both see "I was the first".
    //
    // Split into two independent steps on purpose:
    //
    // 1) The DB write (`isOnline: true`) — unconditional, on EVERY connect,
    //    and not gated behind the Redis call at all. `watch user` (and
    //    `statusMembers` on chat responses) read this column directly, no
    //    Redis involved, so it must not be able to get silently stranded at
    //    `false` by anything Redis-related: a transient Redis outage would
    //    throw out of a combined incr+persist block before the persist ever
    //    ran, and a desynced counter (a killed dev build, a crashed client,
    //    a device that lost network without a clean socket close — any of
    //    which skip the matching DECRement on disconnect) means `newCount`
    //    is never 1 again for that user, ever, even though they keep
    //    genuinely reconnecting. Both were live bugs here: a real socket
    //    connection with a healthy DB write path still left `isOnline`
    //    stuck at `false` for `watch user` callers.
    // 2) The counter + broadcast — best-effort, gated on Redis being
    //    reachable. If it fails, the only thing degraded is *live push* to
    //    other watchers (they'll still get the correct state from their own
    //    next `watch user` ack) — the DB truth above is already correct
    //    regardless.
    (async () => {
      try {
        await userRepository.setPresence(socket.userId, true);
      } catch (err) {
        console.error(`presence persist(online) failed for user ${socket.userId}:`, err);
        return;
      }
      try {
        const newCount = await redisClient.incr(onlineCountKey(socket.userId));
        await redisClient.expire(onlineCountKey(socket.userId), COUNTER_TTL_SECONDS);
        if (newCount === 1) {
          await broadcastPresence(io, socket.userId, true, { lastSeenAt: null });
        }
      } catch (err) {
        console.error(`presence incr failed for user ${socket.userId}:`, err);
      }
    })();

    // Keeps this user's counter TTL alive for as long as this socket
    // genuinely stays open. Stops the moment the socket disconnects (see
    // below) — so if the whole process dies instead, nothing refreshes it
    // anymore and it simply expires on schedule.
    const heartbeat = setInterval(() => {
      refreshCounterTtl(socket.userId).catch((err) =>
        console.error(`presence heartbeat failed for user ${socket.userId}:`, err)
      );
    }, HEARTBEAT_INTERVAL_MS);

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
      clearInterval(heartbeat);

      // Last socket for this user across ALL processes -> they just went
      // offline. DECR is atomic; clamp at 0 so a Redis restart or a missed
      // INCR can't leave the counter permanently negative.
      //
      // Unlike the connect path above, the DB write here stays gated on
      // Redis confirming this really was the last socket — going offline
      // too early (multi-tab, one tab closing) is the wrong direction to
      // default-favor. If Redis itself is unreachable there's genuinely no
      // safe way to know whether other sockets for this user are still
      // open, so this degrades to "stays online until the next successful
      // disconnect or reconnect resolves it, or the periodic reconcile
      // sweep catches it" rather than guessing.
      try {
        const remaining = await redisClient.decr(onlineCountKey(socket.userId));
        if (remaining <= 0) {
          await redisClient.del(onlineCountKey(socket.userId));
          const user = await userRepository.setPresence(socket.userId, false);
          await broadcastPresence(io, socket.userId, false, user);
        }
      } catch (err) {
        console.error(`presence decr failed for user ${socket.userId}:`, err);
      }
    });
  });
}

module.exports = initUserSocket;
