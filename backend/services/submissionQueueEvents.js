const { Queue, QueueEvents } = require("bullmq");
const { bullConnection } = require("../config/redis");
const Submission = require("../models/Submission");
const { delCache, delCacheByPattern } = require("../services/cacheService");
const { SUBMISSION_QUEUE_NAME, AI_FEEDBACK_QUEUE_NAME } = require("../queues/constants");

/**
 * Invalidate a user's analytics caches after a verdict changes so dashboards
 * and the leaderboard reflect the new result immediately (instead of waiting
 * for the cache TTL to expire).
 */
const invalidateAnalyticsCache = async (userId) => {
  if (!userId) return;
  try {
    await delCache(`analytics:dashboard:${userId}`);
    await delCache(`analytics:activity:${userId}`);
    await delCacheByPattern("analytics:leaderboard:*");
  } catch (err) {
    console.error("Analytics cache invalidation error:", err.message);
  }
};

/**
 * Emit a submission update to:
 *   - The room the submission was made in (if any)
 *   - Any socket whose authenticated user matches the submission's userId
 */
const emitSubmissionUpdate = (io, submission) => {
  const payload = {
    submissionId: String(submission._id),
    verdict: submission.verdict,
    status: submission.status,
    problemId: String(submission.problemId),
    userId: String(submission.userId || submission.submittedBy),
    stdout: submission.stdout || "",
    stderr: submission.stderr || "",
    runtime: submission.runtime ?? null,
    memory: submission.memory ?? null,
    executionTime: submission.executionTime ?? null,
  };

  if (submission.roomId) {
    io.to(submission.roomId).emit("submission:update", payload);
    console.log("Socket event emitted to room", {
      event: "submission:update",
      submissionId: String(submission._id),
      roomId: submission.roomId,
    });
  }

  // Also emit directly to the submission owner's personal room (cross-instance).
  const userId = String(submission.userId || submission.submittedBy);
  io.to(`user:${userId}`).emit("submission:update", payload);
};

/**
 * Emit AI feedback update to the submission owner and room.
 */
const emitFeedbackUpdate = (io, submission) => {
  const payload = {
    submissionId: String(submission._id),
    problemId: String(submission.problemId),
    userId: String(submission.userId || submission.submittedBy),
    aiFeedback: submission.aiFeedback || null,
  };

  if (submission.roomId) {
    io.to(submission.roomId).emit("feedback:update", payload);
  }

  const userId = String(submission.userId || submission.submittedBy);
  io.to(`user:${userId}`).emit("feedback:update", payload);
};

const registerSubmissionQueueEvents = (io) => {
  const queue = new Queue(SUBMISSION_QUEUE_NAME, { connection: bullConnection });
  const queueEvents = new QueueEvents(SUBMISSION_QUEUE_NAME, { connection: bullConnection });

  queueEvents.on("ready", () => {
    console.log("Submission queue events ready");
  });

  queueEvents.on("completed", async ({ jobId }) => {
    try {
      const job = await queue.getJob(jobId);
      if (!job?.data?.submissionId) {
        return;
      }

      const submission = await Submission.findById(job.data.submissionId);
      if (!submission) {
        return;
      }

      emitSubmissionUpdate(io, submission);
      await invalidateAnalyticsCache(String(submission.userId || submission.submittedBy));
    } catch (error) {
      console.error("Submission queue event (completed) error:", error.message);
    }
  });

  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    console.error("Submission queue job failed", { jobId, failedReason });
    try {
      const job = await queue.getJob(jobId);
      if (!job?.data?.submissionId) {
        return;
      }

      const submission = await Submission.findById(job.data.submissionId);
      if (!submission) {
        return;
      }

      emitSubmissionUpdate(io, submission);
      await invalidateAnalyticsCache(String(submission.userId || submission.submittedBy));
    } catch (error) {
      console.error("Submission queue event (failed) error:", error.message);
    }
  });

  queueEvents.on("stalled", ({ jobId }) => {
    console.warn("Submission queue stalled", { jobId });
  });

  queueEvents.on("error", (error) => {
    console.error("Submission queue event error:", error.message);
  });

  return queueEvents;
};

/**
 * Register QueueEvents for the AI feedback queue.
 * Emits "feedback:update" socket events when feedback is ready.
 */
const registerAiFeedbackQueueEvents = (io) => {
  const feedbackQueue = new Queue(AI_FEEDBACK_QUEUE_NAME, { connection: bullConnection });
  const feedbackQueueEvents = new QueueEvents(AI_FEEDBACK_QUEUE_NAME, { connection: bullConnection });

  feedbackQueueEvents.on("ready", () => {
    console.log("AI Feedback queue events ready");
  });

  feedbackQueueEvents.on("completed", async ({ jobId }) => {
    try {
      const job = await feedbackQueue.getJob(jobId);
      if (!job?.data?.submissionId) return;

      const submission = await Submission.findById(job.data.submissionId);
      if (!submission) return;

      emitFeedbackUpdate(io, submission);
    } catch (error) {
      console.error("AI Feedback queue event (completed) error:", error.message);
    }
  });

  feedbackQueueEvents.on("failed", async ({ jobId, failedReason }) => {
    console.error("AI Feedback queue job failed", { jobId, failedReason });
    try {
      const job = await feedbackQueue.getJob(jobId);
      if (!job?.data?.submissionId) return;

      const submission = await Submission.findById(job.data.submissionId);
      if (!submission) return;

      // Emit with null/unavailable so the UI shows the unavailable state
      emitFeedbackUpdate(io, submission);
    } catch (error) {
      console.error("AI Feedback queue event (failed) error:", error.message);
    }
  });

  feedbackQueueEvents.on("stalled", ({ jobId }) => {
    console.warn("AI Feedback queue stalled", { jobId });
  });

  feedbackQueueEvents.on("error", (error) => {
    console.error("AI Feedback queue event error:", error.message);
  });

  return feedbackQueueEvents;
};

module.exports = {
  registerSubmissionQueueEvents,
  registerAiFeedbackQueueEvents,
};

