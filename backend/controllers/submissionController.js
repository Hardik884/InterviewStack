const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { delCache, delCacheByPattern } = require("../services/cacheService");
const submissionQueue = require("../queues/submissionQueue");
const { getIO } = require("../sockets/socketRegistry");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");
const { executeRun } = require("../services/codeExecutionService");

/**
 * Emit a submission event to the room (if any) and directly to the user's socket.
 */
const emitToUser = (io, userId, eventName, payload) => {
  if (!io) return;

  // Room-based broadcast
  if (payload.roomId) {
    io.to(payload.roomId).emit(eventName, payload);
  }

  // Direct-to-user socket broadcast for users not in a room
  const userIdStr = String(userId);
  io.sockets.sockets.forEach((socket) => {
    if (socket.user?.id === userIdStr) {
      socket.emit(eventName, payload);
    }
  });
};

const createSubmission = async (req, res, next) => {
  try {
    const { problemId, code, sourceCode, language, roomId } = req.body;
    const resolvedCode = sourceCode || code || "";
    console.log("Submission API hit", { problemId, language, roomId, codeLength: resolvedCode.length });

    if (!resolvedCode.trim()) {
      return res.status(400).json({ message: "Cannot submit empty code" });
    }

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const submission = await Submission.create({
      userId: req.user._id,
      submittedBy: req.user._id,
      problemId,
      roomId: roomId || "",
      code: resolvedCode,
      sourceCode: resolvedCode,
      language,
      verdict: "Pending",
      status: "queued",
    });

    const job = await submissionQueue.add("submission", {
      submissionId: submission._id,
      roomId: submission.roomId,
    });

    console.log(`Job added to ${SUBMISSION_QUEUE_NAME}`, {
      jobId: job.id,
      submissionId: submission._id,
    });

    const counts = await submissionQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );
    console.log("Queue counts", counts);

    const io = getIO();
    const eventPayload = {
      submissionId: String(submission._id),
      verdict: "Pending",
      status: "queued",
      problemId: String(submission.problemId),
      userId: String(submission.userId),
      roomId: submission.roomId,
    };
    emitToUser(io, req.user._id, "submission:update", eventPayload);

    await delCache(`analytics:dashboard:${req.user._id}`);
    await delCache(`analytics:activity:${req.user._id}`);
    await delCacheByPattern("analytics:leaderboard:*");

    return res.status(201).json({
      message: "Submission created successfully",
      submission,
    });
  } catch (error) {
    return next(error);
  }
};

const runSubmission = async (req, res, next) => {
  try {
    const { problemId, code, sourceCode, language, input } = req.body;
    const resolvedCode = sourceCode || code || "";
    console.log("Run API hit", { problemId, language, codeLength: resolvedCode.length });

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const examples = problem.examples?.length
      ? problem.examples
      : problem.testCases || [];
    const sampleInput = input || examples?.[0]?.input || "";

    const result = await executeRun({
      sourceCode: resolvedCode,
      language,
      input: sampleInput,
    });

    return res.status(200).json({
      message: "Run completed",
      result,
    });
  } catch (error) {
    return next(error);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({
      $or: [{ userId: req.user._id }, { submittedBy: req.user._id }],
    })
      .sort({ createdAt: -1 });

    return res.status(200).json({ submissions });
  } catch (error) {
    return next(error);
  }
};

const getSubmissionsByProblem = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ problemId: req.params.problemId })
      .sort({ createdAt: -1 });

    return res.status(200).json({ submissions });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSubmission,
  runSubmission,
  getMySubmissions,
  getSubmissionsByProblem,
};
