import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";

const generateRoomId = () => {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
};

const Rooms = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");

  const shareLink = useMemo(() => {
    if (!roomId) {
      return "";
    }

    return `${window.location.origin}/rooms/${roomId}`;
  }, [roomId]);

  const handleCreate = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    navigate(`/rooms/${newRoomId}`, { state: { name } });
  };

  const handleJoin = () => {
    if (!roomId) {
      return;
    }

    navigate(`/rooms/${roomId}`, { state: { name } });
  };

  const handleCopy = async () => {
    if (!shareLink) {
      return;
    }

    await navigator.clipboard.writeText(shareLink);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Collaborative rooms"
        subtitle="Create a room or join with a shared link to start live coding."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card title="Create or join">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Room ID"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="room-3f8d1a"
            />
            <Input
              label="Display name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="accent" onClick={handleCreate}>
              Create room
            </Button>
            <Button variant="ghost" onClick={handleJoin}>
              Join room
            </Button>
          </div>
        </Card>

        <Card title="Share room link" subtitle="Invite collaborators instantly.">
          {shareLink ? (
            <div className="space-y-3">
              <p className="text-xs text-ink/60">{shareLink}</p>
              <Button variant="ghost" onClick={handleCopy}>
                Copy link
              </Button>
            </div>
          ) : (
            <EmptyState
              title="No active room yet"
              description="Create a room to generate a shareable link."
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default Rooms;
