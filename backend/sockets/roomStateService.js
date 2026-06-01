/**
 * roomStateService.js
 *
 * Persists room snapshots (code + language) in Redis so that rejoining
 * users immediately receive the latest editor state without relying on
 * other connected sockets to re-broadcast.
 *
 * TTL: 24 hours — rooms auto-expire if idle.
 */

const { redisClient } = require("../config/redis");

const SNAPSHOT_TTL_SECONDS = 86_400; // 24 h

const snapshotKey = (roomId) => `room:snapshot:${roomId}`;

/**
 * Persist the latest code + language for a room.
 * @param {string} roomId
 * @param {object} snapshot
 * @param {string} snapshot.code
 * @param {string} snapshot.language
 */
const setRoomSnapshot = async (roomId, { code = "", language = "javascript" }) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.setEx(
      snapshotKey(roomId),
      SNAPSHOT_TTL_SECONDS,
      JSON.stringify({ code, language, updatedAt: Date.now() })
    );
  } catch (err) {
    console.error("[roomState] setRoomSnapshot error:", err.message);
  }
};

/**
 * Retrieve the latest snapshot for a room.
 * Returns null if no snapshot exists or Redis is unavailable.
 * @param {string} roomId
 * @returns {Promise<{code: string, language: string} | null>}
 */
const getRoomSnapshot = async (roomId) => {
  if (!redisClient.isOpen) return null;
  try {
    const raw = await redisClient.get(snapshotKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[roomState] getRoomSnapshot error:", err.message);
    return null;
  }
};

/**
 * Delete a room snapshot (called when the last participant leaves).
 * @param {string} roomId
 */
const clearRoomSnapshot = async (roomId) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.del(snapshotKey(roomId));
  } catch (err) {
    console.error("[roomState] clearRoomSnapshot error:", err.message);
  }
};

module.exports = { setRoomSnapshot, getRoomSnapshot, clearRoomSnapshot };
