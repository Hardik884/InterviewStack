// Load env BEFORE requiring config/redis (it captures REDIS_URL at load time).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Worker } = require("bullmq");
const { bullConnection } = require("../config/redis");
const connectDB = require("../config/db");
const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { generateInterviewFeedback } = require("../services/aiService");
const { AI_FEEDBACK_QUEUE_NAME } = require("../queues/constants");

const startWorker = async () => {
  await connectDB();
  console.log("[AI Feedback Worker] Connected to MongoDB");

  const worker = new Worker(
    AI_FEEDBACK_QUEUE_NAME,
    async (job) => {
      const { submissionId, problemId } = job.data;

      if (!submissionId || !problemId) {
        throw new Error("Job missing submissionId or problemId");
      }

      console.log(`[AI Feedback Worker] Processing feedback for submission ${submissionId}`);

      // Fetch submission and problem in parallel
      const [submission, problem] = await Promise.all([
        Submission.findById(submissionId),
        Problem.findById(problemId).select("title description"),
      ]);

      if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
      }
      if (!problem) {
        throw new Error(`Problem ${problemId} not found`);
      }

      // Mark as generating — write full object so this is safe even on legacy
      // null documents that predate the schema default change.
      await Submission.findByIdAndUpdate(submissionId, {
        $set: {
          aiFeedback: {
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
            status: "generating",
          },
        },
      });

      // Generate feedback — returns null on failure, never throws
      const feedback = await generateInterviewFeedback({
        title: problem.title,
        description: problem.description,
        code: submission.sourceCode || submission.code || "",
        language: submission.language,
        verdict: submission.verdict,
        stdout: submission.stdout || "",
        stderr: submission.stderr || "",
      });

      if (!feedback) {
        // AI failed — mark unavailable but do NOT fail the job (submission is fine)
        await Submission.findByIdAndUpdate(submissionId, {
          $set: {
            aiFeedback: {
              score: null,
              problemSolving: "",
              codeQuality: "",
              timeComplexity: "",
              spaceComplexity: "",
              strengths: [],
              weaknesses: [],
              optimizationSuggestions: [],
              interviewerNotes: "",
              generatedAt: new Date(),
              status: "unavailable",
            },
          },
        });
        console.warn(`[AI Feedback Worker] Feedback unavailable for submission ${submissionId}`);
        return { status: "unavailable" };
      }

      // Persist feedback
      await Submission.findByIdAndUpdate(submissionId, {
        aiFeedback: {
          score: typeof feedback.score === "number" ? Math.min(10, Math.max(1, feedback.score)) : null,
          problemSolving: feedback.problemSolving || "",
          codeQuality: feedback.codeQuality || "",
          timeComplexity: feedback.timeComplexity || "",
          spaceComplexity: feedback.spaceComplexity || "",
          strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
          weaknesses: Array.isArray(feedback.weaknesses) ? feedback.weaknesses : [],
          optimizationSuggestions: Array.isArray(feedback.optimizationSuggestions)
            ? feedback.optimizationSuggestions
            : [],
          interviewerNotes: feedback.interviewerNotes || "",
          generatedAt: new Date(),
          status: "completed",
        },
      });

      console.log(
        `[AI Feedback Worker] Feedback saved for submission ${submissionId}. Score: ${feedback.score}`
      );
      return { status: "completed", score: feedback.score };
    },
    {
      connection: bullConnection,
      concurrency: 2,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    }
  );

  worker.on("ready", () => console.log("[AI Feedback Worker] Ready"));

  worker.on("active", (job) =>
    console.log(
      `[AI Feedback Worker] Processing job ${job.id} — submission ${job.data.submissionId}`
    )
  );

  worker.on("completed", (job, result) =>
    console.log(`[AI Feedback Worker] Job ${job.id} completed`, result)
  );

  worker.on("failed", async (job, error) => {
    console.error(`[AI Feedback Worker] Job ${job?.id} failed:`, error.message);

    // Mark submission feedback as failed — submission itself is unaffected
    if (job?.data?.submissionId) {
      try {
        await Submission.findByIdAndUpdate(job.data.submissionId, {
          $set: {
            aiFeedback: {
              score: null,
              problemSolving: "",
              codeQuality: "",
              timeComplexity: "",
              spaceComplexity: "",
              strengths: [],
              weaknesses: [],
              optimizationSuggestions: [],
              interviewerNotes: "",
              generatedAt: new Date(),
              status: "failed",
            },
          },
        });
      } catch (updateErr) {
        console.error("[AI Feedback Worker] Failed to update feedback status:", updateErr.message);
      }
    }
  });

  worker.on("stalled", (jobId) =>
    console.warn(`[AI Feedback Worker] Job ${jobId} stalled`)
  );

  worker.on("error", (error) =>
    console.error("[AI Feedback Worker] Worker error:", error.message)
  );

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[AI Feedback Worker] Received ${signal}, shutting down gracefully…`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("[AI Feedback Worker] Unhandled rejection:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error(
      "[AI Feedback Worker] Uncaught exception:",
      error.stack || error.message
    );
  });
};

startWorker().catch((error) => {
  console.error("[AI Feedback Worker] Failed to start:", error.message);
  process.exit(1);
});
