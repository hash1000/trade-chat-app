let io = null

module.exports = {
  // Store the Socket.IO server created in app.js. Do not create a new one here:
  // a second Server instance on the same httpServer would not share rooms.
  init: (ioInstance) => {
    io = ioInstance
    return io
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!')
    }
    return io
  },
  // Moves every currently-connected socket for these users into chat-<chatId>,
  // so a brand-new chat is live for typing/message event immediately, without
  // waiting for a reconnect (chatSocket.js only auto-joins existing chats at
  // connection time). A no-op for anyone not currently connected - they'll
  // pick the room up via the same auto-join on their next connect.
  joinUsersToChat: (userIds, chatId) => {
    if (!io) return
    userIds.forEach((userId) => {
      io.in(`user-${userId}`).socketsJoin(`chat-${chatId}`)
    })
  }
}
