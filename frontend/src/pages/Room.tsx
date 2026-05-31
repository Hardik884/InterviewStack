import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import { useAuth } from "../hooks/useAuth";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { useProblems } from "../hooks/useProblems";
import toast from "react-hot-toast";

const RoomSession = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth() as { token?: string | null; user?: { name?: string } | null };
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [localName] = useState(
    () => location.state?.name || user?.name || "Anonymous"
  );

  const { data: problemsData } = useProblems({ limit: 5 });
  const recentProblems = problemsData?.problems || [];

  const {
    participants,
    code,
    language,
    typingUsers,
    activity,
    sendCode,
    updateTyping,
    changeLanguage,
  } = useRoomSocket({
    token,
    roomId: roomId || "",
    name: localName,
  });

  // Persist code to localStorage (debounced).
  useEffect(() => {
    if (!roomId || !code) return;
    const key = `room:${roomId}:code`;
    const handle = setTimeout(() => localStorage.setItem(key, code), 500);
    return () => clearTimeout(handle);
  }, [code, roomId]);

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return null;
    return typingUsers.length === 1 ? "Someone is typing…" : `${typingUsers.length} people typing…`;
  }, [typingUsers.length]);

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

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Room ${roomId}`}
        subtitle="Collaborative coding session"
        action={
          <div className="flex items-center gap-2">
            <Badge>Live</Badge>
            <Badge>{participants.length} online</Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[2.2fr_1fr]">
        <Card title="Editor" subtitle="Real-time sync enabled">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Language</span>
              <select
                aria-label="Select language"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
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
                onClick={() => setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"))}
              >
                {theme === "vs-dark" ? "Dark" : "Light"}
              </button>
            </div>
          </div>
          <Editor
            height="420px"
            theme={theme}
            language={language}
            value={code}
            onChange={(value) => {
              sendCode(value || "");
              updateTyping(true);
            }}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
          {typingLabel && (
            <p className="mt-2 text-xs text-ink/60 italic">{typingLabel}</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Participants">
            <div className="space-y-2 text-sm">
              {participants.map((participant) => (
                <div key={participant.userId} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                    {(participant.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p>{participant.name}</p>
                    <p className="text-xs text-ink/50">Online</p>
                  </div>
                </div>
              ))}
              {!participants.length && (
                <span className="text-xs text-ink/60">Waiting for others…</span>
              )}
            </div>
          </Card>

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
                Copy room link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoomSession;
