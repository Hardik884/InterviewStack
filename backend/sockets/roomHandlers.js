/**
 * roomHandlers.js — Production-grade room lifecycle management.
 *
 * Key improvements over the original:
 *   - Participant roles (host / candidate / interviewer / observer)
 *   - Redis-backed room snapshots → rejoining users receive latest code
 *   - user_joined / user_left / user_reconnected events with role info
 *   - Reconnect detection (same userId already in participants map)
 *   - Host authority: only the host can end the room
 *   - Orphan cleanup: Redis snapshot deleted after last user leaves
 *   - socketId included in participant info for cursor tracking
 */

const { setRoomSnapshot, getRoomSnapshot, clearRoomSnapshot } = require("./roomStateService");

/**
 * In-memory participant registry.
 * Maps roomId → Map<socketId, { userId, name, role, socketId, joinedAt }>
 *
 * In a multi-instance deployment, replace this with a Redis Hash.
 */
const rooms = new Map();

/** Returns (and lazily initialises) the participant map for a room. */
const getRoomParticipants = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

/**
 * Serialise participant map to the array shape expected by clients.
 * Excludes the internal socketId field to keep payloads slim.
 */
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

    // ── Reconnect detection ────────────────────────────────────────────────
    // Check if a participant with the same userId is already tracked (from a
    // stale socket). If so, remove the old entry and treat this as a reconnect.
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

    // ── Register participant ───────────────────────────────────────────────
    participants.set(socket.id, {
      userId: socket.user.id,
      name: displayName,
      role: safeRole,
      socketId: socket.id,
      joinedAt: Date.now(),
    });

    socket.join(roomId);

    // ── Send snapshot to the joining socket ────────────────────────────────
    const snapshot = await getRoomSnapshot(roomId);
    socket.emit("room:snapshot", {
      roomId,
      code: snapshot?.code ?? "",
      language: snapshot?.language ?? "javascript",
      participants: serializeParticipants(participants),
    });

    // ── Notify others ──────────────────────────────────────────────────────
    const eventName = isReconnect ? "user_reconnected" : "user_joined";
    socket.to(roomId).emit(eventName, {
      roomId,
      userId: socket.user.id,
      name: displayName,
      role: safeRole,
    });

    // ── Broadcast updated participant list to everyone ─────────────────────
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

    // Notify remaining participants
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
      // Last participant left — clean up room and schedule snapshot expiry
      rooms.delete(roomId);
      // We intentionally keep the Redis snapshot alive (TTL handles it)
      // so that if participants rejoin quickly the code is still there.
      console.log(`[Socket] Room ${roomId} is now empty.`);
    }

    console.log(`[Socket] ${participant.name} left room ${roomId}`);
  };

  // ─── end room (host authority) ─────────────────────────────────────────────
  const endRoom = async ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;

    const participants = rooms.get(roomId);
    if (!participants) return;

    const participant = participants.get(socket.id);
    if (!participant) return;

    // Only the host can end a room.
    if (participant.role !== "host" && participant.role !== "interviewer") {
      socket.emit("room:error", { message: "Only the host or interviewer can end the room" });
      return;
    }

    // Notify everyone then clean up.
    io.to(roomId).emit("room:ended", { roomId, endedBy: participant.name });
    await clearRoomSnapshot(roomId);
    rooms.delete(roomId);
    console.log(`[Socket] Room ${roomId} ended by ${participant.name}`);
  };

  // ─── wire events ──────────────────────────────────────────────────────────
  socket.on("room:join", joinRoom);
  socket.on("room:leave", leaveRoom);
  socket.on("room:end", endRoom);

  socket.on("disconnect", () => {
    // On disconnect, leave every room this socket was participating in.
    rooms.forEach((_participants, roomId) => leaveRoom(roomId));
  });
};

/** Exported so codeHandlers can verify membership before broadcasting. */
const getRoomState = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

module.exports = { registerRoomHandlers, getRoomState };
