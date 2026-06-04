/**
 * VideoTile.tsx — Renders a single participant's video/audio.
 *
 * Attaches the LiveKit track to a <video> element and shows
 * a fallback avatar when camera is off.
 */

import { useEffect, useRef } from "react";
import type { LocalTrackPublication, RemoteTrackPublication } from "livekit-client";
import { Track } from "livekit-client";
import type { CallParticipant } from "../../hooks/useLiveKitCall";

// ── Colour helpers (reuse the same palette as PresenceSidebar) ────────────────
const COLORS = [
  "#f97316", "#8b5cf6", "#06b6d4",
  "#ec4899", "#84cc16", "#f59e0b",
  "#14b8a6", "#6366f1",
];

const colorFor = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

const roleLabel = (metadata: string): string => {
  try {
    const parsed = JSON.parse(metadata);
    switch (parsed.role) {
      case "interviewer": return "Interviewer";
      case "candidate":   return "Candidate";
      case "observer":    return "Observer";
    }
  } catch { /* ignore */ }
  return "Participant";
};

const roleBadgeClass = (metadata: string): string => {
  try {
    const parsed = JSON.parse(metadata);
    switch (parsed.role) {
      case "interviewer": return "bg-navy/15 text-navy";
      case "candidate":   return "bg-accent/15 text-accent";
    }
  } catch { /* ignore */ }
  return "bg-ink/8 text-ink/60";
};

type VideoTileProps = {
  participant: CallParticipant;
  /** If true, renders a larger local preview mirror */
  isLocal?: boolean;
  className?: string;
};

const VideoTile = ({ participant, isLocal = false, className = "" }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach video track
  useEffect(() => {
    const pub = participant.videoPublication as LocalTrackPublication | RemoteTrackPublication | undefined;
    if (!pub?.track || !videoRef.current) return;

    pub.track.attach(videoRef.current);
    return () => {
      pub.track?.detach();
    };
  }, [participant.videoPublication]);

  // Attach audio track (skip local — would cause echo)
  useEffect(() => {
    if (isLocal) return;
    const pub = participant.audioPublication as RemoteTrackPublication | undefined;
    if (!pub?.track || !audioRef.current) return;

    pub.track.attach(audioRef.current);
    return () => {
      pub.track?.detach();
    };
  }, [participant.audioPublication, isLocal]);

  const avatarColor = colorFor(participant.identity);
  const initial     = (participant.name || "?").slice(0, 1).toUpperCase();
  const showVideo   = !participant.isCameraOff && !!participant.videoPublication?.track;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-ink/10 bg-ink/90 ${className}`}
      aria-label={`${participant.name} video tile`}
    >
      {/* Video element (always present, hidden when camera off) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          showVideo ? "opacity-100" : "opacity-0"
        } ${isLocal ? "-scale-x-100" : ""}`}
      />

      {/* Audio element for remote participants */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Avatar fallback when camera is off */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg"
            style={{ background: avatarColor }}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Name bar overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-white">
            {participant.name}
            {isLocal && <span className="ml-1 text-white/50 font-normal">(you)</span>}
          </span>
          <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${roleBadgeClass(participant.metadata)}`}>
            {roleLabel(participant.metadata)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {participant.isMuted && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80 text-white text-[10px]" title="Muted">
              🔇
            </span>
          )}
          {participant.isCameraOff && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/50 text-white text-[10px]" title="Camera off">
              📷
            </span>
          )}
        </div>
      </div>

      {/* Source track kind label (for debugging — hidden in prod) */}
      {isLocal && (
        <div className="absolute top-2 left-2">
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] text-white/60 uppercase tracking-widest">
            {Track.Source.Camera}
          </span>
        </div>
      )}
    </div>
  );
};

export default VideoTile;
