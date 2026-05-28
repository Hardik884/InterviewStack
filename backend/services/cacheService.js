const { redisClient } = require("../config/redis");

const DEFAULT_TTL = parseInt(process.env.REDIS_TTL_SECONDS, 10) || 300;

const getCache = async (key) => {
  if (!redisClient.isOpen) {
    return null;
  }

  const value = await redisClient.get(key);
  return value ? JSON.parse(value) : null;
};

const setCache = async (key, value, ttlSeconds = DEFAULT_TTL) => {
  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
};

const delCache = async (key) => {
  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.del(key);
};

const delCacheByPattern = async (pattern) => {
  if (!redisClient.isOpen) {
    return;
  }

  let cursor = 0;
  do {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: pattern,
      COUNT: 100,
    });
    cursor = Number(nextCursor);

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } while (cursor !== 0);
};

module.exports = {
  getCache,
  setCache,
  delCache,
  delCacheByPattern,
};
