const path = require("path");
const dotenv = require("dotenv");

// Resolve .env from project root regardless of where the worker is invoked from
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const fs = require("fs/promises");
const { Worker } = require("bullmq");
const { bullConnection, attachRedisErrorLogger } = require("../config/redis");
const connectDB = require("../config/db");
const ResumeAnalysis = require("../models/ResumeAnalysis");
const { parsePdfResume } = require("../services/resumeParser");
const { analyzeResume } = require("../services/aiService");

const QUEUE_NAME = "resume-analysis";

/**
 * Best-effort deletion of an uploaded resume PDF.
 * The parsed text + AI feedback are persisted in MongoDB, so the raw file is
 * not needed after processing. Removing it prevents unbounded disk growth and
 * limits how long PII is retained on disk.
 */
const cleanupResumeFile = async (filePath, analysisId) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
    await ResumeAnalysis.findByIdAndUpdate(analysisId, { filePath: null });
    console.log(`[ResumeWorker] CLEANUP — removed processed file ${filePath}`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[ResumeWorker] CLEANUP — could not remove ${filePath}: ${err.message}`);
    }
  }
};

const startWorker = async () => {
  console.log("[ResumeWorker] WORKER_STARTED — Connecting to database...");
  await connectDB();
  console.log("[ResumeWorker] WORKER_STARTED — Database connected.");

  // Verify Redis connectivity before registering worker
  bullConnection.on("ready", () => {
    console.log("[ResumeWorker] WORKER_STARTED — Redis (BullMQ) connected and ready.");
  });

  const resumeWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { analysisId, filePath } = job.data;

      console.log(`[ResumeWorker] JOB_RECEIVED — jobId=${job.id} analysisId=${analysisId}`);

      // ── Step 1: Validate record exists ─────────────────────────────────────
      const analysis = await ResumeAnalysis.findById(analysisId);
      if (!analysis) {
        throw new Error(`[ResumeWorker] Resume analysis record ${analysisId} not found in DB`);
      }

      if (analysis.status === "completed") {
        console.log(`[ResumeWorker] JOB_RECEIVED — Job ${job.id} already completed — skipping.`);
        return { status: "skipped" };
      }

      // ── Step 2: Mark processing ─────────────────────────────────────────────
      await ResumeAnalysis.findByIdAndUpdate(analysisId, { status: "processing" });
      console.log(`[ResumeWorker] JOB_RECEIVED — status set to processing.`);

      // ── Step 3: Parse PDF ───────────────────────────────────────────────────
      console.log(`[ResumeWorker] PDF_PARSED — Parsing PDF: ${filePath}`);
      const parsedText = await parsePdfResume(filePath);

      if (!parsedText || parsedText.trim().length < 50) {
        throw new Error("Parsed PDF text is too short — may be a scanned/image PDF");
      }
      console.log(`[ResumeWorker] PDF_PARSED — Parsed ${parsedText.length} chars from PDF.`);

      // ── Step 4: AI analysis ─────────────────────────────────────────────────
      console.log(`[ResumeWorker] ANALYSIS_STARTED — Running Gemini AI analysis...`);
      console.log(`[ResumeWorker] GEMINI_REQUEST_SENT — Sending to Gemini API...`);
      const aiResult = await analyzeResume(parsedText);
      console.log(`[ResumeWorker] ANALYSIS_COMPLETED — ATS score: ${aiResult.atsScore}`);

      // ── Step 5: Persist results ─────────────────────────────────────────────
      await ResumeAnalysis.findByIdAndUpdate(analysisId, {
        parsedText,
        aiFeedback: aiResult,
        atsScore: typeof aiResult.atsScore === "number" ? aiResult.atsScore : null,
        status: "completed",
        errorMessage: null,
      });

      console.log(`[ResumeWorker] RESULT_SAVED — Analysis ${analysisId} saved to DB.`);

      // Raw PDF no longer needed — remove it (retention / disk hygiene).
      await cleanupResumeFile(filePath, analysisId);

      return { status: "completed", atsScore: aiResult.atsScore };
    },
    {
      connection: bullConnection,
      concurrency: 2,
      // Stalled job detection: if a job hasn't progressed in 5 min, reclaim it
      stalledInterval: 30_000,
      maxStalledCount: 2,
    }
  );

  resumeWorker.on("completed", (job, result) => {
    console.log(`[ResumeWorker] ✅ Job ${job.id} completed — ${JSON.stringify(result)}`);
  });

  resumeWorker.on("failed", async (job, error) => {
    console.error(`[ResumeWorker] ❌ Job ${job?.id} FAILED:`, error.message);
    console.error(error.stack);

    if (job?.data?.analysisId) {
      await ResumeAnalysis.findByIdAndUpdate(job.data.analysisId, {
        status: "failed",
        errorMessage: error.message,
      }).catch((dbErr) => {
        console.error("[ResumeWorker] Failed to update error status in DB:", dbErr.message);
      });

      // On final failure (no retries left), remove the uploaded file too.
      const attempts = job.opts?.attempts ?? 1;
      if ((job.attemptsMade ?? 0) >= attempts) {
        await cleanupResumeFile(job.data.filePath, job.data.analysisId);
      }
    }
  });

  attachRedisErrorLogger(resumeWorker, "resumeWorker");

  resumeWorker.on("active", (job) => {
    console.log(`[ResumeWorker] Job ${job.id} is now ACTIVE.`);
  });

  resumeWorker.on("stalled", (jobId) => {
    console.warn(`[ResumeWorker] Job ${jobId} STALLED — will be retried.`);
  });

  console.log(`[ResumeWorker] 🚀 Resume worker listening on queue: "${QUEUE_NAME}"`);
};

startWorker().catch((error) => {
  console.error("[ResumeWorker] Failed to start resume worker:", error.message);
  console.error(error.stack);
  process.exit(1);
});
