import { useEffect, useMemo, useRef, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../sockets/socketClient";

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

  useEffect(() => {
    if (!token || !roomId) {
      return;
    }

    const socket = connectSocket(token);

    const joinRoom = () => {
      socket.emit("room:join", { roomId, name });
      setConnected(true);
    };

    socket.on("connect", joinRoom);
    socket.on("disconnect", () => setConnected(false));

    socket.on("room:participants", (payload) => {
      setParticipants(payload.participants || []);
    });

    socket.on("room:user-joined", (payload) => {
      setParticipants((prev) => [...prev, payload]);
      setActivity((prev) =>
        [
          { message: `${payload.name} joined`, timestamp: Date.now() },
          ...prev,
        ].slice(0, 20)
      );
    });

    socket.on("room:user-left", (payload) => {
      setParticipants((prev) =>
        prev.filter((participant) => participant.userId !== payload.userId)
      );
      setActivity((prev) =>
        [
          { message: `${payload.name} left`, timestamp: Date.now() },
          ...prev,
        ].slice(0, 20)
      );
    });

    socket.on("typing:start", (payload) => {
      setTypingUsers((prev) => {
        if (prev.includes(payload.userId)) {
          return prev;
        }

        return [...prev, payload.userId];
      });
    });

    socket.on("typing:stop", (payload) => {
      setTypingUsers((prev) => prev.filter((id) => id !== payload.userId));
    });

    socket.on("code:update", (payload) => {
      setRemoteUpdate(payload);
    });

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.emit("room:leave", roomId);
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [token, roomId, name]);

  const sendCodeUpdate = (payload: RemoteUpdate) => {
    const socket = getSocket();
    if (!socket || !roomId) {
      return;
    }

    socket.emit("code:sync", { roomId, ...payload });
  };

  const updateTyping = (isTyping: boolean) => {
    const socket = getSocket();
    if (!socket || !roomId) {
      return;
    }

    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
    }

    if (isTyping) {
      socket.emit("typing:start", { roomId });
      typingTimeout.current = window.setTimeout(() => {
        socket.emit("typing:stop", { roomId });
      }, 1200);
    } else {
      socket.emit("typing:stop", { roomId });
    }
  };

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
