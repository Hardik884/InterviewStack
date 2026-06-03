/**
 * yjsHandlers.js — Production Yjs CRDT synchronisation layer.
 *
 * Architecture:
 *   - One Y.Doc per interview room (in-memory, restored from Redis on first join)
 *   - Socket.IO used ONLY as binary transport for Yjs updates and awareness data
 *   - Redis Pub/Sub propagates updates across multiple backend instances
 *   - Redis blob persists Y.Doc state for offline recovery and backend restarts
 *
 * Socket events (client → server):
 *   yjs:sync-step1   { roomId, stateVector: number[] }
 *   yjs:update       { roomId, update: number[] }
 *   yjs:awareness    { roomId, update: number[] }
 *   language:change  { roomId, language: string }
 *
 * Socket events (server → client):
 *   yjs:sync-step2   { roomId, update: number[], language: string }
 *   yjs:update       { roomId, update: number[] }
 *   yjs:awareness    { roomId, update: number[] }
 *   language:changed { roomId, language: string }
 */

const Y            = require("yjs");
const awarenessLib = require("y-protocols/awareness");
const { getRoomState }  = require("./roomHandlers");
const {
  setYjsSnapshot,
  getYjsSnapshot,
  setRoomLanguage,
} = require("./roomStateService");

// ─── In-memory Y.Doc registry ─────────────────────────────────────────────────
// Maps roomId → { doc: Y.Doc, awareness: Awareness }
const roomDocs = new Map();

// ─── Redis Pub/Sub channel prefixes ──────────────────────────────────────────
const YJS_CHANNEL  = "yjs:";
const LANG_CHANNEL = "lang:";

// Debounced Redis persist: maps roomId → timeout handle
const persistTimers = new Map();
const PERSIST_DEBOUNCE_MS = 2000;

// Shared Pub/Sub connections (ioredis duplicates) — set up in initRedisPubSub
let subscriber = null;
let publisher  = null;

// ─── Auth helper ─────────────────────────────────────────────────────────────

const isAuthorised = (socket, roomId) => {
  return socket.rooms.has(roomId) && getRoomState(roomId).has(socket.id);
};

// ─── Y.Doc lifecycle ─────────────────────────────────────────────────────────

/**
 * Get or create a Y.Doc + Awareness for a room.
 * On first creation, attempts to restore the snapshot from Redis.
 */
const getOrCreateDoc = async (roomId) => {
  if (roomDocs.has(roomId)) return roomDocs.get(roomId);

  const doc = new Y.Doc();
  // Ensure meta map exists
  doc.getMap("meta");

  const awareness = new awarenessLib.Awareness(doc);
  const entry = { doc, awareness };
  roomDocs.set(roomId, entry);

  // Restore from Redis
  try {
    const snapshot = await getYjsSnapshot(roomId);
    if (snapshot && snapshot.length > 0) {
      Y.applyUpdate(doc, snapshot);
      console.log(`[Yjs] Restored room ${roomId} from Redis (${snapshot.length} bytes)`);
    }
  } catch (err) {
    console.error("[Yjs] Snapshot restore error:", err.message);
  }

  return entry;
};

/**
 * Schedule a debounced full-document persist to Redis.
 * Only the final state within the debounce window is written.
 */
const schedulePersist = (roomId, doc) => {
  if (persistTimers.has(roomId)) clearTimeout(persistTimers.get(roomId));
  const timer = setTimeout(async () => {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      await setYjsSnapshot(roomId, state);
      persistTimers.delete(roomId);
    } catch (err) {
      console.error("[Yjs] Persist error:", err.message);
    }
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(roomId, timer);
};

// ─── Redis Pub/Sub (multi-instance) ──────────────────────────────────────────

/**
 * Initialise Redis Pub/Sub for cross-instance Yjs update propagation.
 * Uses ioredis duplicate connections (one for subscribe, one for publish).
 * Call this once after the io server is created.
 * @param {import('socket.io').Server} io
 */
const initRedisPubSub = (io) => {
  try {
    const { bullConnection } = require("../config/redis");
    subscriber = bullConnection.duplicate();
    publisher  = bullConnection.duplicate();

    // Receive raw binary from Redis and relay to local Socket.IO clients
    subscriber.on("messageBuffer", (channelBuf, messageBuf) => {
      const channel = channelBuf.toString();

      if (channel.startsWith(YJS_CHANNEL)) {
        const roomId = channel.slice(YJS_CHANNEL.length);
        const update = new Uint8Array(messageBuf);
        const entry  = roomDocs.get(roomId);
        if (entry) {
          // Apply to local in-memory doc (skip if same update already applied)
          try { Y.applyUpdate(entry.doc, update, "redis"); } catch (_) {}
        }
        // Broadcast to all local sockets in this room
        const arr = Array.from(update);
        io.to(roomId).emit("yjs:update", { roomId, update: arr });
      }

      if (channel.startsWith(LANG_CHANNEL)) {
        const roomId  = channel.slice(LANG_CHANNEL.length);
        const language = messageBuf.toString();
        io.to(roomId).emit("language:changed", { roomId, language });
      }
    });

    subscriber.on("error", (err) => {
      if (err.code !== "ECONNREFUSED") console.error("[Yjs PubSub subscriber]", err.message);
    });
    publisher.on("error", (err) => {
      if (err.code !== "ECONNREFUSED") console.error("[Yjs PubSub publisher]", err.message);
    });

    console.log("[Yjs] Redis Pub/Sub ready (multi-instance support active)");
  } catch (err) {
    console.warn("[Yjs] Redis Pub/Sub unavailable — running single-instance:", err.message);
    subscriber = null;
    publisher  = null;
  }
};

const subscribeToRoom = (roomId) => {
  if (!subscriber) return;
  subscriber
    .subscribe(YJS_CHANNEL + roomId, LANG_CHANNEL + roomId)
    .catch(() => {});
};

const publishYjsUpdate = async (roomId, update) => {
  if (!publisher) return;
  try {
    await publisher.publishBuffer(YJS_CHANNEL + roomId, Buffer.from(update));
  } catch (_) {}
};

const publishLangChange = async (roomId, language) => {
  if (!publisher) return;
  try {
    await publisher.publish(LANG_CHANNEL + roomId, language);
  } catch (_) {}
};

// ─── Per-socket handler registration ─────────────────────────────────────────

const registerYjsHandlers = (io, socket) => {
  // ── yjs:sync-step1 ────────────────────────────────────────────────────────
  // Client sends its current state vector; server replies with the diff.
  const onSyncStep1 = async ({ roomId, stateVector }) => {
    if (!roomId || !isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);
      const sv = stateVector
        ? new Uint8Array(stateVector)
        : new Uint8Array();

      // Compute what the client is missing
      const missingUpdate = Y.encodeStateAsUpdate(doc, sv);
      const meta = doc.getMap("meta");
      const language  = meta.get("language")  ?? "javascript";
      const problemId = meta.get("problemId") ?? null;

      socket.emit("yjs:sync-step2", {
        roomId,
        update: Array.from(missingUpdate),
        language,
        problemId,
      });
    } catch (err) {
      console.error("[Yjs] sync-step1 error:", err.message);
    }
  };

  // ── yjs:update ────────────────────────────────────────────────────────────
  // Client sends a CRDT delta. Apply it, broadcast to room, persist.
  const onYjsUpdate = async ({ roomId, update }) => {
    if (!roomId || !update || !isAuthorised(socket, roomId)) return;

    try {
      const updateArr = new Uint8Array(update);
      const { doc } = await getOrCreateDoc(roomId);

      // Apply to server Y.Doc; tag with socket.id as origin
      Y.applyUpdate(doc, updateArr, socket.id);

      // Broadcast delta to all OTHER sockets in the room
      const arr = Array.from(updateArr);
      socket.to(roomId).emit("yjs:update", { roomId, update: arr });

      // Cross-instance via Redis Pub/Sub
      await publishYjsUpdate(roomId, updateArr);

      // Debounced persistence
      schedulePersist(roomId, doc);
    } catch (err) {
      console.error("[Yjs] update error:", err.message);
    }
  };

  // ── yjs:awareness ─────────────────────────────────────────────────────────
  // Relay cursor/presence updates to peers. Volatile — drops are acceptable.
  const onYjsAwareness = ({ roomId, update }) => {
    if (!roomId || !update || !isAuthorised(socket, roomId)) return;
    socket.volatile.to(roomId).emit("yjs:awareness", { roomId, update });
  };

  // ── language:change ───────────────────────────────────────────────────────
  // Store in Y.Map for CRDT consistency. Also persist to Redis for fast join.
  const onLanguageChange = async ({ roomId, language }) => {
    if (!roomId || typeof language !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);

      doc.transact(() => {
        doc.getMap("meta").set("language", language);
      }, socket.id);

      await setRoomLanguage(roomId, language);

      socket.to(roomId).emit("language:changed", { roomId, language });

      await publishLangChange(roomId, language);

      // Persist Y.Doc update immediately on language change
      schedulePersist(roomId, doc);
    } catch (err) {
      console.error("[Yjs] language:change error:", err.message);
    }
  };

  // ── problem:set ───────────────────────────────────────────────────────────
  // Interviewer sets the active problemId. Stored in Y.Map and broadcast to all
  // room participants so candidates always receive the same problemId.
  const onProblemSet = async ({ roomId, problemId }) => {
    if (!roomId || typeof problemId !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);

      doc.transact(() => {
        doc.getMap("meta").set("problemId", problemId);
      }, socket.id);

      // Broadcast to all sockets in room (including sender — so their own
      // component can react without a separate local state)
      io.to(roomId).emit("problem:set", { roomId, problemId });

      schedulePersist(roomId, doc);
    } catch (err) {
      console.error("[Yjs] problem:set error:", err.message);
    }
  };

  // ── run:result ─────────────────────────────────────────────────────────────
  // Candidate emits this after receiving a run result.
  // Server relays it to ALL participants in the room so the interviewer sees it.
  // We do NOT relay submit results here to protect hidden test cases.
  const onRunResult = ({ roomId, result }) => {
    if (!roomId || !result || !isAuthorised(socket, roomId)) return;
    // Broadcast to everyone in the room (including sender so state is consistent)
    io.to(roomId).emit("run:result", { roomId, result });
  };

  // Wire events
  socket.on("yjs:sync-step1",  onSyncStep1);
  socket.on("yjs:update",      onYjsUpdate);
  socket.on("yjs:awareness",   onYjsAwareness);
  socket.on("language:change", onLanguageChange);
  socket.on("problem:set",     onProblemSet);
  socket.on("run:result",      onRunResult);

};

// ─── Called from roomHandlers on join ────────────────────────────────────────

/**
 * Ensures Y.Doc is loaded and Redis Pub/Sub channel subscribed for the room.
 */
const onRoomJoin = async (roomId) => {
  await getOrCreateDoc(roomId);
  subscribeToRoom(roomId);
};

// ─── Called from roomHandlers on room:end ────────────────────────────────────

/**
 * Destroy the in-memory Y.Doc and cancel pending persist timers.
 */
const onRoomEnd = (roomId) => {
  const entry = roomDocs.get(roomId);
  if (entry) {
    // Flush immediately before destroy
    try {
      const state = Y.encodeStateAsUpdate(entry.doc);
      setYjsSnapshot(roomId, state).catch(() => {});
    } catch (_) {}
    entry.doc.destroy();
    roomDocs.delete(roomId);
  }
  if (persistTimers.has(roomId)) {
    clearTimeout(persistTimers.get(roomId));
    persistTimers.delete(roomId);
  }
};

module.exports = {
  registerYjsHandlers,
  initRedisPubSub,
  onRoomJoin,
  onRoomEnd,
};
