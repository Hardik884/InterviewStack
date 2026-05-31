const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { registerRoomHandlers } = require("./roomHandlers");
const { registerCodeHandlers } = require("./codeHandlers");
const { setIO } = require("./socketRegistry");

const initSocket = (httpServer) => {
  const allowedOrigin = process.env.CLIENT_URL || "*";

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Reconnection pings so the server knows when a client is truly gone.
    pingTimeout: 20000,
    pingInterval: 25000,
    // Prefer WebSocket but fall back to polling in restricted environments.
    transports: ["websocket", "polling"],
  });

  // ── JWT authentication middleware ─────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = process.env.JWT_SECRET;

      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      if (!secret) {
        console.error("[Socket] JWT_SECRET not configured");
        return next(new Error("Server misconfiguration"));
      }

      const decoded = jwt.verify(token, secret);

      if (!decoded.id) {
        return next(new Error("Token payload invalid"));
      }

      socket.user = { id: String(decoded.id) };
      return next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (user ${socket.user.id})`);

    registerRoomHandlers(io, socket);
    registerCodeHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} — ${reason}`);
    });
  });

  setIO(io);
  return io;
};

module.exports = initSocket;
