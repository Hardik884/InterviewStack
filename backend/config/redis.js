const { createClient } = require("redis");
const IORedis = require("ioredis");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

// --- node-redis client (used by cacheService) ---
const redisClient = createClient({ url: redisUrl });

redisClient.on("error", (error) => {
  // Suppress ECONNREFUSED noise after first failure – the app degrades gracefully.
  if (error.code !== "ECONNREFUSED") {
    console.error("Redis client error:", error.message);
  }
});

redisClient.on("ready", () => {
  console.log("Redis client ready");
});

redisClient.on("reconnecting", () => {
  console.log("Redis client reconnecting…");
});

// --- ioredis connection for BullMQ ---
const bullConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

bullConnection.on("error", (error) => {
  if (error.code !== "ECONNREFUSED") {
    console.error("BullMQ Redis error:", error.message);
  }
});

bullConnection.on("ready", () => {
  console.log("BullMQ Redis ready");
});

/**
 * Connect the node-redis client.  Idempotent – safe to call multiple times.
 */
const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  try {
    await redisClient.connect();
    console.log("Redis connected");
  } catch (error) {
    console.error("Redis connection failed (non-fatal):", error.message);
  }

  return redisClient;
};

module.exports = { redisClient, connectRedis, bullConnection };
