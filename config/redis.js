const Redis = require("ioredis");

const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // Required by @socket.io/redis-adapter's pub/sub clients — a client
  // subscribed to a channel can't also issue normal commands.
  maxRetriesPerRequest: null,
};

// Single connection for general commands (presence hash reads/writes).
// The socket.io adapter needs its own separate pub and sub clients — see
// config/socket.js's init(), which duplicates this one for that purpose.
const redisClient = new Redis(redisOptions);

redisClient.on("error", (err) => {
  console.error("Redis client error:", err.message);
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

module.exports = { redisClient, redisOptions };
