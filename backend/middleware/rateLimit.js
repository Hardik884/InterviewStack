/**
 * rateLimit.js — Redis-backed fixed-window rate limiter.
 *
 * Uses the shared ioredis (BullMQ) connection so it works across all
 * backend instances without an extra dependency. Limits are keyed by the
 * authenticated user when available, otherwise by client IP.
 *
 * Design notes:
 *   - Fixed window via INCR + PEXPIRE (atomic enough for abuse protection).
 *   - Fails OPEN: if Redis is unavailable the request is allowed through so a
 *     Redis outage never takes the whole API down (matches the app's existing
 *     graceful-degradation posture for caching).
 *   - Responds with HTTP 429 and a Retry-After header when the limit is hit.
 */

const { bullConnection } = require("../config/redis");

const clientKey = (req) => {
  if (req.user && req.user._id) {
    return `u:${req.user._id}`;
  }
  // req.ip respects the trust-proxy setting configured on the app.
  return `ip:${req.ip || req.connection?.remoteAddress || "unknown"}`;
};

/**
 * Create an Express middleware enforcing `max` requests per `windowMs`.
 *
 * @param {object}  opts
 * @param {string}  opts.keyPrefix  Unique bucket name (e.g. "auth:login").
 * @param {number}  opts.windowMs   Window length in milliseconds.
 * @param {number}  opts.max        Max requests allowed in the window.
 * @param {string} [opts.message]   Custom 429 message.
 */
const rateLimit = ({ keyPrefix, windowMs, max, message }) => {
  return async (req, res, next) => {
    const key = `rl:${keyPrefix}:${clientKey(req)}`;

    try {
      const count = await bullConnection.incr(key);
      if (count === 1) {
        await bullConnection.pexpire(key, windowMs);
      }

      if (count > max) {
        let ttl = await bullConnection.pttl(key);
        if (ttl < 0) ttl = windowMs;
        res.set("Retry-After", String(Math.ceil(ttl / 1000)));
        return res.status(429).json({
          message: message || "Too many requests. Please try again later.",
        });
      }

      return next();
    } catch (_) {
      // Redis unavailable — fail open.
      return next();
    }
  };
};

/**
 * Lightweight connection-level limiter for Socket.IO handshakes.
 * Returns true if the given IP is within its connection budget.
 */
const checkSocketConnectionLimit = async (ip, { windowMs = 60_000, max = 60 } = {}) => {
  const key = `rl:socket:connect:ip:${ip || "unknown"}`;
  try {
    const count = await bullConnection.incr(key);
    if (count === 1) {
      await bullConnection.pexpire(key, windowMs);
    }
    return count <= max;
  } catch (_) {
    return true; // fail open
  }
};

module.exports = { rateLimit, checkSocketConnectionLimit };
