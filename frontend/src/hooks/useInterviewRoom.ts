/**
 * useInterviewRoom.ts — Room presence hook (Yjs CRDT edition).
 *
 * Responsibilities (post-CRDT):
 *   - Manage participant list (user_joined / user_left / user_reconnected)
 *   - Manage connection status
 *   - Manage activity feed
 *   - Emit room:join / room:leave
 *   - Expose endRoom
 *
 * REMOVED (now handled by useYjsEditor + Yjs):
 *   - remoteUpdate state
 *   - sendCodeUpdate / sendLanguageChange
 *   - sendCursorPosition / sendSelectionChange
 *   - updateTyping
 *   - code:update listener
 *   - language_changed listener
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
  participants: Participant[];
};

type UseInterviewRoomArgs = {
  token?: string | null;
  roomId: string;
  name: string;
  role?: ParticipantRole;
};

export const useInterviewRoom = ({
  token,
  roomId,
  name,
  role = "candidate",
}: UseInterviewRoomArgs) => {
  const [participants, setParticipants]     = useState<Participant[]>([]);
  const [activity, setActivity]             = useState<RoomActivity[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  // `joined` becomes true once the server confirms membership via room:snapshot.
  // Downstream consumers (LiveKit) gate token requests on this so the server
  // has persisted membership before a token is requested (avoids a race).
  const [joined, setJoined] = useState(false);

  const hasJoined = useRef(false);

  const pushActivity = (message: string) =>
    setActivity((prev) => [{ message, timestamp: Date.now() }, ...prev].slice(0, 20));

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = connectSocket(token);

    // ── Connection status ──────────────────────────────────────────────────
    const onConnect = () => {
      setConnectionStatus("online");
      socket.emit("room:join", { roomId, name, role });
      hasJoined.current = true;
    };

    const onDisconnect = (reason: string) => {
      const isIntentional =
        reason === "io server disconnect" || reason === "io client disconnect";
      setConnectionStatus(isIntentional ? "offline" : "reconnecting");
      hasJoined.current = false;
      setJoined(false);
    };

    const onConnectError = () => setConnectionStatus("reconnecting");
    const onReconnect    = () => setConnectionStatus("online");
    const onReconnectFailed = () => setConnectionStatus("offline");

    // ── Room snapshot (participants only — no code, no language) ───────────
    const onSnapshot = (payload: RoomSnapshot & { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      setParticipants(payload.participants ?? []);
      setJoined(true);
      // NOTE: Yjs state is restored separately via yjs:sync-step1/step2
      // initiated by useYjsEditor after receiving this event.
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
      pushActivity(`${payload.name} left`);
    };

    const onUserReconnected = (payload: { userId: string; name: string; role: ParticipantRole }) => {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.userId !== payload.userId);
        return [...filtered, { userId: payload.userId, name: payload.name, role: payload.role }];
      });
      pushActivity(`${payload.name} reconnected`);
    };

    const onRoomEnded = () => {
      pushActivity("Room ended by host");
    };

    // ── Register listeners ─────────────────────────────────────────────────
    socket.on("connect",          onConnect);
    socket.on("disconnect",       onDisconnect);
    socket.on("connect_error",    onConnectError);
    socket.on("reconnect",        onReconnect);
    socket.on("reconnect_failed", onReconnectFailed);

    socket.on("room:snapshot",    onSnapshot);
    socket.on("room:participants", onParticipants);
    socket.on("user_joined",      onUserJoined);
    socket.on("user_left",        onUserLeft);
    socket.on("user_reconnected", onUserReconnected);
    socket.on("room:ended",       onRoomEnded);

    // ── Initial join ───────────────────────────────────────────────────────
    if (socket.connected && !hasJoined.current) {
      socket.emit("room:join", { roomId, name, role });
      hasJoined.current = true;
      setConnectionStatus("online");
    }

    return () => {
      socket.emit("room:leave", roomId);
      hasJoined.current = false;
      setJoined(false);

      socket.off("connect",          onConnect);
      socket.off("disconnect",       onDisconnect);
      socket.off("connect_error",    onConnectError);
      socket.off("reconnect",        onReconnect);
      socket.off("reconnect_failed", onReconnectFailed);

      socket.off("room:snapshot",    onSnapshot);
      socket.off("room:participants", onParticipants);
      socket.off("user_joined",      onUserJoined);
      socket.off("user_left",        onUserLeft);
      socket.off("user_reconnected", onUserReconnected);
      socket.off("room:ended",       onRoomEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomId, name, role]);

  // ── endRoom ───────────────────────────────────────────────────────────────
  const endRoom = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected || !roomId) return;
    socket.emit("room:end", { roomId });
  }, [roomId]);

  return {
    participants,
    activity,
    connectionStatus,
    joined,
    endRoom,
  };
};
