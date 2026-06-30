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
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

const tokenLimiter = rateLimit({
  keyPrefix: "livekit:token",
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "Too many token requests. Please slow down.",
});

router.post("/token", protect, tokenLimiter, getLiveKitToken);

module.exports = router;
