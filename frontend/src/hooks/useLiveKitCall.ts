/**
 * useLiveKitCall.ts — Manages a LiveKit room connection for the interview workspace.
 *
 * Features:
 *   - Fetches a scoped participant token from the backend (requires auth).
 *   - Joins the LiveKit room automatically on mount.
 *   - Handles camera / mic toggle.
 *   - Handles reconnect on refresh (re-fetches token then reconnects).
 *   - Cleans up the Room connection on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
  Track,
  type LocalTrackPublication,
  type RemoteTrackPublication,
} from "livekit-client";
import { fetchLiveKitToken } from "../services/livekitService";

export type CallParticipant = {
  identity: string;
  name: string;
  metadata: string;
  isLocal: boolean;
  videoPublication?: LocalTrackPublication | RemoteTrackPublication;
  audioPublication?: LocalTrackPublication | RemoteTrackPublication;
  isMuted: boolean;
  isCameraOff: boolean;
};

export type CallConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

type UseLiveKitCallArgs = {
  roomId: string;
  role: "interviewer" | "candidate" | "observer";
  /** If false the hook is a no-op (e.g. solo sessions). */
  enabled?: boolean;
};

const buildParticipant = (p: LocalParticipant | RemoteParticipant, isLocal: boolean): CallParticipant => {
  const videoPub = isLocal
    ? (p as LocalParticipant).getTrackPublication(Track.Source.Camera)
    : (p as RemoteParticipant).getTrackPublication(Track.Source.Camera);
  const audioPub = isLocal
    ? (p as LocalParticipant).getTrackPublication(Track.Source.Microphone)
    : (p as RemoteParticipant).getTrackPublication(Track.Source.Microphone);

  return {
    identity:         p.identity,
    name:             p.name ?? p.identity,
    metadata:         p.metadata ?? "",
    isLocal,
    videoPublication: videoPub as LocalTrackPublication | RemoteTrackPublication | undefined,
    audioPublication: audioPub as LocalTrackPublication | RemoteTrackPublication | undefined,
    isMuted:          audioPub ? audioPub.isMuted : false,
    isCameraOff:      !videoPub || videoPub.isMuted,
  };
};

export const useLiveKitCall = ({ roomId, role, enabled = true }: UseLiveKitCallArgs) => {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<CallConnectionState>("disconnected");
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refresh participants list ────────────────────────────────────────────────
  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const locals: CallParticipant[] = [buildParticipant(room.localParticipant, true)];
    const remotes: CallParticipant[] = Array.from(room.remoteParticipants.values()).map((p) =>
      buildParticipant(p, false)
    );
    setParticipants([...locals, ...remotes]);
    setIsMuted(room.localParticipant.getTrackPublication(Track.Source.Microphone)?.isMuted ?? false);
    setIsCameraOff(!room.localParticipant.getTrackPublication(Track.Source.Camera) ||
      (room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted ?? true));
  }, []);

  // ── Connect / reconnect ──────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!enabled || !roomId || roomId.startsWith("solo-")) return;

    setConnectionState("connecting");
    setError(null);

    try {
      const { token, wsUrl } = await fetchLiveKitToken(roomId, role);

      // Re-use existing Room instance if already created, otherwise create a new one.
      if (!roomRef.current) {
        roomRef.current = new Room({
          adaptiveStream:      true,
          dynacast:            true,
          reconnectPolicy:     { nextRetryDelayInMs: (ctx) => Math.min(2000 * (ctx.retryCount + 1), 30000) },
        });
      }

      const room = roomRef.current;

      // ── Wire events ──────────────────────────────────────────────────────────
      room.on(RoomEvent.Connected,         () => { setConnectionState("connected");    refreshParticipants(); });
      room.on(RoomEvent.Reconnecting,      () => { setConnectionState("reconnecting"); });
      room.on(RoomEvent.Reconnected,       () => { setConnectionState("connected");    refreshParticipants(); });
      room.on(RoomEvent.Disconnected,      () => { setConnectionState("disconnected"); setParticipants([]); });
      room.on(RoomEvent.ParticipantConnected,    refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.TrackPublished,          refreshParticipants);
      room.on(RoomEvent.TrackUnpublished,        refreshParticipants);
      room.on(RoomEvent.TrackSubscribed,         refreshParticipants);
      room.on(RoomEvent.TrackUnsubscribed,       refreshParticipants);
      room.on(RoomEvent.LocalTrackPublished,     refreshParticipants);
      room.on(RoomEvent.LocalTrackUnpublished,   refreshParticipants);
      room.on(RoomEvent.TrackMuted,              refreshParticipants);
      room.on(RoomEvent.TrackUnmuted,            refreshParticipants);

      await room.connect(wsUrl, token);
      // Enable camera + mic by default (can fail on mobile without user gesture).
      try {
        await room.localParticipant.enableCameraAndMicrophone();
      } catch (mediaErr) {
        console.warn("[LiveKit] Auto-enable media failed, continuing without media:", mediaErr);
      }
      refreshParticipants();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect to call";
      console.error("[LiveKit]", msg);
      setError(msg);
      setConnectionState("error");
    }
  }, [enabled, roomId, role, refreshParticipants]);

  // ── Mount / unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    connect();

    return () => {
      const room = roomRef.current;
      if (room) {
        room.removeAllListeners();
        room.disconnect();
        roomRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role, enabled]);

  // ── Mic toggle ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(isMuted);
    refreshParticipants();
  }, [isMuted, refreshParticipants]);

  // ── Camera toggle ───────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setCameraEnabled(isCameraOff);
    refreshParticipants();
  }, [isCameraOff, refreshParticipants]);

  // ── Leave call ──────────────────────────────────────────────────────────────
  const leaveCall = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    room.removeAllListeners();
    await room.disconnect();
    roomRef.current = null;
    setConnectionState("disconnected");
    setParticipants([]);
  }, []);

  return {
    connectionState,
    participants,
    isMuted,
    isCameraOff,
    error,
    toggleMic,
    toggleCamera,
    leaveCall,
    reconnect: connect,
    roomRef,
  };
};
