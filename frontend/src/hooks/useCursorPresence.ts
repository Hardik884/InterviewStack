/**
 * useCursorPresence.ts
 *
 * Manages real-time cursor + selection decorations in Monaco Editor
 * for remote participants.
 *
 * Features:
 *   - Throttled cursor:move emission (50ms client-side guard)
 *   - Throttled selection:change emission (80ms)
 *   - Deterministic HSL color per userId
 *   - Monaco deltaDecorations for cursor line + selection range
 *   - Inline cursor label above the cursor position
 *   - Cleans up decorations when a user leaves
 */

import { useCallback, useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import { getSocket } from "../sockets/socketClient";
import type { ParticipantRole } from "./useInterviewRoom";

type RemoteCursor = {
  userId: string;
  name: string;
  role: ParticipantRole;
  line: number;
  column: number;
};

type RemoteSelection = {
  userId: string;
  name: string;
  role: ParticipantRole;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

type CursorPresenceArgs = {
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  roomId: string;
  myUserId: string;
  /** IDs of users currently in the room — used to clean up departed user decorations. */
  participantIds: string[];
};

// ── Color palette ──────────────────────────────────────────────────────────
const CURSOR_COLORS = [
  "#f97316", // orange
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#6366f1", // indigo
];

/** Deterministic color from userId string. */
const colorForUser = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

/** Hex color → rgba string with given opacity. */
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const useCursorPresence = ({
  editorRef,
  roomId,
  myUserId,
  participantIds,
}: CursorPresenceArgs) => {
  // Maps userId → Monaco decoration IDs (string[])
  const decorationsRef = useRef<Map<string, string[]>>(new Map());
  // Maps userId → latest cursor/selection data
  const cursorDataRef = useRef<Map<string, RemoteCursor & Partial<RemoteSelection>>>(new Map());

  const lastCursorEmit = useRef(0);
  const lastSelectionEmit = useRef(0);
  const CURSOR_THROTTLE_MS = 50;
  const SELECTION_THROTTLE_MS = 80;

  // ── Apply decorations for a user ─────────────────────────────────────────
  const applyDecorations = useCallback(
    (userId: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const data = cursorDataRef.current.get(userId);
      if (!data) return;

      const color = colorForUser(userId);
      const model = editor.getModel();
      if (!model) return;

      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

      // ── Cursor line decoration ───────────────────────────────────────────
      const cursorLineCount = model.getLineCount();
      const safeLine = Math.max(1, Math.min(data.line, cursorLineCount));
      const lineMaxCol = model.getLineMaxColumn(safeLine);
      const safeCol = Math.max(1, Math.min(data.column, lineMaxCol));

      newDecorations.push({
        range: new (window as unknown as { monaco: typeof Monaco }).monaco.Range(
          safeLine,
          safeCol,
          safeLine,
          safeCol
        ),
        options: {
          className: `remote-cursor-${userId}`,
          beforeContentClassName: `remote-cursor-flag-${userId}`,
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
          zIndex: 100,
        },
      });

      // ── Selection range decoration ───────────────────────────────────────
      if (
        data.startLine != null &&
        data.endLine != null &&
        !(data.startLine === data.endLine && data.startColumn === data.endColumn)
      ) {
        newDecorations.push({
          range: new (window as unknown as { monaco: typeof Monaco }).monaco.Range(
            data.startLine,
            data.startColumn,
            data.endLine,
            data.endColumn
          ),
          options: {
            className: `remote-selection-${userId}`,
            stickiness: 1,
          },
        });
      }

      // ── Apply CSS for this user ──────────────────────────────────────────
      ensureCursorStyles(userId, data.name, data.role, color);

      // ── deltaDecorations ─────────────────────────────────────────────────
      const oldIds = decorationsRef.current.get(userId) ?? [];
      const newIds = editor.deltaDecorations(oldIds, newDecorations);
      decorationsRef.current.set(userId, newIds);
    },
    [editorRef]
  );

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const onCursorMoved = (payload: RemoteCursor & { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      if (payload.userId === myUserId) return; // Ignore own echoes

      cursorDataRef.current.set(payload.userId, {
        ...(cursorDataRef.current.get(payload.userId) ?? {}),
        userId: payload.userId,
        name: payload.name,
        role: payload.role,
        line: payload.line,
        column: payload.column,
      });
      applyDecorations(payload.userId);
    };

    const onSelectionChanged = (payload: RemoteSelection & { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      if (payload.userId === myUserId) return;

      cursorDataRef.current.set(payload.userId, {
        ...(cursorDataRef.current.get(payload.userId) ?? {
          userId: payload.userId,
          name: payload.name,
          role: payload.role,
          line: payload.startLine,
          column: payload.startColumn,
        }),
        startLine: payload.startLine,
        startColumn: payload.startColumn,
        endLine: payload.endLine,
        endColumn: payload.endColumn,
      });
      applyDecorations(payload.userId);
    };

    socket.on("cursor_moved", onCursorMoved);
    socket.on("selection_changed", onSelectionChanged);

    return () => {
      socket.off("cursor_moved", onCursorMoved);
      socket.off("selection_changed", onSelectionChanged);
    };
  }, [roomId, myUserId, applyDecorations]);

  // ── Clean up decorations for users who left ──────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const trackedIds = Array.from(decorationsRef.current.keys());
    for (const userId of trackedIds) {
      if (!participantIds.includes(userId) && userId !== myUserId) {
        const oldIds = decorationsRef.current.get(userId) ?? [];
        editor.deltaDecorations(oldIds, []);
        decorationsRef.current.delete(userId);
        cursorDataRef.current.delete(userId);
        // Remove injected CSS for this user.
        const styleEl = document.getElementById(`cursor-style-${userId}`);
        styleEl?.remove();
      }
    }
  }, [participantIds, myUserId, editorRef]);

  // ── Outgoing: emit cursor position ───────────────────────────────────────
  const emitCursorPosition = useCallback(
    (line: number, column: number) => {
      const now = Date.now();
      if (now - lastCursorEmit.current < CURSOR_THROTTLE_MS) return;
      lastCursorEmit.current = now;

      const socket = getSocket();
      if (!socket?.connected) return;
      socket.volatile.emit("cursor:move", { roomId, line, column });
    },
    [roomId]
  );

  // ── Outgoing: emit selection ─────────────────────────────────────────────
  const emitSelection = useCallback(
    (startLine: number, startColumn: number, endLine: number, endColumn: number) => {
      const now = Date.now();
      if (now - lastSelectionEmit.current < SELECTION_THROTTLE_MS) return;
      lastSelectionEmit.current = now;

      const socket = getSocket();
      if (!socket?.connected) return;
      socket.volatile.emit("selection:change", {
        roomId,
        startLine,
        startColumn,
        endLine,
        endColumn,
      });
    },
    [roomId]
  );

  // ── Wire Monaco cursor/selection events ───────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const disposeCursor = editor.onDidChangeCursorPosition((e) => {
      emitCursorPosition(e.position.lineNumber, e.position.column);
    });

    const disposeSelection = editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      emitSelection(
        sel.startLineNumber,
        sel.startColumn,
        sel.endLineNumber,
        sel.endColumn
      );
    });

    return () => {
      disposeCursor.dispose();
      disposeSelection.dispose();
    };
  }, [editorRef.current, emitCursorPosition, emitSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  return { emitCursorPosition, emitSelection };
};

// ── CSS injection for per-user cursor styles ──────────────────────────────

const roleLabel = (role: ParticipantRole) => {
  switch (role) {
    case "host":
    case "interviewer":
      return "Interviewer";
    case "candidate":
      return "Candidate";
    default:
      return role;
  }
};

const ensureCursorStyles = (
  userId: string,
  name: string,
  role: ParticipantRole,
  color: string
) => {
  const styleId = `cursor-style-${userId}`;
  if (document.getElementById(styleId)) return; // already injected

  const label = name || roleLabel(role);
  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = `
    /* Cursor line for ${label} */
    .remote-cursor-${userId} {
      border-left: 2px solid ${color} !important;
      position: relative;
    }
    /* Label flag above cursor */
    .remote-cursor-flag-${userId}::before {
      content: "${label.replace(/"/g, "'")}";
      position: absolute;
      top: -20px;
      left: 0;
      background: ${color};
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      font-family: system-ui, sans-serif;
      padding: 1px 5px;
      border-radius: 3px 3px 3px 0;
      white-space: nowrap;
      pointer-events: none;
      z-index: 200;
      line-height: 16px;
    }
    /* Selection highlight */
    .remote-selection-${userId} {
      background: ${hexToRgba(color, 0.2)} !important;
    }
  `;
  document.head.appendChild(styleEl);
};
