const { getRoomState } = require("./roomHandlers");

const MAX_CODE_LENGTH = 100_000; // 100KB per sync

const registerCodeHandlers = (io, socket) => {
  const syncCode = ({ roomId, code, language }) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("code:error", { message: "roomId is required" });
      return;
    }

    // Guard against massive payloads that could flood other clients.
    if (typeof code === "string" && code.length > MAX_CODE_LENGTH) {
      socket.emit("code:error", { message: "Code payload too large" });
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
    if (!roomId || typeof roomId !== "string") return;
    socket.to(roomId).emit("typing:start", { roomId, userId: socket.user.id });
  };

  const typingStop = ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.to(roomId).emit("typing:stop", { roomId, userId: socket.user.id });
  };

  socket.on("code:sync", syncCode);
  socket.on("typing:start", typingStart);
  socket.on("typing:stop", typingStop);
};

module.exports = { registerCodeHandlers };
