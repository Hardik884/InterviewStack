const mongoose = require("mongoose");

/**
 * Room — durable record of interview room membership.
 *
 * Membership is the server-side source of truth for authorization:
 *   - LiveKit token issuance verifies the requester is a participant.
 *   - AI feedback / submission access verifies room participation.
 *   - Roles are assigned by the server (never trusted from the client).
 *
 * The in-memory presence registry (sockets/roomHandlers.js) handles live
 * broadcast; this collection persists membership so authorization survives
 * disconnects and server restarts.
 */
const roomParticipantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, default: "Anonymous" },
    role: {
      type: String,
      enum: ["interviewer", "candidate", "observer"],
      default: "candidate",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    participants: {
      type: [roomParticipantSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
