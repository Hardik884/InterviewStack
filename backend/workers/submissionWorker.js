const dotenv = require("dotenv");
const { Queue, Worker } = require("bullmq");
const { bullConnection } = require("../config/redis");
const connectDB = require("../config/db");
const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { executeAgainstTests } = require("../services/codeExecutionService");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");

// Load environment variables for the worker process
dotenv.config();

const pickTestCases = (problem) => {
  if (problem?.examples?.length) {
    return problem.examples.map((item) => ({
      input: item.input,
      expectedOutput: item.output,
    }));
  }

  return problem?.testCases || [];
};

const startWorker = async () => {
  await connectDB();
  console.log("Submission worker connected to MongoDB");

  const debugQueue = new Queue(SUBMISSION_QUEUE_NAME, {
    connection: bullConnection,
  });

  if (process.env.SUBMISSION_DEBUG_DUMMY === "true") {
    await debugQueue.add("debug", { timestamp: Date.now() });
    console.log("Debug submission job added");
  }

  const submissionWorker = new Worker(
    SUBMISSION_QUEUE_NAME,
    async (job) => {
      console.log("Worker received job", {
        jobId: job.id,
        name: job.name,
      });

      if (job.name === "debug") {
        return { status: "debug-received" };
      }

      const { submissionId } = job.data;

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        throw new Error("Submission not found");
      }

      if (submission.status === "completed") {
        return { status: "skipped" };
      }

      await Submission.findByIdAndUpdate(submissionId, {
        status: "processing",
        verdict: "Pending",
      });

      const problem = await Problem.findById(submission.problemId);
      if (!problem) {
        throw new Error("Problem not found for submission");
      }

      const testCases = pickTestCases(problem);
      if (!testCases.length) {
        throw new Error("No test cases available for this problem");
      }

      const sourceCode = submission.sourceCode || submission.code;
      const { results, verdict } = await executeAgainstTests({
        sourceCode,
        language: submission.language,
        testCases,
      });

      const latest = results[results.length - 1] || {};
      const totalTime = results
        .map((item) => item.time || 0)
        .reduce((sum, value) => sum + value, 0);

      await Submission.findByIdAndUpdate(submissionId, {
        status: "completed",
        verdict,
        runtime: latest.time ? Math.round(latest.time * 1000) : null,
        executionTime: totalTime ? Math.round(totalTime * 1000) : null,
        memory: latest.memory || null,
        stdout: latest.stdout || "",
        stderr: latest.stderr || latest.compileOutput || "",
      });

      console.log("Submission updated", { submissionId, verdict });

      return { status: "completed", verdict };
    },
    {
      connection: bullConnection,
      concurrency: 2,
    }
  );

  submissionWorker.on("ready", () => {
    console.log("Submission worker ready");
  });

  submissionWorker.on("active", (job) => {
    console.log(`Submission job processing: ${job.id}`);
  });

  submissionWorker.on("completed", (job, result) => {
    console.log(`Submission job completed: ${job.id}`, result);
  });

  submissionWorker.on("failed", async (job, error) => {
    console.error(`Submission job failed: ${job?.id}`, error.stack || error.message);

    if (job?.data?.submissionId) {
      await Submission.findByIdAndUpdate(job.data.submissionId, {
        status: "failed",
        verdict: "Runtime Error",
        stderr: error.message,
      });

    }
  });

  submissionWorker.on("stalled", (jobId) => {
    console.warn(`Submission job stalled: ${jobId}`);
  });

  submissionWorker.on("error", (error) => {
    console.error("Submission worker error:", error.stack || error.message);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection in submission worker:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in submission worker:", error.stack || error.message);
  });
};

startWorker().catch((error) => {
  console.error("Failed to start submission worker:", error.message);
  process.exit(1);
});
