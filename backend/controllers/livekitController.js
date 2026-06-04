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
const getLiveKitToken = async (req, res) => {
  try {
    console.log({
      LIVEKIT_API_KEY: !!process.env.LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET: !!process.env.LIVEKIT_API_SECRET,
      LIVEKIT_WS_URL: !!process.env.LIVEKIT_WS_URL,
    });
    const { roomId, role = "candidate" } = req.body;

    // Read env at call time so dotenv is always loaded first
    const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || "";

    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      return res.status(400).json({ message: "roomId is required" });
    }

    if (!LIVEKIT_WS_URL) {
      return res.status(503).json({ message: "LiveKit is not configured on this server (LIVEKIT_WS_URL missing)" });
    }

    const safeRole = ["interviewer", "candidate", "observer"].includes(role)
      ? role
      : "candidate";

    const token = await generateLiveKitToken({
      roomId: roomId.trim(),
      userId: String(req.user._id),
      name: req.user.name || "Anonymous",
      role: safeRole,
    });

    return res.json({
      token,
      wsUrl: LIVEKIT_WS_URL,
      roomId: roomId.trim(),
    });
  } catch (err) {
    console.error("[LiveKit] Token generation failed:", err.message);
    return res.status(500).json({ message: "Failed to generate LiveKit token" });
  }
};

module.exports = { getLiveKitToken };
