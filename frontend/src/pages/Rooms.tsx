import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";

const generateRoomId = () => `room-${Math.random().toString(36).slice(2, 8)}`;

const Rooms = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as { user?: { name?: string } | null };
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomIdError, setRoomIdError] = useState("");

  const shareLink = useMemo(
    () => (roomId ? `${window.location.origin}/join/${roomId}` : ""),
    [roomId]
  );

  const handleCreate = () => {
    const newId = generateRoomId();
    setRoomId(newId);
    // Creator is always the interviewer — persist role immediately and go to lobby
    sessionStorage.setItem(`room:${newId}:role`, "interviewer");
    navigate(`/lobby/${newId}`, { state: { name: name || user?.name } });
  };

  const handleJoin = () => {
    const trimmed = joinRoomId.trim();
    if (!trimmed) {
      setRoomIdError("Please enter a room ID.");
      return;
    }
    setRoomIdError("");
    // Send joiner to role selection first
    navigate(`/join/${trimmed}`, { state: { name: name || user?.name } });
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Room link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Collaborative rooms"
        subtitle="Create a private room or join with a shared link to start live coding."
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-6 lg:grid-cols-[1.2fr_1fr]"
      >
        {/* Create room */}
        <Card title="Create a new room">
          <div className="space-y-4">
            <Input
              label="Your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user?.name || "Anonymous"}
            />
            <div className="flex gap-3">
              <Button variant="accent" onClick={handleCreate} className="flex-1">
                ＋ Create room
              </Button>
            </div>
          </div>
        </Card>

        {/* Join room */}
        <Card title="Join existing room" subtitle="Enter a room ID shared by your interviewer.">
          <div className="space-y-4">
            <Input
              label="Room ID"
              value={joinRoomId}
              onChange={(e) => {
                setJoinRoomId(e.target.value);
                setRoomIdError("");
              }}
              placeholder="room-3f8d1a"
              error={roomIdError}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
            <Button variant="ghost" onClick={handleJoin} className="w-full">
              Join room →
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Share link panel */}
      {shareLink ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card title="Share your room" subtitle="Copy and send this link to your collaborator.">
            <div className="flex flex-wrap items-center gap-3">
              <code className="flex-1 rounded-2xl border border-ink/10 bg-ink/4 px-4 py-2.5 text-xs text-ink/70 break-all">
                {shareLink}
              </code>
              <Button
                variant={copied ? "primary" : "ghost"}
                size="sm"
                onClick={handleCopy}
              >
                {copied ? "✓ Copied" : "Copy link"}
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <EmptyState
          title="No active room"
          description="Create a room above to get a shareable invite link."
        />
      )}

      {/* Tips */}
      <Card title="How it works" subtitle="Quick guide to collaborative sessions" animate={false}>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          {[
            { step: "1", text: "Create a room — you get a unique link." },
            { step: "2", text: "Share the link with your interviewer or peer." },
            { step: "3", text: "Code together in real-time with live sync." },
          ].map(({ step, text }) => (
            <div key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {step}
              </span>
              <p className="text-ink/60 text-xs leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Rooms;
