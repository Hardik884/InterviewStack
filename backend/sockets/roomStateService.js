/**
 * roomStateService.js
 *
 * Persists Yjs document state (binary Y.Doc snapshot) and room language
 * in Redis so that rejoining users or restarted backends can restore
 * the full CRDT document without relying on connected peers.
 *
 * TTL: 24 hours — rooms auto-expire if idle.
 *
 * Key schema:
 *   room:yjs:<roomId>      → base64-encoded Uint8Array (Y.Doc state)
 *   room:lang:<roomId>     → language string
 */

const { redisClient } = require("../config/redis");

const SNAPSHOT_TTL_SECONDS = 86_400; // 24 h

const yjsKey  = (roomId) => `room:yjs:${roomId}`;
const langKey = (roomId) => `room:lang:${roomId}`;

// ─── Yjs binary snapshot ──────────────────────────────────────────────────────

/**
 * Persist a Yjs document state vector (full document snapshot).
 * @param {string} roomId
 * @param {Uint8Array} stateBuffer — result of Y.encodeStateAsUpdate(doc)
 */
const setYjsSnapshot = async (roomId, stateBuffer) => {
  if (!redisClient.isOpen) return;
  try {
    const encoded = Buffer.from(stateBuffer).toString("base64");
    await redisClient.setEx(yjsKey(roomId), SNAPSHOT_TTL_SECONDS, encoded);
  } catch (err) {
    console.error("[roomState] setYjsSnapshot error:", err.message);
  }
};

/**
 * Retrieve the latest Yjs snapshot for a room.
 * Returns a Uint8Array or null if none exists.
 * @param {string} roomId
 * @returns {Promise<Uint8Array|null>}
 */
const getYjsSnapshot = async (roomId) => {
  if (!redisClient.isOpen) return null;
  try {
    const encoded = await redisClient.get(yjsKey(roomId));
    if (!encoded) return null;
    return new Uint8Array(Buffer.from(encoded, "base64"));
  } catch (err) {
    console.error("[roomState] getYjsSnapshot error:", err.message);
    return null;
  }
};

// ─── Language ─────────────────────────────────────────────────────────────────

/**
 * Persist the editor language for a room.
 * @param {string} roomId
 * @param {string} language
 */
const setRoomLanguage = async (roomId, language) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.setEx(langKey(roomId), SNAPSHOT_TTL_SECONDS, language);
  } catch (err) {
    console.error("[roomState] setRoomLanguage error:", err.message);
  }
};

/**
 * Retrieve the language for a room.
 * @param {string} roomId
 * @returns {Promise<string|null>}
 */
const getRoomLanguage = async (roomId) => {
  if (!redisClient.isOpen) return null;
  try {
    return await redisClient.get(langKey(roomId));
  } catch (err) {
    console.error("[roomState] getRoomLanguage error:", err.message);
    return null;
  }
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete all persisted state for a room (called on room:end).
 * @param {string} roomId
 */
const clearYjsSnapshot = async (roomId) => {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.del(yjsKey(roomId));
    await redisClient.del(langKey(roomId));
  } catch (err) {
    console.error("[roomState] clearYjsSnapshot error:", err.message);
  }
};

// Backward-compat alias (used in roomHandlers endRoom)
const clearRoomSnapshot = clearYjsSnapshot;

module.exports = {
  setYjsSnapshot,
  getYjsSnapshot,
  setRoomLanguage,
  getRoomLanguage,
  clearYjsSnapshot,
  clearRoomSnapshot,
};
