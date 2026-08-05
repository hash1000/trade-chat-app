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
}
