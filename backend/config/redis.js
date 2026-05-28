const { createClient } = require("redis");
const IORedis = require("ioredis");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || "6379";
const redisUrl =
  process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

const redisClient = createClient({ url: redisUrl });
const bullConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redisClient.on("ready", () => {
  console.log("Redis ready");
});

bullConnection.on("error", (error) => {
  console.error("BullMQ Redis error:", error.message);
});

bullConnection.on("ready", () => {
  console.log("BullMQ Redis ready");
});

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  await redisClient.connect();
  console.log("Redis connected");
  return redisClient;
};

module.exports = {
  redisClient,
  connectRedis,
  bullConnection,
};
