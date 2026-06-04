/**
 * livekitRoutes.js — Routes for LiveKit token generation.
 *
 * POST /api/livekit/token
 *   Protected: requires valid JWT.
 *   Body: { roomId: string, role: "interviewer" | "candidate" | "observer" }
 *   Returns: { token: string, wsUrl: string, roomId: string }
 */

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getLiveKitToken } = require("../controllers/livekitController");

const router = express.Router();

router.post("/token", protect, getLiveKitToken);

module.exports = router;
