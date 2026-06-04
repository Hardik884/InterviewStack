const mongoose = require("mongoose");

const aiFeedbackSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 1, max: 10, default: null },
    problemSolving: { type: String, default: "" },
    codeQuality: { type: String, default: "" },
    timeComplexity: { type: String, default: "" },
    spaceComplexity: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    optimizationSuggestions: { type: [String], default: [] },
    interviewerNotes: { type: String, default: "" },
    generatedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "generating", "completed", "failed", "unavailable"],
      default: "pending",
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    roomId: {
      type: String,
      default: "",
    },
    code: {
      type: String,
      default: "",
    },
    sourceCode: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    verdict: {
      type: String,
      enum: [
        "Accepted",
        "Wrong Answer",
        "Runtime Error",
        "Time Limit Exceeded",
        "Compilation Error",
        "Pending",
      ],
      default: "Pending",
    },
    runtime: {
      type: Number,
      default: null,
    },
    memory: {
      type: Number,
      default: null,
    },
    stdout: {
      type: String,
      default: "",
    },
    stderr: {
      type: String,
      default: "",
    },
    executionTime: {
      type: Number,
      default: null,
    },
    aiFeedback: {
      type: aiFeedbackSchema,
      default: () => ({
        score: null,
        problemSolving: "",
        codeQuality: "",
        timeComplexity: "",
        spaceComplexity: "",
        strengths: [],
        weaknesses: [],
        optimizationSuggestions: [],
        interviewerNotes: "",
        generatedAt: null,
        status: "pending",
      }),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Submission", submissionSchema);
