/**
 * In-memory room state. Maps roomId → Map<socketId, {userId, name}>.
 * This is process-local; in a multi-instance deployment, use Redis Pub/Sub instead.
 */
const rooms = new Map();

const getRoomState = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

const registerRoomHandlers = (io, socket) => {
  /** Join a room. Idempotent — rejoining is safe. */
  const joinRoom = ({ roomId, name }) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("room:error", { message: "roomId must be a non-empty string" });
      return;
    }

    const displayName = (name || "Anonymous").slice(0, 64);
    const participants = getRoomState(roomId);

    participants.set(socket.id, {
      userId: socket.user.id,
      name: displayName,
    });

    socket.join(roomId);

    // Broadcast full participant list to everyone in room (including joiner).
    io.to(roomId).emit("room:participants", {
      roomId,
      participants: Array.from(participants.values()),
    });

    // Notify others of the new arrival.
    socket.to(roomId).emit("room:user-joined", {
      roomId,
      userId: socket.user.id,
      name: displayName,
    });

    console.log(`[Socket] ${displayName} joined room ${roomId} (socket ${socket.id})`);
  };

  /** Leave a room. Called explicitly and on disconnect. */
  const leaveRoom = (roomId) => {
    if (!roomId || typeof roomId !== "string") return;

    const participants = rooms.get(roomId);
    if (!participants) return;

    const participant = participants.get(socket.id);
    if (!participant) return;

    participants.delete(socket.id);
    socket.leave(roomId);

    if (participants.size === 0) {
      rooms.delete(roomId);
    }

    socket.to(roomId).emit("room:user-left", {
      roomId,
      userId: participant.userId,
      name: participant.name,
    });

    // Broadcast updated list to remaining participants.
    if (participants.size > 0) {
      io.to(roomId).emit("room:participants", {
        roomId,
        participants: Array.from(participants.values()),
      });
    }

    console.log(`[Socket] ${participant.name} left room ${roomId}`);
  };

  socket.on("room:join", joinRoom);
  socket.on("room:leave", leaveRoom);

  // On disconnect, leave every room this socket was in.
  socket.on("disconnect", () => {
    rooms.forEach((_participants, roomId) => leaveRoom(roomId));
  });
};

module.exports = { registerRoomHandlers, getRoomState };
