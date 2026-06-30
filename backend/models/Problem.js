const mongoose = require("mongoose");

const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
    },
    expectedOutput: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    tags: {
      type: [String],
      default: [],
    },
    categories: {
      type: [String],
      default: [],
    },
    examples: {
      type: [
        {
          input: { type: String, required: true },
          output: { type: String, required: true },
          explanation: { type: String, default: "" },
        },
      ],
      default: [],
    },
    constraints: {
      type: [String],
      default: [],
    },
    starterCode: {
      type: {
        javascript: { type: String, default: "" },
        cpp: { type: String, default: "" },
        java: { type: String, default: "" },
        python: { type: String, default: "" },
      },
      default: () => ({
        javascript: "",
        cpp: "",
        java: "",
        python: "",
      }),
    },
    acceptanceRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    companyTags: {
      type: [String],
      default: [],
    },
    hints: {
      type: [String],
      default: [],
    },
    editorialSummary: {
      type: String,
      default: "",
    },
    estimatedFrequency: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    relatedTopics: {
      type: [String],
      default: [],
    },
    testCases: {
      type: [testCaseSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

problemSchema.index({ difficulty: 1, createdAt: -1 });
problemSchema.index({ tags: 1 });
problemSchema.index({ title: "text" });

module.exports = mongoose.model("Problem", problemSchema);
