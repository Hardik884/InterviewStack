const dotenv = require("dotenv");
const { Worker } = require("bullmq");
const { bullConnection } = require("../config/redis");
const connectDB = require("../config/db");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const { parsePdfResume } = require("../services/resumeParser");
const { analyzeResume } = require("../services/aiService");

// Load environment variables for the worker process
dotenv.config();

const startWorker = async () => {
  await connectDB();

  const resumeWorker = new Worker(
    "resume-analysis",
    async (job) => {
      const { analysisId, filePath } = job.data;

      const analysis = await ResumeAnalysis.findById(analysisId);
      if (!analysis) {
        throw new Error("Resume analysis record not found");
      }

      if (analysis.status === "completed") {
        return { status: "skipped" };
      }

      await ResumeAnalysis.findByIdAndUpdate(analysisId, {
        status: "processing",
      });

      const parsedText = await parsePdfResume(filePath);
      const aiResult = await analyzeResume(parsedText);

      await ResumeAnalysis.findByIdAndUpdate(analysisId, {
        parsedText,
        aiFeedback: aiResult,
        atsScore: aiResult.atsScore || null,
        status: "completed",
        errorMessage: null,
      });

      return { status: "completed" };
    },
    {
      connection: bullConnection,
      concurrency: 2,
    }
  );

  resumeWorker.on("completed", (job) => {
    console.log(`Resume job completed: ${job.id}`);
  });

  resumeWorker.on("failed", async (job, error) => {
    console.error(`Resume job failed: ${job?.id}`, error.message);

    if (job?.data?.analysisId) {
      await ResumeAnalysis.findByIdAndUpdate(job.data.analysisId, {
        status: "failed",
        errorMessage: error.message,
      });
    }
  });
};

startWorker().catch((error) => {
  console.error("Failed to start resume worker:", error.message);
  process.exit(1);
});
