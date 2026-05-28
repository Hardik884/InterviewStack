import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import { useAuth } from "../hooks/useAuth";
import { useRoomSocket } from "../hooks/useRoomSocket";

const RoomSession = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();
  const [theme, setTheme] = useState("vs-dark");
  const [localName, setLocalName] = useState("");

  useEffect(() => {
    if (location.state?.name) {
      setLocalName(location.state.name);
    }
  }, [location.state]);

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
    name: localName || user?.name || "Anonymous",
  });

  useEffect(() => {
    const key = `room:${roomId}:code`;
    const saved = localStorage.getItem(key);
    if (saved) {
      sendCode(saved);
    }
  }, [roomId]);

  useEffect(() => {
    const key = `room:${roomId}:code`;
    const handle = setTimeout(() => {
      localStorage.setItem(key, code);
    }, 500);

    return () => clearTimeout(handle);
  }, [code, roomId]);

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) {
      return null;
    }

    return `${typingUsers.length} person typing...`;
  }, [typingUsers.length]);

  if (!roomId) {
    return <p className="text-sm text-ink/60">Room not found.</p>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Room ${roomId}`}
        subtitle="Collaborative coding session"
        action={<Badge>Live</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[2.2fr_1fr]">
        <Card title="Editor" subtitle="Real-time sync enabled">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Language</span>
              <select
                aria-label="Select language"
                value={language}
                onChange={(event) => changeLanguage(event.target.value)}
                className="rounded-full border border-ink/20 bg-white px-3 py-1"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Theme</span>
              <button
                type="button"
                className="rounded-full border border-ink/20 px-3 py-1"
                onClick={() =>
                  setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"))
                }
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
          {typingLabel ? (
            <p className="mt-2 text-xs text-ink/60">{typingLabel}</p>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card title="Participants">
            <div className="space-y-2 text-sm">
              {participants.map((participant) => (
                <div key={participant.userId} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                    {participant.name?.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p>{participant.name}</p>
                    <p className="text-xs text-ink/50">Online</p>
                  </div>
                </div>
              ))}
              {!participants.length && (
                <span className="text-xs text-ink/60">Waiting for others.</span>
              )}
            </div>
          </Card>

          <Card title="Room activity">
            <div className="space-y-2 text-xs text-ink/60">
              {activity.map((item, index) => (
                <div key={`${item.timestamp}-${index}`}>
                  {item.message}
                </div>
              ))}
              {!activity.length && (
                <span className="text-xs text-ink/60">No activity yet.</span>
              )}
            </div>
          </Card>

          <Card title="Status">
            <div className="space-y-2 text-xs text-ink/60">
              <p>Realtime sync: active</p>
              <p>Typing indicators: enabled</p>
              <p>Room privacy: invite-only</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoomSession;
