const dotenv = require("dotenv");
const { Worker } = require("bullmq");
const { bullConnection } = require("../config/redis");
const connectDB = require("../config/db");
const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { executeAgainstTests } = require("../services/codeExecutionService");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");
const aiFeedbackQueue = require("../queues/aiFeedbackQueue");

dotenv.config();

/**
 * Prefer explicit testCases over examples for judging;
 * fall back to examples when testCases are absent.
 */
const pickTestCases = (problem) => {
  if (problem?.testCases?.length) {
    return problem.testCases; // { input, expectedOutput }
  }

  if (problem?.examples?.length) {
    return problem.examples.map((item) => ({
      input: item.input,
      expectedOutput: item.output,
    }));
  }

  return [];
};

const startWorker = async () => {
  await connectDB();
  console.log("[Worker] Submission worker connected to MongoDB");

  const worker = new Worker(
    SUBMISSION_QUEUE_NAME,
    async (job) => {
      const { submissionId } = job.data;

      // --- Skip debug jobs ---
      if (job.name === "debug") {
        return { status: "debug-received" };
      }

      if (!submissionId) {
        throw new Error("Job missing submissionId");
      }

      // Mark processing
      const submission = await Submission.findById(submissionId);
      if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
      }

      if (submission.status === "completed") {
        console.log(`[Worker] Skipping already-completed submission ${submissionId}`);
        return { status: "skipped" };
      }

      await Submission.findByIdAndUpdate(submissionId, {
        status: "processing",
        verdict: "Pending",
      });

      // Fetch problem
      const problem = await Problem.findById(submission.problemId).select(
        "testCases examples"
      );
      if (!problem) {
        throw new Error(`Problem ${submission.problemId} not found`);
      }

      const testCases = pickTestCases(problem);
      if (!testCases.length) {
        // No test cases — mark as a judge error rather than crashing the worker.
        await Submission.findByIdAndUpdate(submissionId, {
          status: "completed",
          verdict: "Judge Error",
          stderr: "No test cases configured for this problem.",
        });
        return { status: "completed", verdict: "Judge Error" };
      }

      const sourceCode = (submission.sourceCode || submission.code || "").trim();
      if (!sourceCode) {
        await Submission.findByIdAndUpdate(submissionId, {
          status: "completed",
          verdict: "Wrong Answer",
          stderr: "Empty source code submitted.",
        });
        return { status: "completed", verdict: "Wrong Answer" };
      }

      const { results, verdict } = await executeAgainstTests({
        sourceCode,
        language: submission.language,
        testCases,
      });

      // Aggregate metrics from all test results.
      const totalRuntimeMs = results.reduce(
        (sum, r) => sum + (r.time ? Math.round(r.time * 1000) : 0),
        0
      );
      const lastResult = results[results.length - 1] || {};

      await Submission.findByIdAndUpdate(submissionId, {
        $set: {
          status: "completed",
          verdict,
          runtime: totalRuntimeMs || null,
          executionTime: totalRuntimeMs || null,
          memory: lastResult.memory || null,
          stdout: lastResult.stdout || "",
          stderr: lastResult.stderr || lastResult.compileOutput || "",
          // Always write aiFeedback as a full object — dot-notation fails when
          // the field is null (legacy documents) and MongoDB cannot create
          // nested fields inside a null element.
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
            status: "pending",
          },
        },
      });

      console.log(`[Worker] Submission ${submissionId} → ${verdict}`);

      // Enqueue AI feedback — fire and forget, never block submission.
      try {
        await aiFeedbackQueue.add("ai-feedback", {
          submissionId: String(submissionId),
          problemId: String(submission.problemId),
        });
        console.log(`[Worker] AI feedback job queued for submission ${submissionId}`);
      } catch (queueErr) {
        console.error(`[Worker] Failed to queue AI feedback job: ${queueErr.message}`);
      }

      return { status: "completed", verdict };
    },
    {
      connection: bullConnection,
      concurrency: 2,
      // Remove completed jobs after 1h, failed after 24h.
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    }
  );

  worker.on("ready", () => console.log("[Worker] Submission worker ready"));

  worker.on("active", (job) =>
    console.log(`[Worker] Processing job ${job.id} — submission ${job.data.submissionId}`)
  );

  worker.on("completed", (job, result) =>
    console.log(`[Worker] Job ${job.id} completed`, result)
  );

  worker.on("failed", async (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);

    if (job?.data?.submissionId) {
      try {
        await Submission.findByIdAndUpdate(job.data.submissionId, {
          status: "failed",
          verdict: "Runtime Error",
          stderr: error.message,
        });
      } catch (updateErr) {
        console.error("[Worker] Failed to update submission after job failure:", updateErr.message);
      }
    }
  });

  worker.on("stalled", (jobId) =>
    console.warn(`[Worker] Job ${jobId} stalled`)
  );

  worker.on("error", (error) =>
    console.error("[Worker] Worker error:", error.message)
  );

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[Worker] Received ${signal}, shutting down gracefully…`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("[Worker] Unhandled rejection:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("[Worker] Uncaught exception:", error.stack || error.message);
  });
};

startWorker().catch((error) => {
  console.error("[Worker] Failed to start:", error.message);
  process.exit(1);
});
