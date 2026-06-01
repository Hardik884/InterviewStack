/**
 * useRoomSocket.ts — Aligned with production event architecture.
 *
 * Changes:
 *   - Listens to new server events: user_joined, user_left, user_reconnected,
 *     typing_started, typing_stopped, language_changed, room:snapshot
 *   - Backward-compatible aliases for old events kept during transition
 *   - connectionStatus exposed
 *   - Named typing users (TypingUser[]) instead of plain string[]
 *   - sendLanguageChange as distinct emit
 *   - Proper cleanup with named handler references (no memory leaks)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectSocket, getSocket } from "../sockets/socketClient";
import type { ParticipantRole, TypingUser } from "./useInterviewRoom";
import type { ConnectionStatus } from "./useConnectionStatus";

type Participant = { userId: string; name: string; role: ParticipantRole };
type Activity = { message: string; timestamp: number };

export const useRoomSocket = ({
  token,
  roomId,
  name,
  role = "candidate",
}: {
  token?: string | null;
  roomId: string;
  name: string;
  role?: ParticipantRole;
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [code, setCode] = useState("// Start collaborating\n");
  const [language, setLanguage] = useState("javascript");
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");

  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasJoined = useRef(false);

  const pushActivity = (message: string) =>
    setActivity((prev) => [{ message, timestamp: Date.now() }, ...prev].slice(0, 20));

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = connectSocket(token);

    const onConnect = () => {
      setConnectionStatus("online");
      socket.emit("room:join", { roomId, name, role });
      hasJoined.current = true;
    };

    const onDisconnect = (reason: string) => {
      const intentional = reason === "io server disconnect" || reason === "io client disconnect";
      setConnectionStatus(intentional ? "offline" : "reconnecting");
      hasJoined.current = false;
    };

    const onConnectError = () => setConnectionStatus("reconnecting");
    const onReconnect = () => setConnectionStatus("online");
    const onReconnectFailed = () => setConnectionStatus("offline");

    const onSnapshot = (payload: {
      roomId: string;
      code: string;
      language: string;
      participants: Participant[];
    }) => {
      if (payload.roomId !== roomId) return;
      if (payload.code) setCode(payload.code);
      if (payload.language) setLanguage(payload.language);
      if (payload.participants) setParticipants(payload.participants);
    };

    const onParticipants = (payload: { roomId: string; participants: Participant[] }) => {
      if (payload.roomId !== roomId) return;
      setParticipants(payload.participants ?? []);
    };

    const onUserJoined = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setParticipants((prev) =>
        prev.some((p) => p.userId === payload.userId)
          ? prev
          : [...prev, { userId: payload.userId, name: payload.name, role: payload.role }]
      );
      pushActivity(`${payload.name} joined`);
    };

    const onUserLeft = (payload: { userId: string; name: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
      pushActivity(`${payload.name} left`);
    };

    const onUserReconnected = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.userId !== payload.userId);
        return [...filtered, { userId: payload.userId, name: payload.name, role: payload.role }];
      });
      pushActivity(`${payload.name} reconnected`);
    };

    const onCodeUpdate = (payload: { code?: string; language?: string }) => {
      if (payload.code !== undefined) setCode(payload.code);
      if (payload.language) setLanguage(payload.language);
    };

    const onLanguageChanged = (payload: { language: string }) => {
      if (payload.language) setLanguage(payload.language);
    };

    const onTypingStarted = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setTypingUsers((prev) =>
        prev.some((u) => u.userId === payload.userId)
          ? prev
          : [...prev, { userId: payload.userId, name: payload.name, role: payload.role }]
      );
      // Auto-expire after 3s
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
    socket.on("code:update", onCodeUpdate);
    socket.on("language_changed", onLanguageChanged);
    socket.on("typing_started", onTypingStarted);
    socket.on("typing_stopped", onTypingStopped);

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
      socket.off("code:update", onCodeUpdate);
      socket.off("language_changed", onLanguageChanged);
      socket.off("typing_started", onTypingStarted);
      socket.off("typing_stopped", onTypingStopped);

      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
    };
  }, [token, roomId, name, role]);

  const codeRef = useRef(code);
  useEffect(() => { codeRef.current = code; }, [code]);

  const sendCode = useCallback(
    (updatedCode: string) => {
      setCode(updatedCode);
      codeRef.current = updatedCode;
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("code:sync", { roomId, code: updatedCode, language });
    },
    [roomId, language]
  );

  const sendLanguageChange = useCallback(
    (nextLanguage: string) => {
      setLanguage(nextLanguage);
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("language:change", { roomId, language: nextLanguage });
    },
    [roomId]
  );

  // Keep backward-compat alias
  const changeLanguage = sendLanguageChange;

  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      if (typingDebounce.current) clearTimeout(typingDebounce.current);
      if (isTyping) {
        socket.emit("typing:start", { roomId });
        typingDebounce.current = setTimeout(() => {
          socket.emit("typing:stop", { roomId });
        }, 2000);
      } else {
        socket.emit("typing:stop", { roomId });
      }
    },
    [roomId]
  );

  return {
    participants,
    code,
    language,
    typingUsers,
    activity,
    connectionStatus,
    sendCode,
    updateTyping,
    changeLanguage,
    sendLanguageChange,
  };
};
