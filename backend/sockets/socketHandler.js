const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { createAdapter } = require("@socket.io/redis-adapter");
const { registerRoomHandlers } = require("./roomHandlers");
const { registerYjsHandlers, initRedisPubSub } = require("./yjsHandlers");
const { setIO } = require("./socketRegistry");
const { isAllowedOrigin } = require("../config/cors");
const { checkSocketConnectionLimit } = require("../middleware/rateLimit");
const { bullConnection } = require("../config/redis");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      },
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

  // ── JWT authentication + connection rate limit middleware ─────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = process.env.JWT_SECRET;

      if (!token) return next(new Error("Authentication token missing"));
      if (!secret) {
        console.error("[Socket] JWT_SECRET not configured");
        return next(new Error("Server misconfiguration"));
      }

      // Per-IP connection rate limit to blunt connection floods.
      const ip =
        socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        socket.handshake.address;
      const withinLimit = await checkSocketConnectionLimit(ip);
      if (!withinLimit) {
        return next(new Error("Too many connection attempts"));
      }

      const decoded = jwt.verify(token, secret);
      if (!decoded.id) return next(new Error("Token payload invalid"));

      socket.user = {
        id: String(decoded.id),
        name: decoded.name || "Anonymous",
        role: decoded.role || "candidate",
      };

      return next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  // ── Redis adapter for cross-instance broadcasts ──────────────────────────
  // Makes io.to(room).emit(...) and personal "user:<id>" room emits work across
  // multiple backend instances. Degrades gracefully to the in-memory adapter
  // (single instance) if Redis is unavailable.
  try {
    const pubClient = bullConnection.duplicate();
    const subClient = bullConnection.duplicate();
    pubClient.on("error", () => {});
    subClient.on("error", () => {});
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket] Redis adapter attached (multi-instance broadcasts active)");
  } catch (err) {
    console.warn("[Socket] Redis adapter unavailable — single-instance only:", err.message);
  }

  // ── Connection handler ────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (user ${socket.user.id})`);

    // Personal room for cross-instance, user-targeted events (submission/AI
    // feedback updates). Replaces O(connections) socket scans.
    socket.join(`user:${socket.user.id}`);

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
