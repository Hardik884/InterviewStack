import { useCallback, useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../sockets/socketClient";

export const useRoomSocket = ({ token, roomId, name }) => {
  const [participants, setParticipants] = useState([]);
  const [code, setCode] = useState("// Start collaborating\n");
  const [language, setLanguage] = useState("javascript");
  const [typingUsers, setTypingUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!token || !roomId) {
      return;
    }

    // Connect once per session and keep handlers scoped to this hook.
    const socket = connectSocket(token);

    socket.emit("room:join", { roomId, name });

    socket.on("room:participants", (payload) => {
      setParticipants(payload.participants || []);
    });

    socket.on("room:user-joined", (payload) => {
      setParticipants((prev) => [...prev, payload]);
      setActivity((prev) =>
        [
          { message: `${payload.name} joined`, timestamp: Date.now() },
          ...prev,
        ].slice(0, 10)
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
        ].slice(0, 10)
      );
    });

    socket.on("code:update", (payload) => {
      if (payload.code !== undefined) {
        setCode(payload.code);
      }

      if (payload.language) {
        setLanguage(payload.language);
      }
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

    return () => {
      socket.emit("room:leave", roomId);
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [token, roomId, name]);

  const sendCode = useCallback(
    (updatedCode) => {
      setCode(updatedCode);
      const socket = getSocket();
      if (!socket || !roomId) {
        return;
      }
      socket.emit("code:sync", { roomId, code: updatedCode, language });
    },
    [roomId, language]
  );

  const changeLanguage = useCallback(
    (nextLanguage) => {
      const socket = getSocket();
      setLanguage(nextLanguage);
      if (socket && roomId) {
        socket.emit("code:sync", { roomId, code, language: nextLanguage });
      }
    },
    [roomId, code]
  );

  const updateTyping = useCallback(
    (isTyping) => {
      const socket = getSocket();
      if (!socket || !roomId) {
        return;
      }

      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }

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

  return {
    participants,
    code,
    language,
    typingUsers,
    activity,
    sendCode,
    updateTyping,
    changeLanguage,
  };
};
