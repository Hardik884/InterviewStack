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
      index: true,
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

module.exports = mongoose.model("ResumeAnalysis", resumeAnalysisSchema);
