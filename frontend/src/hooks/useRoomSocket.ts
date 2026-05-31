import { useCallback, useEffect, useRef, useState } from "react";
import { connectSocket, getSocket } from "../sockets/socketClient";

type Participant = { userId: string; name: string };
type Activity = { message: string; timestamp: number };

export const useRoomSocket = ({
  token,
  roomId,
  name,
}: {
  token?: string | null;
  roomId: string;
  name: string;
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [code, setCode] = useState("// Start collaborating\n");
  const [language, setLanguage] = useState("javascript");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!token || !roomId) return;

    const socket = connectSocket(token);

    const handleConnect = () => {
      if (!hasJoined.current) {
        socket.emit("room:join", { roomId, name });
        hasJoined.current = true;
      }
    };

    const handleParticipants = (payload: { participants: Participant[] }) =>
      setParticipants(payload.participants || []);

    const handleUserJoined = (payload: { userId: string; name: string }) => {
      setParticipants((prev) =>
        prev.some((p) => p.userId === payload.userId)
          ? prev
          : [...prev, { userId: payload.userId, name: payload.name }]
      );
      setActivity((prev) =>
        [{ message: `${payload.name} joined`, timestamp: Date.now() }, ...prev].slice(0, 10)
      );
    };

    const handleUserLeft = (payload: { userId: string; name: string }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== payload.userId));
      setActivity((prev) =>
        [{ message: `${payload.name} left`, timestamp: Date.now() }, ...prev].slice(0, 10)
      );
    };

    const handleCodeUpdate = (payload: { code?: string; language?: string }) => {
      if (payload.code !== undefined) setCode(payload.code);
      if (payload.language) setLanguage(payload.language);
    };

    const handleTypingStart = (payload: { userId: string }) => {
      setTypingUsers((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId]
      );
    };

    const handleTypingStop = (payload: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== payload.userId));
    };

    socket.on("connect", handleConnect);
    socket.on("room:participants", handleParticipants);
    socket.on("room:user-joined", handleUserJoined);
    socket.on("room:user-left", handleUserLeft);
    socket.on("code:update", handleCodeUpdate);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    if (socket.connected && !hasJoined.current) {
      socket.emit("room:join", { roomId, name });
      hasJoined.current = true;
    }

    return () => {
      socket.emit("room:leave", roomId);
      hasJoined.current = false;

      socket.off("connect", handleConnect);
      socket.off("room:participants", handleParticipants);
      socket.off("room:user-joined", handleUserJoined);
      socket.off("room:user-left", handleUserLeft);
      socket.off("code:update", handleCodeUpdate);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);

      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [token, roomId, name]);

  const sendCode = useCallback(
    (updatedCode: string) => {
      setCode(updatedCode);
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;
      socket.emit("code:sync", { roomId, code: updatedCode, language });
    },
    [roomId, language]
  );

  const changeLanguage = useCallback(
    (nextLanguage: string) => {
      setLanguage(nextLanguage);
      const socket = getSocket();
      if (socket?.connected && roomId) {
        socket.emit("code:sync", { roomId, code, language: nextLanguage });
      }
    },
    [roomId, code]
  );

  const updateTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (!socket?.connected || !roomId) return;

      if (typingTimeout.current) clearTimeout(typingTimeout.current);

      if (isTyping) {
        socket.emit("typing:start", { roomId });
        typingTimeout.current = setTimeout(() => {
          socket.emit("typing:stop", { roomId });
        }, 1200);
      } else {
        socket.emit("typing:stop", { roomId });
      }
    },
    [roomId]
  );

  return { participants, code, language, typingUsers, activity, sendCode, updateTyping, changeLanguage };
};
