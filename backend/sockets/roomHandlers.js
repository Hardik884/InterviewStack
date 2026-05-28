const rooms = new Map();

const getRoomState = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  return rooms.get(roomId);
};

const registerRoomHandlers = (io, socket) => {
  const joinRoom = ({ roomId, name }) => {
    if (!roomId) {
      socket.emit("room:error", { message: "roomId is required" });
      return;
    }

    const participants = getRoomState(roomId);
    participants.set(socket.id, {
      userId: socket.user.id,
      name: name || "Anonymous",
    });

    socket.join(roomId);

    io.to(roomId).emit("room:participants", {
      roomId,
      participants: Array.from(participants.values()),
    });

    socket.to(roomId).emit("room:user-joined", {
      roomId,
      userId: socket.user.id,
      name: name || "Anonymous",
    });
  };

  const leaveRoom = (roomId) => {
    if (!roomId) {
      return;
    }

    const participants = rooms.get(roomId);
    if (!participants) {
      return;
    }

    const participant = participants.get(socket.id);
    participants.delete(socket.id);
    socket.leave(roomId);

    if (participants.size === 0) {
      rooms.delete(roomId);
    }

    if (participant) {
      socket.to(roomId).emit("room:user-left", {
        roomId,
        userId: participant.userId,
        name: participant.name,
      });
    }

    io.to(roomId).emit("room:participants", {
      roomId,
      participants: Array.from(participants.values()),
    });
  };

  socket.on("room:join", joinRoom);
  socket.on("room:leave", leaveRoom);

  socket.on("disconnect", () => {
    rooms.forEach((_participants, roomId) => leaveRoom(roomId));
  });
};

module.exports = {
  registerRoomHandlers,
  getRoomState,
};
