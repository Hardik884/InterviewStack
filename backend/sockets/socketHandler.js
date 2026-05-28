const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { registerRoomHandlers } = require("./roomHandlers");
const { registerCodeHandlers } = require("./codeHandlers");
const { setIO } = require("./socketRegistry");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket authentication using JWT from the handshake
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = process.env.JWT_SECRET;

      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      if (!secret) {
        return next(new Error("JWT_SECRET is not defined"));
      }

      const decoded = jwt.verify(token, secret);
      socket.user = { id: decoded.id };
      return next();
    } catch (error) {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    registerRoomHandlers(io, socket);
    registerCodeHandlers(io, socket);
  });

  setIO(io);

  return io;
};

module.exports = initSocket;
