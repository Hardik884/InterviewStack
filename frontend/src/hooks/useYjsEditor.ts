/**
 * useYjsEditor.ts — Production Yjs CRDT collaborative editor hook.
 *
 * Replaces both useCollaborativeEditor.ts and useCursorPresence.ts.
 *
 * Architecture:
 *   Y.Doc (per room) → Y.Text("code") ↔ MonacoBinding ↔ Monaco Editor
 *   Awareness ↔ Socket.IO (yjs:awareness) → Remote cursor decorations
 *
 * Socket events consumed:
 *   yjs:sync-step2   — server sends missing Y.Doc updates on join
 *   yjs:update       — incoming CRDT delta from peers
 *   yjs:awareness    — remote cursor / presence updates
 *   language:changed — language sync from server
 *
 * Socket events emitted:
 *   yjs:sync-step1   — sent on (re)connect with local state vector
 *   yjs:update       — outgoing CRDT delta
 *   yjs:awareness    — outgoing cursor / presence update
 *   language:change  — language change request
 *
 * Offline handling:
 *   Y.Doc accumulates updates even when disconnected.
 *   On reconnect, yjs:sync-step1 is sent to reconcile with the server.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";
import { MonacoBinding } from "y-monaco";
import type * as Monaco from "monaco-editor";
import { getSocket } from "../sockets/socketClient";
import type { ParticipantRole } from "./useInterviewRoom";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AwarenessUser = {
  id: string;
  name: string;
  role: ParticipantRole;
  color: string;
};

type UseYjsEditorArgs = {
  roomId: string;
  userId: string;
  userName: string;
  userRole: ParticipantRole;
  defaultCode?: string;
};

// ─── Color palette — deterministic from userId ────────────────────────────────

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

const colorForUser = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── CSS injection for remote cursor labels ───────────────────────────────────

const ensureCursorStyles = (userId: string, name: string, role: ParticipantRole, color: string) => {
  const styleId = `yjs-cursor-style-${userId}`;
  if (document.getElementById(styleId)) return;

  const label = name || (role === "interviewer" || role === "host" ? "Interviewer" : "Candidate");
  const el = document.createElement("style");
  el.id = styleId;
  el.textContent = `
    .yjs-cursor-${userId} {
      border-left: 2px solid ${color} !important;
      position: relative;
    }
    .yjs-cursor-flag-${userId}::before {
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
    .yjs-selection-${userId} {
      background: ${hexToRgba(color, 0.2)} !important;
    }
  `;
  document.head.appendChild(el);
};

const removeCursorStyles = (userId: string) => {
  document.getElementById(`yjs-cursor-style-${userId}`)?.remove();
};

// ─── Main hook ────────────────────────────────────────────────────────────────

export const useYjsEditor = ({
  roomId,
  userId,
  userName,
  userRole,
  defaultCode = "// Start coding\n",
}: UseYjsEditorArgs) => {
  const myColor = useMemo(() => colorForUser(userId), [userId]);

  // ── Y.Doc and shared types ────────────────────────────────────────────────
  const docRef       = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const yTextRef     = useRef<Y.Text | null>(null);
  const bindingRef   = useRef<MonacoBinding | null>(null);

  // Monaco editor ref (set by handleEditorMount)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // Decoration IDs per remote userId → string[]
  const decorationsRef = useRef<Map<string, string[]>>(new Map());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [language, setLanguageState] = useState<string>("javascript");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // ── Saving indicator ──────────────────────────────────────────────────────
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markSaving = useCallback(() => {
    setIsSaving(true);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => setIsSaving(false), 800);
  }, []);

  // ── Awareness update: remote cursor decorations ───────────────────────────
  const applyAwarenessDecorations = useCallback(() => {
    const editor = editorRef.current;
    const awareness = awarenessRef.current;
    if (!editor || !awareness) return;

    const model = editor.getModel();
    if (!model) return;

    const states = awareness.getStates();
    const lineCount = model.getLineCount();

    for (const [clientId, state] of states.entries()) {
      const user = state.user as AwarenessUser | undefined;
      if (!user || user.id === userId) continue; // skip self

      const cursor = state.cursor as {
        anchor: { line: number; column: number } | null;
        head: { line: number; column: number } | null;
      } | undefined;

      if (!cursor?.anchor || !cursor?.head) continue;

      const color  = colorForUser(user.id);
      const newDecs: Monaco.editor.IModelDeltaDecoration[] = [];

      // Clamp cursor position
      const line = Math.max(1, Math.min(cursor.head.line, lineCount));
      const col  = Math.max(1, Math.min(cursor.head.column, model.getLineMaxColumn(line)));

      // Cursor bar
      newDecs.push({
        range: new (window as unknown as { monaco: typeof Monaco }).monaco.Range(
          line, col, line, col
        ),
        options: {
          className: `yjs-cursor-${user.id}`,
          beforeContentClassName: `yjs-cursor-flag-${user.id}`,
          stickiness: 1,
          zIndex: 100,
        },
      });

      // Selection highlight (if anchor ≠ head)
      const al = cursor.anchor.line;
      const ac = cursor.anchor.column;
      const hl = cursor.head.line;
      const hc = cursor.head.column;

      if (al !== hl || ac !== hc) {
        const startLine = Math.min(al, hl);
        const startCol  = al < hl ? ac : (al === hl ? Math.min(ac, hc) : hc);
        const endLine   = Math.max(al, hl);
        const endCol    = al > hl ? ac : (al === hl ? Math.max(ac, hc) : hc);

        newDecs.push({
          range: new (window as unknown as { monaco: typeof Monaco }).monaco.Range(
            startLine, startCol, endLine, endCol
          ),
          options: {
            className: `yjs-selection-${user.id}`,
            stickiness: 1,
          },
        });
      }

      ensureCursorStyles(user.id, user.name, user.role, color);

      const oldIds = decorationsRef.current.get(user.id) ?? [];
      const newIds = editor.deltaDecorations(oldIds, newDecs);
      decorationsRef.current.set(user.id, newIds);
    }

    // Remove decorations for users no longer in awareness
    for (const [trackedId, oldIds] of decorationsRef.current.entries()) {
      const stillPresent = Array.from(states.values()).some(
        (s) => (s.user as AwarenessUser | undefined)?.id === trackedId
      );
      if (!stillPresent && trackedId !== userId) {
        editor.deltaDecorations(oldIds, []);
        decorationsRef.current.delete(trackedId);
        removeCursorStyles(trackedId);
      }
    }
  }, [userId]);

  // ── Emit local awareness state (cursor position + user info) ─────────────
  const lastAwarenessEmit = useRef(0);
  const AWARENESS_THROTTLE_MS = 50;

  const emitAwareness = useCallback(() => {
    const now = Date.now();
    if (now - lastAwarenessEmit.current < AWARENESS_THROTTLE_MS) return;
    lastAwarenessEmit.current = now;

    const awareness = awarenessRef.current;
    if (!awareness) return;

    // Encode current awareness state
    const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
    const arr = Array.from(update as Uint8Array);

    const socket = getSocket();
    if (socket?.connected) {
      socket.volatile.emit("yjs:awareness", { roomId, update: arr });
    }
  }, [roomId]);

  // ── Yjs doc update observer → send delta to server ────────────────────────
  const onDocUpdate = useCallback(
    (update: Uint8Array, origin: unknown) => {
      // Skip echoing updates that came FROM the server
      if (origin === "server" || origin === "redis" || origin === "redis-pubsub") return;

      markSaving();
      const arr = Array.from(update);
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("yjs:update", { roomId, update: arr });
      }
    },
    [roomId, markSaving]
  );

  // ── Initialise Y.Doc, awareness, and socket listeners ────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;

    const doc = new Y.Doc();
    const yText = doc.getText("code");
    const awareness = new Awareness(doc);

    docRef.current       = doc;
    yTextRef.current     = yText;
    awarenessRef.current = awareness;

    // Set our own awareness state
    awareness.setLocalStateField("user", {
      id:    userId,
      name:  userName,
      role:  userRole,
      color: myColor,
    });

    // Listen for awareness changes → re-render remote cursors
    const onAwarenessChange = () => {
      applyAwarenessDecorations();
      emitAwareness();
    };
    awareness.on("change", onAwarenessChange);

    // Listen for local Y.Doc updates → forward to server
    doc.on("update", onDocUpdate);

    return () => {
      doc.off("update", onDocUpdate);
      awareness.off("change", onAwarenessChange);
      awareness.destroy();
      doc.destroy();
      docRef.current       = null;
      yTextRef.current     = null;
      awarenessRef.current = null;
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, [roomId, userId, userName, userRole, myColor, onDocUpdate, applyAwarenessDecorations, emitAwareness]);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const attachListeners = () => {
      const socket = getSocket();
      if (!socket) return;

      // ── yjs:sync-step2: server sends missing updates ───────────────────────
      const onSyncStep2 = ({ roomId: rid, update, language: lang }: {
        roomId: string;
        update: number[];
        language?: string;
      }) => {
        if (rid !== roomId) return;
        const doc = docRef.current;
        if (!doc) return;

        try {
          Y.applyUpdate(doc, new Uint8Array(update), "server");
          if (lang) setLanguageState(lang);
          setIsConnected(true);
        } catch (err) {
          console.error("[Yjs] Failed to apply sync-step2:", err);
        }
      };

      // ── yjs:update: peer delta ─────────────────────────────────────────────
      const onYjsUpdate = ({ roomId: rid, update }: { roomId: string; update: number[] }) => {
        if (rid !== roomId) return;
        const doc = docRef.current;
        if (!doc) return;
        try {
          Y.applyUpdate(doc, new Uint8Array(update), "server");
        } catch (err) {
          console.error("[Yjs] Failed to apply peer update:", err);
        }
      };

      // ── yjs:awareness: peer cursor ─────────────────────────────────────────
      const onYjsAwareness = ({ roomId: rid, update }: { roomId: string; update: number[] }) => {
        if (rid !== roomId) return;
        const awareness = awarenessRef.current;
        if (!awareness) return;
        try {
          applyAwarenessUpdate(awareness, new Uint8Array(update), "server");
          applyAwarenessDecorations();
        } catch (err) {
          console.error("[Yjs] Failed to apply awareness:", err);
        }
      };

      // ── language:changed: peer changed language ────────────────────────────
      const onLanguageChanged = ({ roomId: rid, language }: { roomId: string; language: string }) => {
        if (rid !== roomId) return;
        setLanguageState(language);
      };

      // ── On (re)connect: send sync-step1 ───────────────────────────────────
      const sendSyncStep1 = () => {
        const doc = docRef.current;
        if (!doc) return;
        const sv = Y.encodeStateVector(doc);
        socket.emit("yjs:sync-step1", { roomId, stateVector: Array.from(sv) });
        setIsConnected(true);
      };

      socket.on("yjs:sync-step2",   onSyncStep2);
      socket.on("yjs:update",       onYjsUpdate);
      socket.on("yjs:awareness",    onYjsAwareness);
      socket.on("language:changed", onLanguageChanged);
      socket.on("connect",          sendSyncStep1);
      socket.on("reconnect",        sendSyncStep1);

      // Send sync-step1 immediately if already connected
      if (socket.connected) sendSyncStep1();

      return () => {
        socket.off("yjs:sync-step2",   onSyncStep2);
        socket.off("yjs:update",       onYjsUpdate);
        socket.off("yjs:awareness",    onYjsAwareness);
        socket.off("language:changed", onLanguageChanged);
        socket.off("connect",          sendSyncStep1);
        socket.off("reconnect",        sendSyncStep1);
      };
    };

    // Socket might not exist yet when this effect runs — retry briefly
    const timer = setTimeout(attachListeners, 100);
    const cleanup = attachListeners();
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [roomId, applyAwarenessDecorations]);

  // ── Monaco onMount: create MonacoBinding ─────────────────────────────────
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      const yText    = yTextRef.current;
      const awareness = awarenessRef.current;
      if (!yText || !awareness) return;

      // Destroy any previous binding
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }

      // Seed the Y.Text with defaultCode if it's empty (first user in room)
      if (yText.length === 0) {
        yText.insert(0, defaultCode);
      }

      // MonacoBinding keeps Monaco and Y.Text in sync
      // It handles:
      //   - local edits: Monaco onChange → Y.Text update
      //   - remote edits: Y.Text observe → Monaco applyEdit
      const monacoEnv = editor.getModel();
      if (!monacoEnv) return;

      bindingRef.current = new MonacoBinding(
        yText,
        monacoEnv,
        new Set([editor]),
        awareness
      );

      // Wire cursor/selection → awareness state
      editor.onDidChangeCursorPosition((e) => {
        const awareness = awarenessRef.current;
        if (!awareness) return;

        awareness.setLocalStateField("cursor", {
          anchor: {
            line:   e.position.lineNumber,
            column: e.position.column,
          },
          head: {
            line:   e.position.lineNumber,
            column: e.position.column,
          },
        });
        emitAwareness();
      });

      editor.onDidChangeCursorSelection((e) => {
        const awareness = awarenessRef.current;
        if (!awareness) return;
        const sel = e.selection;
        awareness.setLocalStateField("cursor", {
          anchor: {
            line:   sel.selectionStartLineNumber,
            column: sel.selectionStartColumn,
          },
          head: {
            line:   sel.endLineNumber,
            column: sel.endColumn,
          },
        });
        emitAwareness();
      });
    },
    [defaultCode, emitAwareness]
  );

  // ── setLanguage: change language (emits to server + updates local state) ──
  const setLanguage = useCallback(
    (lang: string) => {
      setLanguageState(lang);
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("language:change", { roomId, language: lang });
      }
    },
    [roomId]
  );

  // ── toggleTheme ───────────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  }, []);

  // ── resetCode: clear Y.Text and insert defaultCode ────────────────────────
  const resetCode = useCallback(() => {
    const yText = yTextRef.current;
    const doc   = docRef.current;
    if (!yText || !doc) return;

    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, defaultCode);
    });
  }, [defaultCode]);

  return {
    editorRef,
    language,
    setLanguage,
    theme,
    toggleTheme,
    resetCode,
    isSaving,
    isConnected,
    handleEditorMount,
    // Expose for presence sidebar
    myColor,
  };
};
