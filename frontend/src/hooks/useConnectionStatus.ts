/**
 * useConnectionStatus.ts
 *
 * Tracks the real-time connection health of the Socket.IO socket.
 * Exposes:
 *   status         — 'online' | 'reconnecting' | 'offline'
 *   reconnectAttempt — current attempt count (0 when online)
 *   latency        — last measured round-trip in ms (or null)
 */

import { useEffect, useRef, useState } from "react";
import { getSocket } from "../sockets/socketClient";
import type { Socket } from "socket.io-client";

export type ConnectionStatus = "online" | "reconnecting" | "offline";

type UseConnectionStatusArgs = {
  /** Pass the socket directly or leave undefined to use the singleton. */
  socket?: Socket | null;
};

export const useConnectionStatus = (args?: UseConnectionStatusArgs) => {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    const s = args?.socket ?? getSocket();
    return s?.connected ? "online" : "offline";
  });
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = args?.socket ?? getSocket();
    if (!s) return;

    const onConnect = () => {
      setStatus("online");
      setReconnectAttempt(0);
    };

    const onDisconnect = (reason: string) => {
      // Transport close usually means intentional leave; others mean reconnect.
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        setStatus("offline");
      } else {
        setStatus("reconnecting");
      }
    };

    const onConnectError = () => {
      setStatus("reconnecting");
    };

    const onReconnectAttempt = (attempt: number) => {
      setStatus("reconnecting");
      setReconnectAttempt(attempt);
    };

    const onReconnect = () => {
      setStatus("online");
      setReconnectAttempt(0);
    };

    const onReconnectFailed = () => {
      setStatus("offline");
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("reconnect_attempt", onReconnectAttempt);
    s.on("reconnect", onReconnect);
    s.on("reconnect_failed", onReconnectFailed);

    // Latency ping every 10 seconds while connected.
    pingRef.current = setInterval(() => {
      if (!s.connected) return;
      const start = Date.now();
      s.volatile.emit("ping");
      s.once("pong", () => setLatency(Date.now() - start));
    }, 10_000);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.off("reconnect_attempt", onReconnectAttempt);
      s.off("reconnect", onReconnect);
      s.off("reconnect_failed", onReconnectFailed);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [args?.socket]);

  return { status, reconnectAttempt, latency };
};
