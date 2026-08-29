const { createAdapter } = require("@socket.io/redis-adapter")
const { redisOptions } = require("./redis")
const Redis = require("ioredis")

let io = null

module.exports = {
  // Store the Socket.IO server created in app.js. Do not create a new one here:
  // a second Server instance on the same httpServer would not share rooms.
  //
  // Attaches the Redis adapter so rooms (chat-<id>, user-<id>) and
  // broadcasts (io.to(), socket.to(), socketsJoin()) work correctly across
  // multiple server processes, not just within the process that owns a
  // given socket. Without this, two app servers behind a load balancer
  // would each have their own private room registry — a message sent by a
  // user connected to server 1 would never reach a recipient connected to
  // server 2.
  init: (ioInstance) => {
    io = ioInstance

    const pubClient = new Redis(redisOptions)
    const subClient = pubClient.duplicate()
    io.adapter(createAdapter(pubClient, subClient))

    return io
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!')
    }
    return io
  },
  // Moves every currently-connected socket for these users into chat-<chatId>,
  // so a brand-new chat is live for typing/message events immediately, without
  // waiting for a reconnect (chatSocket.js only auto-joins existing chats at
  // connection time). A no-op for anyone not currently connected — they'll
  // pick the room up via the same auto-join on their next connect.
  joinUsersToChat: (userIds, chatId) => {
    if (!io) return
    userIds.forEach((userId) => {
      io.in(`user-${userId}`).socketsJoin(`chat-${chatId}`)
    })
  },
  // Mirror of joinUsersToChat, for when a member leaves/is removed. Without
  // this, a currently-connected socket stays subscribed to chat-<chatId>
  // (rooms are joined once at connect time, see chatSocket.js) and would
  // keep receiving "message"/"typing"/etc. for a chat it's no longer a
  // member of until it happens to reconnect. A no-op for anyone not
  // currently connected.
  leaveUsersFromChat: (userIds, chatId) => {
    if (!io) return
    userIds.forEach((userId) => {
      io.in(`user-${userId}`).socketsLeave(`chat-${chatId}`)
    })
  },
}
