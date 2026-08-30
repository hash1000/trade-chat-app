const jwt = require("jsonwebtoken");

// Mirrors middlewares/authenticate.js, but reads the token from the
// Socket.IO handshake instead of an Express header. Accepts either
// auth.token (preferred) or an Authorization header, for clients that
// reuse their REST setup.
//
// Shared by every socket module (chatSocket.js, userSocket.js, ...) so
// each one is self-contained and doesn't depend on another module having
// already registered it — io.use() middlewares all run before any
// "connection" listener fires, regardless of which file called io.use()
// first, so it's safe (and cheap — just a JWT verify) for more than one
// module to register this on the same io instance.
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

module.exports = { authenticateSocket, readToken };
