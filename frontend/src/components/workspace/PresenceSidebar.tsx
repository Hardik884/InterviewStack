/**
 * PresenceSidebar.tsx
 *
 * Displays all participants in the room with:
 *   - Colored avatar (matches their cursor color)
 *   - Name + role badge
 *   - Live status dot (Online / Reconnecting / Offline)
 *   - Typing indicator inline
 */

import { useMemo } from "react";
import type { Participant, TypingUser } from "../../hooks/useInterviewRoom";
import type { ConnectionStatus } from "../../hooks/useConnectionStatus";

// ── Color palette (matches useCursorPresence) ────────────────────────────
const CURSOR_COLORS = [
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f59e0b",
  "#14b8a6",
  "#6366f1",
];

const colorForUser = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
};

const roleLabel = (role: string) => {
  switch (role) {
    case "host":
      return "Host";
    case "interviewer":
      return "Interviewer";
    case "candidate":
      return "Candidate";
    case "observer":
      return "Observer";
    default:
      return "Participant";
  }
};

const roleBadgeClass = (role: string) => {
  switch (role) {
    case "host":
    case "interviewer":
      return "bg-navy/10 text-navy";
    case "candidate":
      return "bg-accent/10 text-accent";
    case "observer":
      return "bg-ink/8 text-ink/60";
    default:
      return "bg-ink/5 text-ink/50";
  }
};

type StatusDotProps = {
  status: ConnectionStatus;
};

const StatusDot = ({ status }: StatusDotProps) => {
  if (status === "online") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (status === "reconnecting") {
    return <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />;
  }
  return <span className="h-2 w-2 rounded-full bg-slate-300" />;
};

type PresenceSidebarProps = {
  participants: Participant[];
  typingUsers: TypingUser[];
  connectionStatus: ConnectionStatus;
  reconnectAttempt?: number;
  myUserId?: string;
};

const PresenceSidebar = ({
  participants,
  typingUsers,
  connectionStatus,
  reconnectAttempt = 0,
  myUserId,
}: PresenceSidebarProps) => {
  const typingSet = useMemo(
    () => new Set(typingUsers.map((u) => u.userId)),
    [typingUsers]
  );

  const onlineCount = participants.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/50">
            Participants
          </p>
          <div className="flex items-center gap-1.5">
            <StatusDot status={connectionStatus} />
            <span
              className={`text-xs font-medium ${
                connectionStatus === "online"
                  ? "text-emerald-600"
                  : connectionStatus === "reconnecting"
                  ? "text-amber-600"
                  : "text-slate-400"
              }`}
            >
              {connectionStatus === "online"
                ? `${onlineCount} online`
                : connectionStatus === "reconnecting"
                ? `Reconnecting${reconnectAttempt > 0 ? ` #${reconnectAttempt}` : ""}…`
                : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Participant list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1.5">
        {participants.length === 0 && (
          <p className="py-6 text-center text-xs text-ink/40">
            Waiting for participants…
          </p>
        )}

        {participants.map((p) => {
          const color = colorForUser(p.userId);
          const isMe = p.userId === myUserId;
          const isTyping = typingSet.has(p.userId);

          return (
            <div
              key={p.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isMe ? "bg-ink/5" : "hover:bg-ink/3"
              }`}
            >
              {/* Avatar */}
              <div
                className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                style={{ background: color }}
              >
                {(p.name || "?").slice(0, 1).toUpperCase()}
                {/* Online dot */}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-ink">
                    {p.name}
                    {isMe && (
                      <span className="ml-1 text-ink/40 font-normal">(you)</span>
                    )}
                  </p>
                  <span
                    className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleBadgeClass(
                      p.role
                    )}`}
                  >
                    {roleLabel(p.role)}
                  </span>
                </div>

                {/* Typing indicator */}
                {isTyping && !isMe ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-ink/50 italic">typing</span>
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1 w-1 rounded-full bg-ink/30 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-ink/40">
                    🟢 Online
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Typing summary footer */}
      {typingUsers.filter((u) => u.userId !== myUserId).length > 0 && (
        <div className="border-t border-ink/8 px-4 py-2">
          {typingUsers
            .filter((u) => u.userId !== myUserId)
            .map((u) => (
              <p key={u.userId} className="text-[11px] text-ink/50 italic">
                {u.name} is typing…
              </p>
            ))}
        </div>
      )}
    </div>
  );
};

export default PresenceSidebar;
