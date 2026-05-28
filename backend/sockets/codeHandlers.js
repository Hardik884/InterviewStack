const { getRoomState } = require("./roomHandlers");

const registerCodeHandlers = (io, socket) => {
  const syncCode = ({ roomId, code, language }) => {
    if (!roomId) {
      socket.emit("code:error", { message: "roomId is required" });
      return;
    }

    const participants = getRoomState(roomId);
    if (!participants.has(socket.id)) {
      socket.emit("code:error", { message: "You must join the room first" });
      return;
    }

    socket.to(roomId).emit("code:update", {
      roomId,
      code,
      language,
      userId: socket.user.id,
    });
  };

  const typingStart = ({ roomId }) => {
    if (!roomId) {
      return;
    }

    socket.to(roomId).emit("typing:start", {
      roomId,
      userId: socket.user.id,
    });
  };

  const typingStop = ({ roomId }) => {
    if (!roomId) {
      return;
    }

    socket.to(roomId).emit("typing:stop", {
      roomId,
      userId: socket.user.id,
    });
  };

  socket.on("code:sync", syncCode);
  socket.on("typing:start", typingStart);
  socket.on("typing:stop", typingStop);
};

module.exports = {
  registerCodeHandlers,
};
