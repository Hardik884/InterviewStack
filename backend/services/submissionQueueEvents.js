const { Queue, QueueEvents } = require("bullmq");
const { bullConnection } = require("../config/redis");
const Submission = require("../models/Submission");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");

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
      if (!submission?.roomId) {
        return;
      }

      io.to(submission.roomId).emit("submission:update", {
        submissionId: String(submission._id),
        verdict: submission.verdict,
        status: submission.status,
        problemId: String(submission.problemId),
        userId: String(submission.userId || submission.submittedBy),
      });
      console.log("Socket event emitted", {
        event: "submission:update",
        submissionId: String(submission._id),
      });
    } catch (error) {
      console.error("Submission queue event error:", error.message);
    }
  });

  queueEvents.on("failed", async ({ jobId }) => {
    try {
      const job = await queue.getJob(jobId);
      if (!job?.data?.submissionId) {
        return;
      }

      const submission = await Submission.findById(job.data.submissionId);
      if (!submission?.roomId) {
        return;
      }

      io.to(submission.roomId).emit("submission:update", {
        submissionId: String(submission._id),
        verdict: submission.verdict,
        status: submission.status,
        problemId: String(submission.problemId),
        userId: String(submission.userId || submission.submittedBy),
      });
      console.log("Socket event emitted", {
        event: "submission:update",
        submissionId: String(submission._id),
      });
    } catch (error) {
      console.error("Submission queue event error:", error.message);
    }
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error("Submission queue failed", { jobId, failedReason });
  });

  queueEvents.on("stalled", ({ jobId }) => {
    console.warn("Submission queue stalled", { jobId });
  });

  queueEvents.on("error", (error) => {
    console.error("Submission queue event error:", error.message);
  });

  return queueEvents;
};

module.exports = {
  registerSubmissionQueueEvents,
};
