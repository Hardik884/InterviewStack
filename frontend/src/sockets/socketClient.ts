import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "../utils/constants";

let socket: Socket | null = null;
let activeToken: string | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket?.connected && activeToken === token) {
    return socket;
  }

  if (socket?.connected && activeToken && activeToken !== token) {
    (socket.auth as Record<string, unknown>).token = token;
    socket.disconnect();
    socket.connect();
    activeToken = token;
    return socket;
  }

  if (socket) {
    // Socket exists but disconnected — update auth token and reconnect.
    (socket.auth as Record<string, unknown>).token = token;
    socket.connect();
    activeToken = token;
    return socket;
  }

  socket = io(SOCKET_URL, {
    // Prefer WebSocket but fall back to long-polling for restrictive networks.
    transports: ["websocket", "polling"],
    auth: { token },
    // Reconnection: try up to 15 times with exponential back-off capped at 8s.
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    // Randomise delay to prevent thundering-herd on server restart.
    randomizationFactor: 0.5,
    // Time to wait for initial connection before giving up.
    timeout: 10000,
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  socket.on("reconnect_attempt", (attempt) => {
    console.info(`[Socket] Reconnect attempt #${attempt}`);
  });

  socket.on("reconnect", () => {
    console.info("[Socket] Reconnected successfully");
  });

  activeToken = token;

  return socket;
};

/** Returns the current socket instance (may be null or disconnected). */
export const getSocket = (): Socket | null => socket;

/**
 * Disconnect and destroy the current socket.
 * Call this on logout or when the user explicitly leaves all rooms.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeToken = null;
};

/**
 * Force a fresh socket connection with a new token.
 * Use after token refresh or when the old socket is irreparably broken.
 */
export const resetSocket = (token: string): Socket => {
  disconnectSocket();
  return connectSocket(token);
};
