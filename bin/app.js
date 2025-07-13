#!/usr/bin/env node
require("dotenv").config();
const debug = require("debug")("customerapi:server");
const { httpServer } = require("../app"); // Import the httpServer

const port = normalizePort(process.env.PORT || "3000");

// Listen
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Socket.IO endpoint: ws://localhost:${port}/upload/socket.io`);
});

httpServer.on("error", onError);
httpServer.on("listening", onListening);

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

function onError(error) {
  if (error.syscall !== "listen") throw error;
  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
    default:
      throw error;
  }
}

function onListening() {
  const addr = httpServer.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}