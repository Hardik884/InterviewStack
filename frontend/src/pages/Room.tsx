/**
 * Room.tsx — Room lobby / waiting room page.
 *
 * Updated to use useInterviewRoom (presence) + useYjsEditor (CRDT editor).
 * Legacy useRoomSocket removed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import ReconnectBanner from "../components/workspace/ReconnectBanner";
import PresenceSidebar from "../components/workspace/PresenceSidebar";
import { useAuth } from "../hooks/useAuth";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useYjsEditor } from "../hooks/useYjsEditor";
import { useProblems } from "../hooks/useProblems";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { getSocket } from "../sockets/socketClient";
import toast from "react-hot-toast";
import type * as Monaco from "monaco-editor";

const RoomSession = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth() as {
    token?: string | null;
    user?: { name?: string; _id?: string; id?: string } | null;
  };
  const [showPresence, setShowPresence] = useState(true);
  const [localName] = useState(() => location.state?.name || user?.name || "Anonymous");

  // Store role in sessionStorage so InterviewWorkspace can read it.
  useEffect(() => {
    if (roomId) {
      sessionStorage.setItem(`room:${roomId}:role`, "interviewer");
    }
  }, [roomId]);

  const { data: problemsData } = useProblems({ limit: 5 });
  const recentProblems = problemsData?.problems || [];

  const myUserId = useMemo(
    () =>
      (user as Record<string, string> | null)?._id ??
      (user as Record<string, string> | null)?.id ??
      "",
    [user]
  );

  // ── Presence (participants, activity, connection status) ──────────────────
  const { participants, activity, connectionStatus: roomStatus } = useInterviewRoom({
    token,
    roomId: roomId || "",
    name: localName,
    role: "interviewer",
  });

  const { status: connectionStatus, reconnectAttempt } = useConnectionStatus({
    socket: getSocket() ?? undefined,
  });

  // ── Yjs CRDT Editor ───────────────────────────────────────────────────────
  const {
    editorRef,
    language,
    setLanguage,
    theme,
    toggleTheme,
    handleEditorMount,
    isSaving,
  } = useYjsEditor({
    roomId: roomId || "",
    userId: myUserId,
    userName: localName,
    userRole: "interviewer",
    defaultCode: "// Collaborative scratch pad — changes sync in real-time\n",
  });

  const handleStartInterview = (problemId: string) => {
    navigate(`/interview/${roomId}/${problemId}`);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Room link copied!");
  };

  if (!roomId) {
    return <p className="text-sm text-ink/60">Room not found.</p>;
  }

  const reconnectAttemptNum = connectionStatus === "reconnecting" ? 1 : 0;

  return (
    <div className="space-y-4">
      <ReconnectBanner status={connectionStatus} reconnectAttempt={reconnectAttempt} />

      <SectionHeader
        title={`Room ${roomId}`}
        subtitle="Collaborative coding session — powered by Yjs CRDT"
        action={
          <div className="flex items-center gap-2">
            <Badge>Live</Badge>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                connectionStatus === "online"
                  ? "bg-emerald-100 text-emerald-700"
                  : connectionStatus === "reconnecting"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {connectionStatus === "online"
                ? `🟢 ${participants.length} online`
                : connectionStatus === "reconnecting"
                ? "🟡 Reconnecting"
                : "🔴 Offline"}
            </span>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[2.2fr_1fr]">
        {/* ── Editor ─────────────────────────────────────────────────────── */}
        <Card
          title="Editor"
          subtitle={isSaving ? "Syncing…" : "Synced ✓ — real-time CRDT sync enabled"}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Language</span>
              <select
                aria-label="Select language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-3 py-1"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Theme</span>
              <button
                type="button"
                className="rounded-full border border-ink/20 px-3 py-1"
                onClick={toggleTheme}
              >
                {theme === "vs-dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          </div>

          {/* Monaco — uncontrolled, MonacoBinding drives content */}
          <Editor
            height="420px"
            theme={theme}
            language={language}
            defaultValue=""
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        </Card>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink/10 bg-white/80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-ink/8">
              <p className="text-xs font-semibold text-ink/70">Participants</p>
              <button
                type="button"
                onClick={() => setShowPresence((v) => !v)}
                className="text-xs text-ink/40 hover:text-ink/70"
              >
                {showPresence ? "Hide" : "Show"}
              </button>
            </div>
            {showPresence && (
              <div className="max-h-64 overflow-y-auto">
                <PresenceSidebar
                  participants={participants}
                  typingUsers={[]}
                  connectionStatus={connectionStatus}
                  reconnectAttempt={reconnectAttempt}
                  myUserId={myUserId}
                />
              </div>
            )}
          </div>

          <Card title="Room activity">
            <div className="space-y-1 text-xs text-ink/60 max-h-32 overflow-y-auto">
              {activity.map((item, index) => (
                <div key={`${item.timestamp}-${index}`}>{item.message}</div>
              ))}
              {!activity.length && <span>No activity yet.</span>}
            </div>
          </Card>

          {recentProblems.length > 0 && (
            <Card title="Start with a problem">
              <div className="space-y-2 text-xs">
                {recentProblems.slice(0, 4).map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleStartInterview(p._id)}
                    className="flex w-full items-center justify-between rounded-xl border border-ink/10 px-3 py-2 text-left hover:bg-ink/5 transition"
                  >
                    <span className="font-medium text-ink truncate">{p.title}</span>
                    <span className="ml-2 shrink-0 text-ink/50">{p.difficulty}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card title="Share">
            <div className="space-y-2">
              <p className="text-xs text-ink/60 break-all">{window.location.href}</p>
              <Button variant="ghost" onClick={handleCopyLink}>
                📋 Copy room link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoomSession;
