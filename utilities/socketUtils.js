let io = null;

function initSocketUtils(ioInstance) {
  io = ioInstance;
}

function emitUploadProgress(socketId, data) {
    if (!io) return console.warn("Socket.IO not initialized");
  io.to(socketId).emit("upload-progress", data);
}


function emitUploadComplete(socketId, data) {
  if (!io) return console.warn("Socket.IO not initialized");
  io.to(socketId).emit("upload-complete", data);
}

function emitUploadError(socketId, error) {
  if (!io) return console.warn("Socket.IO not initialized");
  io.to(socketId).emit("upload-error", { error });
}

module.exports = {
  initSocketUtils,
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
};
