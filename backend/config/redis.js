/**
 * config/redis.js — single source of truth for Redis connectivity.
 *
 * Two clients are exported, matching what each consumer actually needs:
 *   - `redisClient`   (node-redis)  → simple GET/SET/SCAN usage:
 *                                     cacheService, roomStateService (Yjs
 *                                     snapshot + room language persistence).
 *   - `bullConnection` (ioredis)    → BullMQ queues/workers, the Redis-backed
 *                                     rate limiter, and anything that needs a
 *                                     Pub/Sub-capable connection (Socket.IO
 *                                     Redis adapter, Yjs cross-instance
 *                                     Pub/Sub) via `bullConnection.duplicate()`.
 *                                     BullMQ requires ioredis specifically, so
 *                                     the two client libraries intentionally
 *                                     coexist rather than being collapsed into
 *                                     one — that would be a rewrite, not a fix.
 *
 * Connection source of truth: REDIS_URL (production — e.g. Upstash's
 * `rediss://default:<password>@<host>:<port>`). REDIS_HOST/REDIS_PORT remain
 * as the local-development fallback when REDIS_URL is not set. In production
 * (NODE_ENV=production) that fallback is disabled — silently talking to
 * localhost in prod would mask a missing/deleted Redis instance instead of
 * failing loudly.
 */

const { createClient } = require("redis");
const IORedis = require("ioredis");

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── Logging helpers (never print credentials) ───────────────────────────────

/** Strip user/password out of a Redis URL, leaving only protocol+host+port. */
const maskRedisUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch (_) {
    return "<unparseable>";
  }
};

// Throttle repeated identical error logs so a persistent outage doesn't
// flood stdout (this is what previously showed up as reconnect spam every
// ~500ms — the connection itself was retrying sensibly, only the logging
// wasn't).
const errorLogState = new Map(); // label -> { code, count, lastLoggedAt }
const LOG_THROTTLE_MS = 30_000;

const logRedisError = (label, error) => {
  const now = Date.now();
  const state = errorLogState.get(label) || { code: null, count: 0, lastLoggedAt: 0 };
  state.count += 1;
  const codeChanged = state.code !== error.code;
  state.code = error.code;

  if (codeChanged || now - state.lastLoggedAt > LOG_THROTTLE_MS) {
    const suffix = state.count > 1 ? ` (${state.count} occurrences since last log)` : "";
    console.error(`[Redis:${label}] ${error.code || "error"}: ${error.message}${suffix}`);
    state.lastLoggedAt = now;
    state.count = 0;
  }
  errorLogState.set(label, state);
};

// Exponential backoff, capped, with jitter — shared shape for both clients.
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 30_000;

const backoffDelay = (attempt) => {
  const exp = Math.min(RETRY_BASE_MS * 2 ** Math.min(attempt, 7), RETRY_MAX_MS);
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
};

const logReconnectAttempt = (label, attempt, delay) => {
  // Log the first few attempts, then back off to every 5th so a sustained
  // outage doesn't spam logs while still leaving a trail.
  if (attempt <= 3 || attempt % 5 === 0) {
    console.warn(`[Redis:${label}] reconnect attempt ${attempt}, retrying in ${delay}ms`);
  }
};

// ─── Startup validation ───────────────────────────────────────────────────────

/**
 * Resolve and validate the Redis connection URL.
 * Throws a clear, actionable error (no secrets in the message) if:
 *   - REDIS_URL is set but not a valid redis:// or rediss:// URL, or
 *   - REDIS_URL is missing while running in production (NODE_ENV=production),
 *     which would otherwise silently fall back to localhost.
 */
const resolveRedisUrl = () => {
  const configuredUrl = process.env.REDIS_URL;

  if (configuredUrl) {
    let parsed;
    try {
      parsed = new URL(configuredUrl);
    } catch (_) {
      throw new Error(
        "REDIS_URL is set but is not a valid URL. Expected format: " +
          "redis://[user:password@]host:port or rediss://[user:password@]host:port " +
          "(rediss:// for TLS, e.g. Upstash)."
      );
    }
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      throw new Error(
        `REDIS_URL has an unsupported protocol "${parsed.protocol}". ` +
          'Expected "redis:" or "rediss:".'
      );
    }

    console.log("Redis configuration detected.");
    console.log(`Connecting to Redis (${maskRedisUrl(configuredUrl)})...`);
    return configuredUrl;
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "REDIS_URL is not set. In production this must point at the Redis " +
        "instance (e.g. rediss://default:<password>@<host>:<port> from " +
        "Upstash) — refusing to fall back to localhost. Set REDIS_URL in " +
        "the Render environment variables."
    );
  }

  const localUrl = `redis://${REDIS_HOST}:${REDIS_PORT}`;
  console.log("REDIS_URL not set — using local Redis configuration (development only).");
  console.log(`Connecting to Redis (${maskRedisUrl(localUrl)})...`);
  return localUrl;
};

const redisUrl = resolveRedisUrl();

// --- node-redis client (used by cacheService, roomStateService) ---
const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = backoffDelay(retries);
      logReconnectAttempt("cache", retries, delay);
      return delay;
    },
  },
});

redisClient.on("error", (error) => logRedisError("cache", error));

redisClient.on("ready", () => {
  console.log("Redis connected");
});

// --- ioredis connection for BullMQ (also backs the rate limiter, the
// Socket.IO Redis adapter, and Yjs Pub/Sub via .duplicate()) ---
const bullConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ for its blocking commands
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy: (times) => {
    const delay = backoffDelay(times);
    logReconnectAttempt("bullmq", times, delay);
    return delay;
  },
});

bullConnection.on("error", (error) => logRedisError("bullmq", error));

bullConnection.on("ready", () => {
  console.log("Redis connected (BullMQ)");
});

/**
 * Connect the node-redis client. Idempotent – safe to call multiple times.
 * Non-fatal on failure: the app degrades gracefully (cache/room-state reads
 * simply miss) rather than crashing the process for a Redis blip.
 */
const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  try {
    await redisClient.connect();
  } catch (error) {
    console.error("Redis connection failed (non-fatal):", error.message);
  }

  return redisClient;
};

/**
 * Cheap, synchronous-ish health snapshot for both clients — no network round
 * trip, just current connection state. Used by the /health endpoint so it
 * never reports "ok" while Redis is actually down.
 */
const getRedisHealth = () => ({
  cache: redisClient.isReady ? "connected" : "disconnected",
  bullmq: bullConnection.status === "ready" ? "connected" : bullConnection.status,
});

/**
 * Attach a throttled error logger to any Redis-backed EventEmitter (BullMQ
 * Queue/QueueEvents/Worker instances, adapter duplicates, etc.). BullMQ
 * duplicates `bullConnection` internally for each Queue/QueueEvents/Worker it
 * creates, and those duplicated connections are otherwise unmonitored —
 * without a listener, Node prints their raw unhandled connection errors
 * (full stack traces, once per reconnect) instead of the throttled,
 * single-line format used everywhere else in this module.
 */
const attachRedisErrorLogger = (emitter, label) => {
  emitter.on("error", (error) => logRedisError(label, error));
  return emitter;
};

module.exports = {
  redisClient,
  connectRedis,
  bullConnection,
  getRedisHealth,
  maskRedisUrl,
  attachRedisErrorLogger,
};
