/**
 * cors.js — Centralised CORS origin allow-list.
 *
 * Shared by the Express app and the Socket.IO server so HTTP and WebSocket
 * upgrades enforce identical rules. Wildcard origins are NOT permitted.
 *
 * Allowed origins:
 *   - localhost dev ports (Vite dev + preview)
 *   - explicit production origins from CLIENT_URLS / CLIENT_URL (comma-separated)
 *   - Vercel preview deployments (*.vercel.app)
 */

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const parseConfiguredOrigins = () => {
  const raw = `${process.env.CLIENT_URLS || ""},${process.env.CLIENT_URL || ""}`;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value !== "*");
};

const allowedOrigins = Array.from(
  new Set([...DEFAULT_DEV_ORIGINS, ...parseConfiguredOrigins()])
);

/**
 * Returns true if the given Origin header value is permitted.
 * A missing origin (same-origin requests, curl, server-to-server) is allowed.
 */
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow Vercel preview/production deployments by hostname suffix.
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
  } catch (_) {
    return false;
  }

  return false;
};

/** Express cors() options object using the allow-list checker. */
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

module.exports = {
  allowedOrigins,
  isAllowedOrigin,
  corsOptions,
};
