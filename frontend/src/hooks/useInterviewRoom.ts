import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, getSocket } from "../sockets/socketClient";

type Participant = {
  userId: string;
  name: string;
};

type RoomActivity = {
  message: string;
  timestamp: number;
};

type RemoteUpdate = {
  code?: string;
  language?: string;
  userId?: string;
};

type UseInterviewRoomArgs = {
  token?: string | null;
  roomId: string;
  name: string;
};

export const useInterviewRoom = ({ token, roomId, name }: UseInterviewRoomArgs) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activity, setActivity] = useState<RoomActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteUpdate | null>(null);
  const typingTimeout = useRef<number | null>(null);
  // Track whether we have already joined to prevent duplicate join on rapid re-renders.
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = connectSocket(token);

    const handleConnect = () => {
      setConnected(true);
      // Re-join on reconnect so the server state is restored.
      socket.emit("room:join", { roomId, name });
      hasJoined.current = true;
    };

    const handleDisconnect = () => {
      setConnected(false);
      hasJoined.current = false;
    };

    const handleParticipants = (payload: { participants: Participant[] }) => {
      setParticipants(payload.participants || []);
    };

    const handleUserJoined = (payload: { userId: string; name: string }) => {
      // Avoid duplicate entries caused by our own join echo.
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === payload.userId)) return prev;
        return [...prev, { userId: payload.userId, name: payload.name }];
      });
      setActivity((prev) =>
        [{ message: `${payload.name} joined`, timestamp: Date.now() }, ...prev].slice(0, 20)
      );
    };

    const handleUserLeft = (payload: { userId: string; name: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      setActivity((prev) =>
        [{ message: `${payload.name} left`, timestamp: Date.now() }, ...prev].slice(0, 20)
      );
    };

    const handleTypingStart = (payload: { userId: string }) => {
      setTypingUsers((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]));
    };

    const handleTypingStop = (payload: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== payload.userId));
    };

    const handleCodeUpdate = (payload: RemoteUpdate) => {
      setRemoteUpdate(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:participants", handleParticipants);
    socket.on("room:user-joined", handleUserJoined);
    socket.on("room:user-left", handleUserLeft);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("code:update", handleCodeUpdate);

    // If already connected, join immediately.
    if (socket.connected && !hasJoined.current) {
      socket.emit("room:join", { roomId, name });
      hasJoined.current = true;
      setConnected(true);
    }

    return () => {
      // Leave the room but keep the socket alive for the session.
      socket.emit("room:leave", roomId);
      hasJoined.current = false;

      // Remove only our listeners – not all listeners on the socket.
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:participants", handleParticipants);
      socket.off("room:user-joined", handleUserJoined);
      socket.off("room:user-left", handleUserLeft);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("code:update", handleCodeUpdate);

      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current);
      }
    };
  }, [token, roomId, name]);

  const sendCodeUpdate = useCallback(
    (payload: RemoteUpdate) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("code:sync", { roomId, ...payload });
    },
    [roomId]
  );

  const updateTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;

      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current);
      }

      if (isTyping) {
        socket.emit("typing:start", { roomId });
        typingTimeout.current = window.setTimeout(() => {
          socket.emit("typing:stop", { roomId });
        }, 1500);
      } else {
        socket.emit("typing:stop", { roomId });
      }
    },
    [roomId]
  );

  const latestActivity = useMemo(() => activity.slice(0, 10), [activity]);

  return {
    participants,
    typingUsers,
    activity: latestActivity,
    connected,
    remoteUpdate,
    sendCodeUpdate,
    updateTyping,
  };
};
