// The Socket.IO instance lives in config/socket.js. This module only wraps the
// upload-progress emits so callers don't have to know about rooms/socket ids.
const socket = require("../config/socket");

function getIO() {
  try {
    return socket.getIO();
  } catch (err) {
    console.warn("Socket.IO not initialized");
    return null;
  }
}

function emitUploadProgress(socketId, data) {
  const io = getIO();
  if (!io) return;
  io.to(socketId).emit("upload-progress", data);
}

function emitUploadComplete(socketId, data) {
  const io = getIO();
  if (!io) return;
  io.to(socketId).emit("upload-complete", data);
}

function emitUploadError(socketId, error) {
  const io = getIO();
  if (!io) return;
  io.to(socketId).emit("upload-error", { error });
}

module.exports = {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
};
