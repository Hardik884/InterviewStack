/**
 * roomHandlers.js — Room lifecycle management (Yjs CRDT edition).
 *
 * Changes from legacy version:
 *   - room:snapshot no longer carries code or language strings
 *     (Yjs sync-step1/step2 handles document state restoration)
 *   - onRoomJoin from yjsHandlers called on join to init Y.Doc
 *   - onRoomEnd from yjsHandlers called on room:end to destroy Y.Doc
 *   - clearYjsSnapshot (renamed from clearRoomSnapshot) called on room:end
 *
 * Preserved:
 *   - Participant registry (roles, reconnect detection)
 *   - user_joined / user_left / user_reconnected events
 *   - room:participants broadcast
 *   - Host authority check for room:end
 *   - Orphan cleanup
 */

const { clearYjsSnapshot } = require("./roomStateService");

// Lazily required to avoid circular deps (yjsHandlers → roomHandlers → yjsHandlers)
let _yjsHandlers = null;
const getYjsHandlers = () => {
  if (!_yjsHandlers) _yjsHandlers = require("./yjsHandlers");
  return _yjsHandlers;
};

/**
 * In-memory participant registry.
 * Maps roomId → Map<socketId, { userId, name, role, socketId, joinedAt }>
 *
 * In a multi-instance deployment, replace with Redis Hash.
 */
const rooms = new Map();

const getRoomParticipants = (roomId) => {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
};

const serializeParticipants = (participants) =>
  Array.from(participants.values()).map(({ userId, name, role, joinedAt }) => ({
    userId,
    name,
    role,
    joinedAt,
  }));

const registerRoomHandlers = (io, socket) => {
  // ─── join ──────────────────────────────────────────────────────────────────
  const joinRoom = async ({ roomId, name, role = "candidate" }) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("room:error", { message: "roomId must be a non-empty string" });
      return;
    }

    const displayName = String(name || "Anonymous").slice(0, 64);
    const safeRole = ["host", "interviewer", "candidate", "observer"].includes(role)
      ? role
      : "candidate";
    const participants = getRoomParticipants(roomId);

    // ── Reconnect detection ──────────────────────────────────────────────────
    let isReconnect = false;
    for (const [oldSocketId, info] of participants.entries()) {
      if (info.userId === socket.user.id && oldSocketId !== socket.id) {
        participants.delete(oldSocketId);
        isReconnect = true;
        console.log(
          `[Socket] ${displayName} reconnected to room ${roomId} (old socket ${oldSocketId} replaced)`
        );
        break;
      }
    }

    // ── Register participant ─────────────────────────────────────────────────
    participants.set(socket.id, {
      userId: socket.user.id,
      name: displayName,
      role: safeRole,
      socketId: socket.id,
      joinedAt: Date.now(),
    });

    socket.join(roomId);

    // ── Initialise Y.Doc for this room (restore from Redis if needed) ────────
    // NOTE: Yjs state is sent to the client via yjs:sync-step1/step2 handshake
    // initiated by the client immediately after receiving room:snapshot.
    await getYjsHandlers().onRoomJoin(roomId);

    // ── Send room:snapshot (participants only — no code, no language) ────────
    // The client will issue yjs:sync-step1 after this to get the Y.Doc state.
    socket.emit("room:snapshot", {
      roomId,
      participants: serializeParticipants(participants),
    });

    // ── Notify others ────────────────────────────────────────────────────────
    const eventName = isReconnect ? "user_reconnected" : "user_joined";
    socket.to(roomId).emit(eventName, {
      roomId,
      userId: socket.user.id,
      name: displayName,
      role: safeRole,
    });

    // ── Broadcast updated participant list to everyone ────────────────────────
    io.to(roomId).emit("room:participants", {
      roomId,
      participants: serializeParticipants(participants),
    });

    console.log(
      `[Socket] ${displayName} (${safeRole}) ${isReconnect ? "rejoined" : "joined"} room ${roomId} (socket ${socket.id})`
    );
  };

  // ─── leave ─────────────────────────────────────────────────────────────────
  const leaveRoom = async (roomId) => {
    if (!roomId || typeof roomId !== "string") return;

    const participants = rooms.get(roomId);
    if (!participants) return;

    const participant = participants.get(socket.id);
    if (!participant) return;

    participants.delete(socket.id);
    socket.leave(roomId);

    socket.to(roomId).emit("user_left", {
      roomId,
      userId: participant.userId,
      name: participant.name,
      role: participant.role,
    });

    if (participants.size > 0) {
      io.to(roomId).emit("room:participants", {
        roomId,
        participants: serializeParticipants(participants),
      });
    } else {
      rooms.delete(roomId);
      console.log(`[Socket] Room ${roomId} is now empty.`);
    }

    console.log(`[Socket] ${participant.name} left room ${roomId}`);
  };

  // ─── end room (host / interviewer authority) ────────────────────────────────
  const endRoom = async ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;

    const participants = rooms.get(roomId);
    if (!participants) return;

    const participant = participants.get(socket.id);
    if (!participant) return;

    if (participant.role !== "host" && participant.role !== "interviewer") {
      socket.emit("room:error", { message: "Only the host or interviewer can end the room" });
      return;
    }

    io.to(roomId).emit("room:ended", { roomId, endedBy: participant.name });

    // Destroy Y.Doc and clear Redis state
    getYjsHandlers().onRoomEnd(roomId);
    await clearYjsSnapshot(roomId);

    rooms.delete(roomId);
    console.log(`[Socket] Room ${roomId} ended by ${participant.name}`);
  };

  // ─── wire events ───────────────────────────────────────────────────────────
  socket.on("room:join",  joinRoom);
  socket.on("room:leave", leaveRoom);
  socket.on("room:end",   endRoom);

  socket.on("disconnect", () => {
    rooms.forEach((_participants, roomId) => leaveRoom(roomId));
  });
};

/** Exported so yjsHandlers can verify membership before broadcasting. */
const getRoomState = (roomId) => {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
};

module.exports = { registerRoomHandlers, getRoomState };
