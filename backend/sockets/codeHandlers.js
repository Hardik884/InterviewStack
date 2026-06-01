/**
 * codeHandlers.js — Production-grade code synchronisation handlers.
 *
 * Improvements over original:
 *   - Persist code + language to Redis on every code:sync
 *   - Verify socket is in the actual Socket.IO room (not just in-memory map)
 *   - Distinct language:change event
 *   - cursor:move and selection:change events with server-side throttle
 *   - Editor activity event (editor_updated)
 *   - Typing indicators include display name
 */

const { getRoomState } = require("./roomHandlers");
const { setRoomSnapshot, getRoomSnapshot } = require("./roomStateService");

const MAX_CODE_LENGTH = 100_000; // 100 KB hard cap

/**
 * Per-socket cursor throttle tracker.
 * Maps socketId → timestamp of last cursor:move broadcast.
 */
const lastCursorBroadcast = new Map();
const CURSOR_THROTTLE_MS = 50; // ~20fps

/**
 * Returns true if the socket is genuinely inside the named Socket.IO room
 * AND is tracked in the in-memory participant map.
 */
const isAuthorised = (socket, roomId) => {
  const inSocketRoom = socket.rooms.has(roomId);
  const participants = getRoomState(roomId);
  const inParticipants = participants.has(socket.id);
  return inSocketRoom && inParticipants;
};

const registerCodeHandlers = (io, socket) => {
  // ─── code:sync ────────────────────────────────────────────────────────────
  const syncCode = async ({ roomId, code, language }) => {
    if (!roomId || typeof roomId !== "string") {
      socket.emit("code:error", { message: "roomId is required" });
      return;
    }

    if (typeof code === "string" && code.length > MAX_CODE_LENGTH) {
      socket.emit("code:error", { message: "Code payload too large (100 KB limit)" });
      return;
    }

    if (!isAuthorised(socket, roomId)) {
      socket.emit("code:error", { message: "You must join the room first" });
      return;
    }

    const payload = {
      roomId,
      code,
      language,
      userId: socket.user.id,
    };

    // Broadcast to all OTHER sockets in the room.
    socket.to(roomId).emit("code:update", payload);

    // Also emit editor_updated activity event.
    socket.to(roomId).emit("editor_updated", {
      roomId,
      userId: socket.user.id,
      language,
    });

    // Persist latest snapshot to Redis.
    if (typeof code === "string") {
      await setRoomSnapshot(roomId, {
        code,
        language: language || "javascript",
      });
    }
  };

  // ─── language:change ──────────────────────────────────────────────────────
  // Emitted when a user explicitly changes language (distinct from code sync).
  const changeLanguage = async ({ roomId, language }) => {
    if (!roomId || typeof roomId !== "string") return;
    if (!language || typeof language !== "string") return;

    if (!isAuthorised(socket, roomId)) return;

    socket.to(roomId).emit("language_changed", {
      roomId,
      language,
      userId: socket.user.id,
    });

    // Persist language change to Redis snapshot without overwriting code.
    const snapshot = await getRoomSnapshot(roomId);
    await setRoomSnapshot(roomId, {
      code: snapshot?.code ?? "",
      language,
    });
  };

  // ─── cursor:move ──────────────────────────────────────────────────────────
  const cursorMove = ({ roomId, line, column }) => {
    if (!roomId || !isAuthorised(socket, roomId)) return;

    // Server-side throttle: drop cursor events that arrive faster than 50ms.
    const now = Date.now();
    const last = lastCursorBroadcast.get(socket.id) || 0;
    if (now - last < CURSOR_THROTTLE_MS) return;
    lastCursorBroadcast.set(socket.id, now);

    const participants = getRoomState(roomId);
    const participant = participants.get(socket.id);

    socket.to(roomId).emit("cursor_moved", {
      roomId,
      userId: socket.user.id,
      name: participant?.name ?? "Anonymous",
      role: participant?.role ?? "candidate",
      line: Number(line) || 1,
      column: Number(column) || 1,
    });
  };

  // ─── selection:change ─────────────────────────────────────────────────────
  const selectionChange = ({ roomId, startLine, startColumn, endLine, endColumn }) => {
    if (!roomId || !isAuthorised(socket, roomId)) return;

    const participants = getRoomState(roomId);
    const participant = participants.get(socket.id);

    socket.to(roomId).emit("selection_changed", {
      roomId,
      userId: socket.user.id,
      name: participant?.name ?? "Anonymous",
      role: participant?.role ?? "candidate",
      startLine: Number(startLine) || 1,
      startColumn: Number(startColumn) || 1,
      endLine: Number(endLine) || 1,
      endColumn: Number(endColumn) || 1,
    });
  };

  // ─── typing indicators ────────────────────────────────────────────────────
  const typingStart = ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    const participants = getRoomState(roomId);
    const participant = participants.get(socket.id);

    socket.to(roomId).emit("typing_started", {
      roomId,
      userId: socket.user.id,
      name: participant?.name ?? "Anonymous",
      role: participant?.role ?? "candidate",
    });
  };

  const typingStop = ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    if (!isAuthorised(socket, roomId)) return;

    const participants = getRoomState(roomId);
    const participant = participants.get(socket.id);

    socket.to(roomId).emit("typing_stopped", {
      roomId,
      userId: socket.user.id,
      name: participant?.name ?? "Anonymous",
      role: participant?.role ?? "candidate",
    });
  };

  // ─── wire events ──────────────────────────────────────────────────────────
  socket.on("code:sync", syncCode);
  socket.on("language:change", changeLanguage);
  socket.on("cursor:move", cursorMove);
  socket.on("selection:change", selectionChange);
  socket.on("typing:start", typingStart);
  socket.on("typing:stop", typingStop);

  // Clean up throttle tracking on disconnect.
  socket.on("disconnect", () => {
    lastCursorBroadcast.delete(socket.id);
  });
};

module.exports = { registerCodeHandlers };
