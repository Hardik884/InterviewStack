const mongoose = require("mongoose");

const resumeAnalysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      default: null,
    },
    parsedText: {
      type: String,
      default: "",
    },
    aiFeedback: {
      type: Object,
      default: null,
    },
    atsScore: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    jobId: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// History list (per user) and status polling (jobId + ownership).
resumeAnalysisSchema.index({ userId: 1, createdAt: -1 });
resumeAnalysisSchema.index({ jobId: 1, userId: 1 });

module.exports = mongoose.model("ResumeAnalysis", resumeAnalysisSchema);
