/**
 * roomService.js — Server-authoritative room membership & role assignment.
 *
 * The client is never trusted for role or membership. When a user joins a
 * room the server decides their role based on the room's current state and
 * persists it. All downstream authorization (LiveKit, AI feedback, room
 * submissions, room:end authority) is derived from this record.
 *
 * Role rules:
 *   - The first user to claim interviewer/host becomes the room "interviewer"
 *     (and host). Any subsequent interviewer claim is downgraded to observer
 *     to prevent privilege/role spoofing and room hijacking.
 *   - candidate / observer claims are honoured as-is.
 *   - A returning participant keeps their previously assigned role.
 *
 * Solo sessions (roomId starting with "solo-") are not persisted — they are
 * single-user scratch sessions with owner-only access semantics.
 */

const Room = require("../models/Room");

const isSoloRoom = (roomId) => typeof roomId === "string" && roomId.startsWith("solo-");

const canonicalRole = (role) => {
  if (role === "host" || role === "interviewer") return "interviewer";
  if (role === "observer") return "observer";
  return "candidate";
};

/**
 * Register (or refresh) a participant and return the server-assigned role.
 * @returns {Promise<"interviewer"|"candidate"|"observer">}
 */
const joinRoom = async ({ roomId, userId, name = "Anonymous", requestedRole }) => {
  const wanted = canonicalRole(requestedRole);
  if (isSoloRoom(roomId)) {
    return wanted;
  }

  let room = await Room.findOne({ roomId });
  if (!room) {
    room = new Room({ roomId, participants: [] });
  }

  const existing = room.participants.find((p) => String(p.user) === String(userId));
  if (existing) {
    existing.name = name;
    existing.joinedAt = new Date();
    room.status = "active";
    await room.save();
    return existing.role;
  }

  const hasInterviewer =
    Boolean(room.host) || room.participants.some((p) => p.role === "interviewer");

  let assigned = wanted;
  if (wanted === "interviewer" && hasInterviewer) {
    assigned = "observer";
  }

  room.participants.push({ user: userId, name, role: assigned, joinedAt: new Date() });
  if (assigned === "interviewer" && !room.host) {
    room.host = userId;
  }
  room.status = "active";
  await room.save();

  return assigned;
};

/** Return the participant's server-assigned role, or null if not a member. */
const getParticipantRole = async (roomId, userId) => {
  if (isSoloRoom(roomId) || !roomId || !userId) return null;
  const room = await Room.findOne({ roomId }).select("participants").lean();
  if (!room) return null;
  const participant = room.participants.find((p) => String(p.user) === String(userId));
  return participant ? participant.role : null;
};

/** True if the user is a recorded participant of the room. */
const isParticipant = async (roomId, userId) => {
  const role = await getParticipantRole(roomId, userId);
  return role !== null;
};

/** Mark a room as ended (called on host-initiated room:end). */
const endRoom = async (roomId) => {
  if (isSoloRoom(roomId)) return;
  try {
    await Room.findOneAndUpdate({ roomId }, { status: "ended" });
  } catch (_) {
    /* non-fatal */
  }
};

module.exports = {
  isSoloRoom,
  canonicalRole,
  joinRoom,
  getParticipantRole,
  isParticipant,
  endRoom,
};
