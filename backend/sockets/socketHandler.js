const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { registerRoomHandlers } = require("./roomHandlers");
const { registerYjsHandlers, initRedisPubSub } = require("./yjsHandlers");
const { setIO } = require("./socketRegistry");

const initSocket = (httpServer) => {
  const allowedOrigin = process.env.CLIENT_URL || "*";

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Keep-alive: detect stale connections quickly without dropping healthy ones.
    pingTimeout: 20000,
    pingInterval: 25000,
    // Allow WebSocket with polling fallback for restrictive networks.
    transports: ["websocket", "polling"],
    // Yjs binary updates can be larger — 5 MB max buffer.
    maxHttpBufferSize: 5e6,
  });

  // ── JWT authentication middleware ─────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = process.env.JWT_SECRET;

      if (!token) return next(new Error("Authentication token missing"));
      if (!secret) {
        console.error("[Socket] JWT_SECRET not configured");
        return next(new Error("Server misconfiguration"));
      }

      const decoded = jwt.verify(token, secret);
      if (!decoded.id) return next(new Error("Token payload invalid"));

      socket.user = {
        id: String(decoded.id),
        name: decoded.name || "Anonymous",
      };

      return next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (user ${socket.user.id})`);

    registerRoomHandlers(io, socket);
    registerYjsHandlers(io, socket);   // ← Yjs CRDT handlers (replaces registerCodeHandlers)

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (user ${socket.user.id}) — ${reason}`);
    });

    socket.on("error", (err) => {
      console.error(`[Socket] Error on ${socket.id}:`, err.message);
    });
  });

  setIO(io);

  // ── Redis Pub/Sub for multi-instance Yjs propagation ─────────────────────
  initRedisPubSub(io);

  return io;
};

module.exports = initSocket;
