/**
 * yjsHandlers.js — Production Yjs CRDT synchronisation layer.
 *
 * Architecture (single source of truth):
 *   - One Y.Doc per interview room (in-memory, restored from Redis on first join).
 *   - Each server Y.Doc has ONE authoritative `doc.on("update")` observer that is
 *     the single place responsible for fan-out. This guarantees that whatever is
 *     applied to the server doc — whether from a local client, a server-side
 *     transaction (language/problem), or a cross-instance Redis message — is
 *     relayed consistently and exactly once per instance.
 *   - Cross-instance propagation uses a dedicated Redis Pub/Sub channel and
 *     LOCAL-only socket emits (`io.local`). This deliberately bypasses the
 *     Socket.IO Redis adapter for the high-frequency Yjs *data plane* so updates
 *     are not double-broadcast (adapter + manual pubsub). The adapter still
 *     handles the *control plane* (presence, participants, language/problem UI
 *     events, submission/run results).
 *   - Redis blob persists Y.Doc state for offline recovery and backend restarts.
 *
 * Why CRDT correctness holds:
 *   - Y.applyUpdate is idempotent + commutative, so duplicate or out-of-order
 *     deliveries converge. The observer skips re-publishing updates that arrived
 *     from Redis (origin "redis") and skips broadcasting snapshot restores
 *     (origin "restore"), which prevents infinite loops while still converging
 *     every instance's server doc (required for correct late-join sync-step2).
 *
 * Socket events (client → server):
 *   yjs:sync-step1   { roomId, stateVector: number[] }
 *   yjs:update       { roomId, update: number[] }
 *   yjs:awareness    { roomId, update: number[] }
 *   language:change  { roomId, language: string }
 *   problem:set      { roomId, problemId: string }
 *   run:result       { roomId, result }
 *
 * Socket events (server → client):
 *   yjs:sync-step2   { roomId, update: number[], language, problemId }
 *   yjs:update       { roomId, update: number[] }
 *   yjs:awareness    { roomId, update: number[] }
 *   language:changed { roomId, language }
 *   problem:set      { roomId, problemId }
 *   run:result       { roomId, result }
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
// Maps roomId → { doc: Y.Doc, awareness: Awareness, onUpdate: fn }
const roomDocs = new Map();

// ─── Redis Pub/Sub channel prefix (Yjs data plane only) ──────────────────────
const YJS_CHANNEL = "yjs:";

// Debounced Redis persist: maps roomId → timeout handle
const persistTimers = new Map();
const PERSIST_DEBOUNCE_MS = 2000;

// Idle-room teardown timers: maps roomId → timeout handle.
const cleanupTimers = new Map();
const ROOM_IDLE_TTL_MS = 60_000;

// Shared Pub/Sub connections (ioredis duplicates) — set up in initRedisPubSub
let subscriber = null;
let publisher  = null;

// Socket.IO server reference — set in initRedisPubSub, used by the per-doc
// update observer to emit to local clients.
let ioRef = null;

// ─── Auth helper ─────────────────────────────────────────────────────────────

const isAuthorised = (socket, roomId) => {
  return socket.rooms.has(roomId) && getRoomState(roomId).has(socket.id);
};

// ─── Cross-instance publish ──────────────────────────────────────────────────

const publishYjsUpdate = (roomId, update) => {
  if (!publisher) return;
  try {
    publisher.publishBuffer(YJS_CHANNEL + roomId, Buffer.from(update)).catch(() => {});
  } catch (_) {}
};

// ─── Y.Doc lifecycle ─────────────────────────────────────────────────────────

/**
 * Build the single authoritative update observer for a room's Y.Doc.
 *
 * origin semantics:
 *   - "restore" : update came from loading the Redis snapshot → do NOT broadcast.
 *   - "redis"   : update arrived from another instance → relay to LOCAL clients
 *                 only, do NOT re-publish (prevents cross-instance loops) and do
 *                 NOT persist (the originating instance owns persistence).
 *   - <socketId>: a local client edit OR a server-side transaction → relay to all
 *                 LOCAL clients except the originator, publish to Redis for other
 *                 instances, and schedule persistence.
 */
const makeUpdateObserver = (roomId, doc) => (update, origin) => {
  if (origin === "restore") return;

  if (ioRef) {
    const arr = Array.from(update);
    let target = ioRef.local.to(roomId);
    // Exclude the originating socket for local edits (it already has the change).
    if (typeof origin === "string" && origin !== "redis") {
      target = target.except(origin);
    }
    target.emit("yjs:update", { roomId, update: arr });
  }

  if (origin !== "redis") {
    publishYjsUpdate(roomId, update);
    schedulePersist(roomId, doc);
  }
};

/**
 * Get or create a Y.Doc + Awareness for a room.
 * On first creation, attempts to restore the snapshot from Redis and attaches
 * the single authoritative update observer.
 */
const getOrCreateDoc = async (roomId) => {
  if (roomDocs.has(roomId)) return roomDocs.get(roomId);

  const doc = new Y.Doc();
  doc.getMap("meta"); // ensure meta map exists

  const awareness = new awarenessLib.Awareness(doc);
  const entry = { doc, awareness, onUpdate: null };
  roomDocs.set(roomId, entry);

  // Restore from Redis BEFORE attaching the observer so the restore is not
  // broadcast (and tag it "restore" as a second guard).
  try {
    const snapshot = await getYjsSnapshot(roomId);
    if (snapshot && snapshot.length > 0) {
      Y.applyUpdate(doc, snapshot, "restore");
      console.log(`[Yjs] Restored room ${roomId} from Redis (${snapshot.length} bytes)`);
    }
  } catch (err) {
    console.error("[Yjs] Snapshot restore error:", err.message);
  }

  // Attach the single authoritative fan-out observer.
  const onUpdate = makeUpdateObserver(roomId, doc);
  entry.onUpdate = onUpdate;
  doc.on("update", onUpdate);

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
 * Initialise Redis Pub/Sub for cross-instance Yjs update propagation and store
 * the io reference used by the per-doc update observer.
 * @param {import('socket.io').Server} io
 */
const initRedisPubSub = (io) => {
  ioRef = io;
  try {
    const { bullConnection, attachRedisErrorLogger } = require("../config/redis");
    subscriber = bullConnection.duplicate();
    publisher  = bullConnection.duplicate();

    // Receive raw binary from Redis and apply to the local in-memory doc. The
    // doc's update observer (origin "redis") relays it to local clients. We do
    // NOT emit here directly — that would double-deliver.
    subscriber.on("messageBuffer", (channelBuf, messageBuf) => {
      const channel = channelBuf.toString();
      if (!channel.startsWith(YJS_CHANNEL)) return;

      const roomId = channel.slice(YJS_CHANNEL.length);
      const entry  = roomDocs.get(roomId);
      if (!entry) return; // no local clients/doc for this room → nothing to relay

      try {
        Y.applyUpdate(entry.doc, new Uint8Array(messageBuf), "redis");
      } catch (_) {}
    });

    attachRedisErrorLogger(subscriber, "yjsPubSubSubscriber");
    attachRedisErrorLogger(publisher, "yjsPubSubPublisher");

    console.log("[Yjs] Redis Pub/Sub ready (multi-instance support active)");
  } catch (err) {
    console.warn("[Yjs] Redis Pub/Sub unavailable — running single-instance:", err.message);
    subscriber = null;
    publisher  = null;
  }
};

const subscribeToRoom = (roomId) => {
  if (!subscriber) return;
  subscriber.subscribe(YJS_CHANNEL + roomId).catch(() => {});
};

const unsubscribeFromRoom = (roomId) => {
  if (!subscriber) return;
  subscriber.unsubscribe(YJS_CHANNEL + roomId).catch(() => {});
};

// ─── Per-socket handler registration ─────────────────────────────────────────

const registerYjsHandlers = (io, socket) => {
  // ── yjs:sync-step1 ────────────────────────────────────────────────────────
  // Client sends its current state vector; server replies with the diff.
  const onSyncStep1 = async ({ roomId, stateVector }) => {
    if (!roomId || !isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);
      const sv = stateVector ? new Uint8Array(stateVector) : new Uint8Array();

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
  // Client sends a CRDT delta. Applying it to the server doc triggers the
  // authoritative observer, which performs all broadcast/publish/persist.
  const onYjsUpdate = async ({ roomId, update }) => {
    if (!roomId || !update || !isAuthorised(socket, roomId)) return;
    try {
      const { doc } = await getOrCreateDoc(roomId);
      Y.applyUpdate(doc, new Uint8Array(update), socket.id);
    } catch (err) {
      console.error("[Yjs] update error:", err.message);
    }
  };

  // ── yjs:awareness ─────────────────────────────────────────────────────────
  // Presence (cursors/selection). Volatile + lossy by design. Cross-instance
  // delivery is handled by the Socket.IO Redis adapter (control plane).
  const onYjsAwareness = ({ roomId, update }) => {
    if (!roomId || !update || !isAuthorised(socket, roomId)) return;
    socket.volatile.to(roomId).emit("yjs:awareness", { roomId, update });
  };

  // ── language:change ───────────────────────────────────────────────────────
  // Stored in the Y.Map (so the transaction propagates cross-instance via the
  // doc observer for correct late-join sync). The language:changed UI event is
  // broadcast via the adapter so every client's selector updates immediately.
  const onLanguageChange = async ({ roomId, language }) => {
    if (!roomId || typeof language !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);
      doc.transact(() => {
        doc.getMap("meta").set("language", language);
      }, socket.id);

      await setRoomLanguage(roomId, language);

      // UI event to all room clients (cross-instance via adapter), incl. sender
      // so a no-op selector stays consistent.
      io.to(roomId).emit("language:changed", { roomId, language });
    } catch (err) {
      console.error("[Yjs] language:change error:", err.message);
    }
  };

  // ── problem:set ───────────────────────────────────────────────────────────
  const onProblemSet = async ({ roomId, problemId }) => {
    if (!roomId || typeof problemId !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    try {
      const { doc } = await getOrCreateDoc(roomId);
      doc.transact(() => {
        doc.getMap("meta").set("problemId", problemId);
      }, socket.id);

      io.to(roomId).emit("problem:set", { roomId, problemId });
    } catch (err) {
      console.error("[Yjs] problem:set error:", err.message);
    }
  };

  // ── run:result ─────────────────────────────────────────────────────────────
  const onRunResult = ({ roomId, result }) => {
    if (!roomId || !result || !isAuthorised(socket, roomId)) return;
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

// ─── Full teardown of a room's in-memory resources ──────────────────────────

const teardownRoom = (roomId) => {
  const entry = roomDocs.get(roomId);
  if (entry) {
    // Flush final state before destroying.
    try {
      const state = Y.encodeStateAsUpdate(entry.doc);
      setYjsSnapshot(roomId, state).catch(() => {});
    } catch (_) {}

    // Detach the observer explicitly before destroy (defensive).
    try { if (entry.onUpdate) entry.doc.off("update", entry.onUpdate); } catch (_) {}

    // Awareness cleanup — remove all client states then destroy.
    try {
      const clientIds = Array.from(entry.awareness.getStates().keys());
      if (clientIds.length) {
        awarenessLib.removeAwarenessStates(entry.awareness, clientIds, "teardown");
      }
      entry.awareness.destroy();
    } catch (_) {}

    try { entry.doc.destroy(); } catch (_) {}

    roomDocs.delete(roomId);
  }

  if (persistTimers.has(roomId)) {
    clearTimeout(persistTimers.get(roomId));
    persistTimers.delete(roomId);
  }
  if (cleanupTimers.has(roomId)) {
    clearTimeout(cleanupTimers.get(roomId));
    cleanupTimers.delete(roomId);
  }

  unsubscribeFromRoom(roomId);
};

// ─── Called from roomHandlers on join ────────────────────────────────────────

const onRoomJoin = async (roomId) => {
  cancelRoomCleanup(roomId);
  await getOrCreateDoc(roomId);
  subscribeToRoom(roomId);
};

// ─── Ref-counted idle cleanup ────────────────────────────────────────────────

const scheduleRoomCleanup = (roomId) => {
  if (cleanupTimers.has(roomId)) {
    clearTimeout(cleanupTimers.get(roomId));
  }
  const timer = setTimeout(() => {
    cleanupTimers.delete(roomId);
    let stillEmpty = true;
    try {
      stillEmpty = getRoomState(roomId).size === 0;
    } catch (_) {}
    if (stillEmpty) {
      teardownRoom(roomId);
      console.log(`[Yjs] Idle room ${roomId} torn down (memory released).`);
    }
  }, ROOM_IDLE_TTL_MS);
  cleanupTimers.set(roomId, timer);
};

const cancelRoomCleanup = (roomId) => {
  if (cleanupTimers.has(roomId)) {
    clearTimeout(cleanupTimers.get(roomId));
    cleanupTimers.delete(roomId);
  }
};

// ─── Called from roomHandlers on room:end ────────────────────────────────────

const onRoomEnd = (roomId) => {
  teardownRoom(roomId);
};

module.exports = {
  registerYjsHandlers,
  initRedisPubSub,
  onRoomJoin,
  onRoomEnd,
  scheduleRoomCleanup,
  cancelRoomCleanup,
};
