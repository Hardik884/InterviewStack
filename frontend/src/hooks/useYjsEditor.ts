/**
 * useYjsEditor.ts — Production Yjs CRDT collaborative editor hook.
 *
 * Architecture:
 *   Y.Doc (per room) → Y.Text("code") ↔ MonacoBinding ↔ Monaco Editor
 *   Awareness (y-monaco `selection`, Yjs RELATIVE positions) → remote cursors
 *
 * ── Why the previous implementation lost edits ───────────────────────────────
 * Starter code was injected with `doc.transact(..., "server")`, and the doc
 * update observer skips forwarding anything whose origin is "server". So the
 * starter text was applied LOCALLY ONLY on every client and never reached the
 * server or the peer. Each client therefore built its own private starter
 * items under its own clientID, and every subsequent real edit was anchored to
 * those local-only items. Peers received updates whose dependencies they did
 * not have, so the edits never materialised — the interviewer simply never saw
 * the candidate's code, and vice versa.
 *
 * The seed is now applied with a LOCAL origin (so it is broadcast like any
 * other edit) and guarded by an `initialized` flag in the shared `meta` map so
 * late joiners never re-seed.
 *
 * ── Why remote cursors were wrong ────────────────────────────────────────────
 * Cursors were broadcast as raw Monaco `{line, column}` coordinates. Those are
 * absolute screen coordinates in the *sender's* document; any insert or delete
 * before the cursor (local or remote) invalidates them immediately. Cursors now
 * ride on Yjs RELATIVE positions (`state.selection`, written by MonacoBinding),
 * which are anchored to CRDT items and stay logically correct across edits.
 *
 * ── Sync protocol ────────────────────────────────────────────────────────────
 * sync-step1/step2 was one-directional: the client learned what it was missing,
 * but the server never learned what the CLIENT had that IT was missing, so any
 * edit made while disconnected was lost forever. The server now includes its
 * own state vector in sync-step2 and the client replies with the diff.
 *
 * Socket events consumed:
 *   yjs:sync-step2   — server state + server state-vector
 *   yjs:update       — incoming CRDT delta from peers
 *   yjs:awareness    — remote cursor / presence updates
 *   language:changed — language sync from server
 *
 * Socket events emitted:
 *   yjs:sync-step1   — local state vector on (re)connect
 *   yjs:update       — outgoing CRDT delta (incl. the reply diff)
 *   yjs:awareness    — outgoing cursor / presence update
 *   language:change  — language change request
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
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

/** Origin tag for updates that arrived from the network — never re-broadcast. */
const REMOTE_ORIGIN = "server";

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

/** Sanitise a userId so it is safe to embed in a CSS class name. */
const cssId = (userId: string) => userId.replace(/[^a-zA-Z0-9_-]/g, "");

const ensureCursorStyles = (
  userId: string,
  name: string,
  role: ParticipantRole,
  color: string
) => {
  const id = cssId(userId);
  const styleId = `yjs-cursor-style-${id}`;
  if (document.getElementById(styleId)) return;

  const label = name || (role === "interviewer" || role === "host" ? "Interviewer" : "Candidate");
  const el = document.createElement("style");
  el.id = styleId;
  el.textContent = `
    .yjs-cursor-${id} {
      border-left: 2px solid ${color} !important;
      position: relative;
    }
    .yjs-cursor-flag-${id}::before {
      content: "${label.replace(/["\\]/g, "")}";
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
    .yjs-selection-${id} {
      background: ${hexToRgba(color, 0.2)} !important;
    }
  `;
  document.head.appendChild(el);
};

const removeCursorStyles = (userId: string) => {
  document.getElementById(`yjs-cursor-style-${cssId(userId)}`)?.remove();
};

/**
 * Resolve a Yjs relative position (as received over the awareness wire, i.e.
 * plain JSON) to an absolute index in the local document.
 * Returns null when the position can no longer be resolved.
 */
const resolveRelative = (raw: unknown, doc: Y.Doc): number | null => {
  if (!raw) return null;
  try {
    const rel =
      raw instanceof Object && "type" in (raw as object)
        ? Y.createRelativePositionFromJSON(raw as Record<string, unknown>)
        : (raw as Y.RelativePosition);
    const abs = Y.createAbsolutePositionFromRelativePosition(rel, doc);
    return abs ? abs.index : null;
  } catch {
    return null;
  }
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
  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // Stable decoration collection per remote userId
  const decorationCollectionsRef = useRef<
    Map<string, Monaco.editor.IEditorDecorationsCollection>
  >(new Map());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [language, setLanguageState] = useState<string>("javascript");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteProblemId, setRemoteProblemId] = useState<string | null>(null);

  const syncReceivedRef = useRef(false);
  const syncRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncAttemptsRef = useRef(0);

  // ── Latest identity, without forcing the Y.Doc to be rebuilt ──────────────
  // The Y.Doc must NOT be torn down just because the display name arrived a
  // moment after mount; that would discard the synced document.
  const identityRef = useRef({ userId, userName, userRole, myColor });
  const defaultCodeRef = useRef(defaultCode);
  const roomIdRef = useRef(roomId);

  // Keep the "latest value" refs current. Declared before every effect that
  // reads them so it runs first on each commit (effects fire in declaration
  // order), and written here rather than during render.
  useEffect(() => {
    identityRef.current = { userId, userName, userRole, myColor };
    defaultCodeRef.current = defaultCode;
    roomIdRef.current = roomId;
  });

  // ── Saving indicator ──────────────────────────────────────────────────────
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markSaving = useCallback(() => {
    setIsSaving(true);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => setIsSaving(false), 800);
  }, []);

  // ── Remote cursor decorations, driven by RELATIVE positions ───────────────
  const applyAwarenessDecorations = useCallback(() => {
    const editor = editorRef.current;
    const awareness = awarenessRef.current;
    const doc = docRef.current;
    if (!editor || !awareness || !doc) return;

    const model = editor.getModel();
    if (!model) return;

    const MonacoRange = (window as unknown as { monaco?: typeof Monaco }).monaco?.Range;
    if (!MonacoRange) return; // Monaco not fully loaded yet

    const seenUserIds = new Set<string>();
    const selfClientId = awareness.clientID;

    for (const [clientId, state] of awareness.getStates().entries()) {
      if (clientId === selfClientId) continue;

      const user = (state as { user?: AwarenessUser }).user;
      const selection = (state as { selection?: { anchor: unknown; head: unknown } }).selection;
      if (!user || user.id === identityRef.current.userId) continue;
      if (!selection) continue;

      // Relative → absolute, evaluated against OUR copy of the document, so the
      // cursor lands on the same logical character regardless of local edits.
      const headIdx = resolveRelative(selection.head, doc);
      if (headIdx === null) continue;
      const anchorIdx = resolveRelative(selection.anchor, doc) ?? headIdx;

      seenUserIds.add(user.id);
      const color = colorForUser(user.id);
      const id = cssId(user.id);
      const maxOffset = model.getValueLength();

      const headPos = model.getPositionAt(Math.max(0, Math.min(headIdx, maxOffset)));

      const newDecs: Monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new MonacoRange(
            headPos.lineNumber,
            headPos.column,
            headPos.lineNumber,
            headPos.column
          ),
          options: {
            className: `yjs-cursor-${id}`,
            beforeContentClassName: `yjs-cursor-flag-${id}`,
            stickiness: 1, // NeverGrowsWhenTypingAtEdges
            zIndex: 100,
          },
        },
      ];

      if (anchorIdx !== headIdx) {
        const startIdx = Math.min(anchorIdx, headIdx);
        const endIdx = Math.max(anchorIdx, headIdx);
        const startPos = model.getPositionAt(Math.max(0, Math.min(startIdx, maxOffset)));
        const endPos = model.getPositionAt(Math.max(0, Math.min(endIdx, maxOffset)));
        newDecs.push({
          range: new MonacoRange(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          options: { className: `yjs-selection-${id}`, stickiness: 1 },
        });
      }

      ensureCursorStyles(user.id, user.name, user.role, color);

      let collection = decorationCollectionsRef.current.get(user.id);
      if (!collection) {
        collection = editor.createDecorationsCollection([]);
        decorationCollectionsRef.current.set(user.id, collection);
      }
      collection.set(newDecs);
    }

    // Drop decorations for users no longer present — no ghost cursors.
    for (const [trackedId, collection] of decorationCollectionsRef.current.entries()) {
      if (!seenUserIds.has(trackedId)) {
        try {
          collection.clear();
        } catch {
          /* editor already disposed */
        }
        decorationCollectionsRef.current.delete(trackedId);
        removeCursorStyles(trackedId);
      }
    }
  }, []);

  // ── Broadcast local awareness (throttled) ─────────────────────────────────
  const lastAwarenessEmit = useRef(0);
  const awarenessTrailingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AWARENESS_THROTTLE_MS = 80;

  const emitAwareness = useCallback(() => {
    const send = () => {
      const awareness = awarenessRef.current;
      const socket = getSocket();
      if (!awareness || !socket?.connected) return;
      lastAwarenessEmit.current = Date.now();
      const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
      socket.volatile.emit("yjs:awareness", {
        roomId: roomIdRef.current,
        update: Array.from(update as Uint8Array),
      });
    };

    const elapsed = Date.now() - lastAwarenessEmit.current;
    if (elapsed >= AWARENESS_THROTTLE_MS) {
      send();
      return;
    }
    // Trailing edge — guarantees the final cursor resting position is sent.
    if (awarenessTrailingTimer.current) return;
    awarenessTrailingTimer.current = setTimeout(() => {
      awarenessTrailingTimer.current = null;
      send();
    }, AWARENESS_THROTTLE_MS - elapsed);
  }, []);

  // ── Socket listeners + sync handshake ─────────────────────────────────────
  // Returned as a factory and invoked by the Y.Doc effect above so the wiring
  // and the document it serves share one lifetime.
  const wireSocket = useCallback(() => {
    let cleanupFn: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attachListeners = (): boolean => {
      const socket = getSocket();
      if (!socket) return false;

      const onSyncStep2 = ({
        roomId: rid,
        update,
        stateVector: serverSv,
        language: lang,
        problemId: pid,
      }: {
        roomId: string;
        update: number[];
        stateVector?: number[];
        language?: string;
        problemId?: string | null;
      }) => {
        if (rid !== roomId) return;
        const doc = docRef.current;
        const yText = yTextRef.current;
        if (!doc || !yText) return;

        try {
          Y.applyUpdate(doc, new Uint8Array(update), REMOTE_ORIGIN);
          if (lang) setLanguageState(lang);
          if (pid) setRemoteProblemId(pid);

          syncReceivedRef.current = true;
          if (syncRetryTimerRef.current) {
            clearTimeout(syncRetryTimerRef.current);
            syncRetryTimerRef.current = null;
          }
          setIsConnected(true);

          // ── Push back whatever the SERVER is missing ──────────────────────
          // Without this, edits made while offline (or before the handshake
          // completed) never reach anyone else.
          if (serverSv && serverSv.length) {
            const diff = Y.encodeStateAsUpdate(doc, new Uint8Array(serverSv));
            // A doc with nothing new still yields a small no-op update; only
            // send when there is real content to contribute.
            if (diff.length > 2) {
              socket.emit("yjs:update", { roomId, update: Array.from(diff) });
            }
          }

          // ── Seed starter code, ONCE, as a normal local edit ────────────────
          // Local origin => it is broadcast to the server and peers. The meta
          // flag lives in the shared doc, so late joiners never re-seed.
          const meta = doc.getMap("meta");
          if (yText.length === 0 && !meta.get("initialized")) {
            doc.transact(() => {
              yText.insert(0, defaultCodeRef.current);
              meta.set("initialized", true);
            }, "local-seed");
          }

          applyAwarenessDecorations();
        } catch (err) {
          console.error("[Yjs] Failed to apply sync-step2:", err);
        }
      };

      const onYjsUpdate = ({ roomId: rid, update }: { roomId: string; update: number[] }) => {
        if (rid !== roomId) return;
        const doc = docRef.current;
        if (!doc) return;
        try {
          Y.applyUpdate(doc, new Uint8Array(update), REMOTE_ORIGIN);
          applyAwarenessDecorations();
        } catch (err) {
          console.error("[Yjs] Failed to apply peer update:", err);
        }
      };

      const onYjsAwareness = ({ roomId: rid, update }: { roomId: string; update: number[] }) => {
        if (rid !== roomId) return;
        const awareness = awarenessRef.current;
        if (!awareness) return;
        try {
          applyAwarenessUpdate(awareness, new Uint8Array(update), REMOTE_ORIGIN);
        } catch (err) {
          console.error("[Yjs] Failed to apply awareness:", err);
        }
      };

      const onLanguageChanged = ({ roomId: rid, language: lang }: { roomId: string; language: string }) => {
        if (rid !== roomId) return;
        setLanguageState(lang);
      };

      const onProblemSet = ({ roomId: rid, problemId: pid }: { roomId: string; problemId: string }) => {
        if (rid !== roomId) return;
        setRemoteProblemId(pid);
      };

      // Prune a departed peer's awareness so no ghost cursor lingers.
      const onUserLeft = ({ userId: leftId }: { userId?: string }) => {
        const awareness = awarenessRef.current;
        if (!awareness || !leftId) return;
        const toRemove: number[] = [];
        awareness.getStates().forEach((state, clientId) => {
          const u = (state as { user?: AwarenessUser }).user;
          if (u && u.id === leftId) toRemove.push(clientId);
        });
        if (toRemove.length) {
          removeAwarenessStates(awareness, toRemove, "peer-left");
          applyAwarenessDecorations();
        }
      };

      const requestSync = () => {
        const doc = docRef.current;
        if (!doc || !socket.connected) return;
        const sv = Y.encodeStateVector(doc);
        socket.emit("yjs:sync-step1", { roomId, stateVector: Array.from(sv) });
        setIsConnected(true);

        if (syncRetryTimerRef.current) clearTimeout(syncRetryTimerRef.current);
        if (!syncReceivedRef.current && syncAttemptsRef.current < 8) {
          syncAttemptsRef.current += 1;
          syncRetryTimerRef.current = setTimeout(requestSync, 700);
        }
      };

      const beginSync = () => {
        syncReceivedRef.current = false;
        syncAttemptsRef.current = 0;
        requestSync();
        // Re-announce our cursor so peers that just (re)connected see it.
        emitAwareness();
      };

      socket.on("yjs:sync-step2", onSyncStep2);
      socket.on("yjs:update", onYjsUpdate);
      socket.on("yjs:awareness", onYjsAwareness);
      socket.on("language:changed", onLanguageChanged);
      socket.on("problem:set", onProblemSet);
      socket.on("user_left", onUserLeft);
      // room:snapshot is emitted only AFTER the server registers this socket as
      // a room member, so sync-step1 will pass the authorisation gate.
      socket.on("room:snapshot", beginSync);
      socket.on("connect", beginSync);
      // In socket.io v4 "reconnect" fires on the MANAGER, not the socket.
      socket.io.on("reconnect", beginSync);

      if (socket.connected) beginSync();

      cleanupFn = () => {
        if (syncRetryTimerRef.current) {
          clearTimeout(syncRetryTimerRef.current);
          syncRetryTimerRef.current = null;
        }
        socket.off("yjs:sync-step2", onSyncStep2);
        socket.off("yjs:update", onYjsUpdate);
        socket.off("yjs:awareness", onYjsAwareness);
        socket.off("language:changed", onLanguageChanged);
        socket.off("problem:set", onProblemSet);
        socket.off("user_left", onUserLeft);
        socket.off("room:snapshot", beginSync);
        socket.off("connect", beginSync);
        socket.io.off("reconnect", beginSync);
      };

      return true;
    };

    if (!attachListeners()) {
      retryTimer = setTimeout(() => attachListeners(), 100);
    }

    return {
      teardown: () => {
        if (retryTimer) clearTimeout(retryTimer);
        if (awarenessTrailingTimer.current) {
          clearTimeout(awarenessTrailingTimer.current);
          awarenessTrailingTimer.current = null;
        }
        cleanupFn?.();
      },
    };
  }, [roomId, applyAwarenessDecorations, emitAwareness]);

  // ── Initialise Y.Doc + awareness ──────────────────────────────────────────
  // Depends ONLY on roomId/userId. Name, role and colour are read through
  // identityRef so a late-arriving profile never destroys the live document.
  useEffect(() => {
    if (!roomId || !userId) return;

    syncReceivedRef.current = false;

    const doc = new Y.Doc();
    const yText = doc.getText("code");
    const awareness = new Awareness(doc);

    docRef.current = doc;
    yTextRef.current = yText;
    awarenessRef.current = awareness;

    const { userName: n, userRole: r, myColor: c } = identityRef.current;
    awareness.setLocalStateField("user", { id: userId, name: n, role: r, color: c });

    // Awareness changes → redraw cursors, and broadcast only when OUR state
    // changed locally. Re-emitting on remote-origin changes caused an endless
    // awareness echo between peers.
    const onAwarenessUpdate = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      applyAwarenessDecorations();
      if (origin === REMOTE_ORIGIN) return;
      const mine = awareness.clientID;
      if (![...added, ...updated, ...removed].includes(mine)) return;
      emitAwareness();
    };
    awareness.on("update", onAwarenessUpdate);

    // Local Y.Doc updates → forward to server.
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return;
      markSaving();
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("yjs:update", {
          roomId: roomIdRef.current,
          update: Array.from(update),
        });
      }
      // If the socket is down the edit stays in the local doc and is pushed
      // during the next sync handshake (see the reply-diff in onSyncStep2).
    };
    doc.on("update", onDocUpdate);

    // Rebind Monaco if the editor is already mounted (room switch, or Monaco
    // mounted before auth resolved).
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        if (bindingRef.current) {
          try {
            bindingRef.current.destroy();
          } catch {
            /* already disposed */
          }
        }
        bindingRef.current = new MonacoBinding(
          yText,
          model,
          new Set([editorRef.current]),
          awareness
        );
      }
    }

    // Captured for the cleanup closure (the Map instance is stable for the
    // lifetime of the component; only its contents change).
    const decorations = decorationCollectionsRef.current;

    // ── Socket listeners + sync handshake ───────────────────────────────────
    // Wired here, in the same effect that owns the doc, so the listeners always
    // close over THIS doc and a doc created after mount (the common case — auth
    // resolves after the first render) is always synced.
    const { teardown } = wireSocket();

    return () => {
      teardown();
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch {
          /* already disposed */
        }
        bindingRef.current = null;
      }

      doc.off("update", onDocUpdate);
      awareness.off("update", onAwarenessUpdate);

      awareness.destroy();
      doc.destroy();

      for (const collection of decorations.values()) {
        try {
          collection.clear();
        } catch {
          /* editor already disposed */
        }
      }
      decorations.clear();

      docRef.current = null;
      yTextRef.current = null;
      awarenessRef.current = null;
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, [roomId, userId, applyAwarenessDecorations, emitAwareness, markSaving, wireSocket]);

  // ── Keep the awareness user field fresh without rebuilding the doc ────────
  useEffect(() => {
    const awareness = awarenessRef.current;
    if (!awareness || !userId) return;
    awareness.setLocalStateField("user", {
      id: userId,
      name: userName,
      role: userRole,
      color: myColor,
    });
  }, [userId, userName, userRole, myColor, roomId]);


  // ── Monaco onMount ────────────────────────────────────────────────────────
  // Never seed defaultCode here — seeding happens only after sync-step2 proves
  // the room is genuinely empty.
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      const yText = yTextRef.current;
      const awareness = awarenessRef.current;
      const model = editor.getModel();
      // If the doc is not ready yet the Y.Doc effect will bind on creation.
      if (!yText || !awareness || !model) return;

      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch {
          /* already disposed */
        }
        bindingRef.current = null;
      }

      // MonacoBinding keeps Monaco ↔ Y.Text in sync AND publishes the local
      // selection to awareness as Yjs RELATIVE positions.
      bindingRef.current = new MonacoBinding(yText, model, new Set([editor]), awareness);

      applyAwarenessDecorations();
    },
    [applyAwarenessDecorations]
  );

  // ── setLanguage ───────────────────────────────────────────────────────────
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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  }, []);

  // ── resetCode ─────────────────────────────────────────────────────────────
  const resetCode = useCallback(() => {
    const yText = yTextRef.current;
    const doc = docRef.current;
    if (!yText || !doc) return;

    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, defaultCodeRef.current);
    }, "local-reset");
  }, []);

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
    remoteProblemId,
    myColor,
  };
};
