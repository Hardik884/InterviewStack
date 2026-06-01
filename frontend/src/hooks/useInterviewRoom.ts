/**
 * useInterviewRoom.ts — Production-grade room presence hook.
 *
 * Key improvements:
 *   - Receives room:snapshot on (re)join → restores code + language
 *   - Handles user_joined / user_left / user_reconnected (new backend events)
 *   - Named typing indicators (name + role instead of just userId)
 *   - connectionStatus: 'online' | 'reconnecting' | 'offline'
 *   - Participant roles included
 *   - Guards against registering duplicate listeners across re-renders
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectSocket, getSocket } from "../sockets/socketClient";
import type { ConnectionStatus } from "./useConnectionStatus";

export type ParticipantRole = "host" | "interviewer" | "candidate" | "observer";

export type Participant = {
  userId: string;
  name: string;
  role: ParticipantRole;
};

export type RoomActivity = {
  message: string;
  timestamp: number;
};

export type TypingUser = {
  userId: string;
  name: string;
  role: ParticipantRole;
};

export type RoomSnapshot = {
  code: string;
  language: string;
  participants: Participant[];
};

export type RemoteUpdate = {
  code?: string;
  language?: string;
  userId?: string;
};

type UseInterviewRoomArgs = {
  token?: string | null;
  roomId: string;
  name: string;
  role?: ParticipantRole;
  onSnapshot?: (snapshot: RoomSnapshot) => void;
};

export const useInterviewRoom = ({
  token,
  roomId,
  name,
  role = "candidate",
  onSnapshot,
}: UseInterviewRoomArgs) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [activity, setActivity] = useState<RoomActivity[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteUpdate | null>(null);

  // Stable ref: avoids duplicate joins across StrictMode double-invokes.
  const hasJoined = useRef(false);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Capture latest onSnapshot in a ref so the effect doesn't re-run when it changes.
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  const pushActivity = (message: string) => {
    setActivity((prev) =>
      [{ message, timestamp: Date.now() }, ...prev].slice(0, 20)
    );
  };

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = connectSocket(token);

    // ── Connection status ──────────────────────────────────────────────────
    const onConnect = () => {
      setConnectionStatus("online");
      // Re-join on reconnect so server state is restored.
      socket.emit("room:join", { roomId, name, role });
      hasJoined.current = true;
    };

    const onDisconnect = (reason: string) => {
      const isIntentional =
        reason === "io server disconnect" || reason === "io client disconnect";
      setConnectionStatus(isIntentional ? "offline" : "reconnecting");
      hasJoined.current = false;
    };

    const onConnectError = () => setConnectionStatus("reconnecting");

    const onReconnect = () => {
      setConnectionStatus("online");
    };

    const onReconnectFailed = () => setConnectionStatus("offline");

    // ── Room events ────────────────────────────────────────────────────────

    /** Sent immediately when we join — restores editor state. */
    const onSnapshot = (payload: RoomSnapshot & { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      setParticipants(payload.participants ?? []);
      onSnapshotRef.current?.(payload);
    };

    const onParticipants = (payload: { roomId: string; participants: Participant[] }) => {
      if (payload.roomId !== roomId) return;
      setParticipants(payload.participants ?? []);
    };

    const onUserJoined = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === payload.userId)) return prev;
        return [...prev, { userId: payload.userId, name: payload.name, role: payload.role }];
      });
      pushActivity(`${payload.name} joined`);
    };

    const onUserLeft = (payload: { userId: string; name: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      // Clear any typing indicator for the departed user.
      setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      pushActivity(`${payload.name} left`);
    };

    const onUserReconnected = (payload: {
      userId: string;
      name: string;
      role: ParticipantRole;
    }) => {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.userId !== payload.userId);
        return [...filtered, { userId: payload.userId, name: payload.name, role: payload.role }];
      });
      pushActivity(`${payload.name} reconnected`);
    };

    const onRoomEnded = () => {
      pushActivity("Room ended by host");
    };

    // ── Code update ────────────────────────────────────────────────────────
    const onCodeUpdate = (payload: RemoteUpdate) => {
      setRemoteUpdate({ ...payload, _ts: Date.now() } as RemoteUpdate & { _ts: number });
    };

    const onLanguageChanged = (payload: { language: string; userId: string }) => {
      setRemoteUpdate((prev) => ({ ...prev, language: payload.language, userId: payload.userId }));
    };

    // ── Typing indicators ──────────────────────────────────────────────────
    const onTypingStarted = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setTypingUsers((prev) =>
        prev.some((u) => u.userId === payload.userId)
          ? prev
          : [...prev, { userId: payload.userId, name: payload.name, role: payload.role }]
      );

      // Auto-expire typing indicator after 3 seconds (safety net).
      const existing = typingTimers.current.get(payload.userId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
        typingTimers.current.delete(payload.userId);
      }, 3000);
      typingTimers.current.set(payload.userId, timer);
    };

    const onTypingStopped = (payload: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      const timer = typingTimers.current.get(payload.userId);
      if (timer) {
        clearTimeout(timer);
        typingTimers.current.delete(payload.userId);
      }
    };

    // ── Register listeners ─────────────────────────────────────────────────
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect", onReconnect);
    socket.on("reconnect_failed", onReconnectFailed);

    socket.on("room:snapshot", onSnapshot);
    socket.on("room:participants", onParticipants);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("user_reconnected", onUserReconnected);
    socket.on("room:ended", onRoomEnded);

    socket.on("code:update", onCodeUpdate);
    socket.on("language_changed", onLanguageChanged);

    socket.on("typing_started", onTypingStarted);
    socket.on("typing_stopped", onTypingStopped);

    // ── Initial join ───────────────────────────────────────────────────────
    if (socket.connected && !hasJoined.current) {
      socket.emit("room:join", { roomId, name, role });
      hasJoined.current = true;
      setConnectionStatus("online");
    }

    return () => {
      socket.emit("room:leave", roomId);
      hasJoined.current = false;

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("reconnect", onReconnect);
      socket.off("reconnect_failed", onReconnectFailed);

      socket.off("room:snapshot", onSnapshot);
      socket.off("room:participants", onParticipants);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("user_reconnected", onUserReconnected);
      socket.off("room:ended", onRoomEnded);

      socket.off("code:update", onCodeUpdate);
      socket.off("language_changed", onLanguageChanged);

      socket.off("typing_started", onTypingStarted);
      socket.off("typing_stopped", onTypingStopped);

      // Clear all typing timers.
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomId, name, role]);

  // ── Outgoing helpers ─────────────────────────────────────────────────────

  const sendCodeUpdate = useCallback(
    (payload: { code: string; language: string }) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("code:sync", { roomId, ...payload });
    },
    [roomId]
  );

  const sendLanguageChange = useCallback(
    (language: string) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("language:change", { roomId, language });
    },
    [roomId]
  );

  const sendCursorPosition = useCallback(
    (line: number, column: number) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      // Use volatile so dropped frames don't queue up.
      socket.volatile.emit("cursor:move", { roomId, line, column });
    },
    [roomId]
  );

  const sendSelectionChange = useCallback(
    (startLine: number, startColumn: number, endLine: number, endColumn: number) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
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

  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;

      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

      if (isTyping) {
        socket.emit("typing:start", { roomId });
        typingDebounceRef.current = setTimeout(() => {
          socket.emit("typing:stop", { roomId });
        }, 2000);
      } else {
        socket.emit("typing:stop", { roomId });
      }
    },
    [roomId]
  );

  const endRoom = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected || !roomId) return;
    socket.emit("room:end", { roomId });
  }, [roomId]);

  return {
    participants,
    typingUsers,
    activity,
    connectionStatus,
    remoteUpdate,
    sendCodeUpdate,
    sendLanguageChange,
    sendCursorPosition,
    sendSelectionChange,
    updateTyping,
    endRoom,
  };
};
