/**
 * livekitController.js — HTTP endpoint to issue LiveKit participant tokens.
 *
 * POST /api/livekit/token
 * Body: { roomId, role }
 *
 * Authorization: Bearer <JWT>   (via protect middleware)
 *
 * Security:
 *   - User must be authenticated (JWT guard via protect middleware).
 *   - roomId is validated to be a non-empty string.
 *   - Token is scoped to the exact roomId — participants cannot join other rooms.
 */

const { generateLiveKitToken } = require("../services/livekitService");
const { getParticipantRole, isSoloRoom } = require("../services/roomService");

const getLiveKitToken = async (req, res) => {
  try {
    const { roomId } = req.body;

    // Read env at call time so dotenv is always loaded first
    const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || "";

    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      return res.status(400).json({ message: "roomId is required" });
    }

    if (!LIVEKIT_WS_URL) {
      return res.status(503).json({ message: "LiveKit is not configured on this server (LIVEKIT_WS_URL missing)" });
    }

    const targetRoom = roomId.trim();

    if (isSoloRoom(targetRoom)) {
      return res.status(400).json({ message: "Video calls are not available for solo sessions" });
    }

    // ── Authorization: the user MUST be a recorded participant of the room ───
    // Membership is established server-side when the user joins via socket
    // (room:join), so a token cannot be minted for an arbitrary room ID.
    const serverRole = await getParticipantRole(targetRoom, req.user._id);
    if (!serverRole) {
      return res.status(403).json({ message: "You are not a participant of this room" });
    }

    // Observers may watch but not publish media. The role here is the
    // server-assigned role — the client-supplied role is ignored.
    const canPublish = serverRole !== "observer";

    const token = await generateLiveKitToken({
      roomId: targetRoom,
      userId: String(req.user._id),
      name: req.user.name || "Anonymous",
      role: serverRole,
      canPublish,
    });

    return res.json({
      token,
      wsUrl: LIVEKIT_WS_URL,
      roomId: targetRoom,
    });
  } catch (err) {
    console.error("[LiveKit] Token generation failed:", err.message);
    return res.status(500).json({ message: "Failed to generate LiveKit token" });
  }
};

module.exports = { getLiveKitToken };
