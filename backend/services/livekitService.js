/**
 * livekitService.js — LiveKit token generation.
 *
 * Generates participant tokens scoped to a single room.
 * Only authenticated users who are registered room participants
 * receive a valid token. The roomId is used as the LiveKit room name.
 */

const { AccessToken } = require("livekit-server-sdk");
/**
 * Generate a LiveKit participant token.
 *
 * @param {object} opts
 * @param {string} opts.roomId      — The interview room ID (used as LiveKit room name)
 * @param {string} opts.userId      — Unique participant identifier
 * @param {string} opts.name        — Display name shown to other participants
 * @param {string} opts.role        — "interviewer" | "candidate" | "observer"
 * @param {number} [opts.ttlSecs]   — Token TTL in seconds (default: 4h)
 * @returns {Promise<string>}       — Signed JWT token
 */
const generateLiveKitToken = async ({ roomId, userId, name, role, ttlSecs = 14400 }) => {
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in environment");
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: userId,
    name,
    ttl: `${ttlSecs}s`,
    metadata: JSON.stringify({ role }),
  });

  at.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
};

module.exports = { generateLiveKitToken };
