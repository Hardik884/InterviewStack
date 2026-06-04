/**
 * VideoPanel.tsx — Collapsible video/audio calling panel for the interview workspace.
 *
 * Features:
 *   - Collapsible with smooth animation (matches WorkspaceLayout pattern)
 *   - Shows local + remote video tiles
 *   - Camera on/off, mic mute/unmute, leave call controls
 *   - Connection status indicator
 *   - Participant names + role badges on each tile
 *   - Handles reconnect state with retry button
 *   - Skipped for solo sessions (roomId starts with "solo-")
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CallParticipant, CallConnectionState } from "../../hooks/useLiveKitCall";
import VideoTile from "./VideoTile";

// ── Status indicator ──────────────────────────────────────────────────────────
const statusConfig: Record<CallConnectionState, { label: string; cls: string; dot: string }> = {
  disconnected: { label: "Not connected",  cls: "text-slate-500",   dot: "bg-slate-300" },
  connecting:   { label: "Connecting…",    cls: "text-amber-600",   dot: "bg-amber-400 animate-pulse" },
  connected:    { label: "Live",           cls: "text-emerald-600", dot: "bg-emerald-500 animate-ping" },
  reconnecting: { label: "Reconnecting…", cls: "text-amber-600",   dot: "bg-amber-400 animate-pulse" },
  error:        { label: "Call error",     cls: "text-rose-600",    dot: "bg-rose-500" },
};

type VideoPanelProps = {
  participants: CallParticipant[];
  connectionState: CallConnectionState;
  isMuted: boolean;
  isCameraOff: boolean;
  error: string | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  onReconnect: () => void;
};

const VideoPanel = ({
  participants,
  connectionState,
  isMuted,
  isCameraOff,
  error,
  onToggleMic,
  onToggleCamera,
  onLeave,
  onReconnect,
}: VideoPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  const { label, cls, dot } = statusConfig[connectionState];
  const localParticipant  = participants.find((p) => p.isLocal);
  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const isConnected = connectionState === "connected";
  const isError     = connectionState === "error";

  return (
    <div
      className="overflow-hidden rounded-3xl border border-ink/8 bg-white/95 shadow-soft"
      role="region"
      aria-label="Video call panel"
    >
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        id="video-panel-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="video-panel-body"
        className="flex w-full items-center justify-between border-b border-ink/6 px-5 py-3 text-sm font-semibold hover:bg-ink/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Animated status dot */}
          <span className="relative flex h-2 w-2 flex-shrink-0">
            {connectionState === "connected" && (
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${dot}`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
          </span>
          <span className="text-ink">Video call</span>
          <span className={`text-xs font-medium ${cls}`}>· {label}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Control buttons — only when connected */}
          {isConnected && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Mic */}
              <button
                type="button"
                id="video-panel-mic-toggle"
                title={isMuted ? "Unmute mic" : "Mute mic"}
                onClick={onToggleMic}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                  isMuted
                    ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                    : "bg-ink/5 text-ink hover:bg-ink/10"
                }`}
                aria-pressed={isMuted}
              >
                {isMuted ? "🔇" : "🎙️"}
              </button>

              {/* Camera */}
              <button
                type="button"
                id="video-panel-camera-toggle"
                title={isCameraOff ? "Turn camera on" : "Turn camera off"}
                onClick={onToggleCamera}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                  isCameraOff
                    ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                    : "bg-ink/5 text-ink hover:bg-ink/10"
                }`}
                aria-pressed={isCameraOff}
              >
                {isCameraOff ? "📷" : "📹"}
              </button>

              {/* Leave */}
              <button
                type="button"
                id="video-panel-leave"
                title="Leave call"
                onClick={onLeave}
                className="flex h-7 items-center gap-1 rounded-full bg-rose-500 px-2.5 text-[11px] font-semibold text-white hover:bg-rose-600 transition-colors"
              >
                ✕ Leave
              </button>
            </div>
          )}

          {/* Collapse chevron */}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-ink/40"
          >
            ▾
          </motion.span>
        </div>
      </button>

      {/* ── Collapsible body ───────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="video-panel-body"
            key="video-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {/* Error state */}
              {isError && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700">
                    {error || "Failed to connect to call"}
                  </p>
                  <button
                    type="button"
                    id="video-panel-reconnect"
                    onClick={onReconnect}
                    className="ml-4 flex-shrink-0 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Connecting placeholder */}
              {connectionState === "connecting" && (
                <div className="flex h-28 items-center justify-center rounded-2xl border border-ink/10 bg-ink/4">
                  <p className="text-xs text-ink/50 animate-pulse">Joining call…</p>
                </div>
              )}

              {/* Video grid — shown once connected (even if no remotes yet) */}
              {isConnected && (
                <div
                  className={`grid gap-3 ${
                    remoteParticipants.length === 0
                      ? "grid-cols-1"
                      : remoteParticipants.length === 1
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {/* Local tile */}
                  {localParticipant && (
                    <VideoTile
                      participant={localParticipant}
                      isLocal
                      className="aspect-video"
                    />
                  )}

                  {/* Remote tiles */}
                  {remoteParticipants.map((p) => (
                    <VideoTile
                      key={p.identity}
                      participant={p}
                      className="aspect-video"
                    />
                  ))}

                  {/* Waiting placeholder when alone */}
                  {remoteParticipants.length === 0 && (
                    <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-ink/3">
                      <p className="text-center text-xs text-ink/40">
                        Waiting for other<br />participant…
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Disconnected state */}
              {connectionState === "disconnected" && !isError && (
                <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-ink/3">
                  <p className="text-xs text-ink/40">Call ended</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoPanel;
