const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { delCache, delCacheByPattern } = require("../services/cacheService");
const submissionQueue = require("../queues/submissionQueue");
const { getIO } = require("../sockets/socketRegistry");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");
const { executeRun } = require("../services/codeExecutionService");
const { isParticipant, isSoloRoom } = require("../services/roomService");

/**
 * Emit a submission event to the room (if any) and directly to the user's
 * personal room. Personal-room emits are cross-instance via the Redis adapter
 * and avoid scanning every connected socket.
 */
const emitToUser = (io, userId, eventName, payload) => {
  if (!io) return;

  // Room-based broadcast
  if (payload.roomId) {
    io.to(payload.roomId).emit(eventName, payload);
  }

  // Direct-to-user broadcast (works across instances).
  io.to(`user:${String(userId)}`).emit(eventName, payload);
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

    // Only attach the submission to a room the user actually belongs to.
    // Otherwise treat it as a personal submission (empty roomId) so room
    // participants cannot gain access to feedback for code they never saw.
    let resolvedRoomId = "";
    if (roomId && !isSoloRoom(roomId)) {
      if (await isParticipant(roomId, req.user._id)) {
        resolvedRoomId = roomId;
      }
    } else if (roomId) {
      resolvedRoomId = roomId; // solo-* sessions are owner-only by definition
    }

    const submission = await Submission.create({
      userId: req.user._id,
      submittedBy: req.user._id,
      problemId,
      roomId: resolvedRoomId,
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
    const { problemId } = req.params;
    const roomId = typeof req.query.roomId === "string" ? req.query.roomId : "";

    // Default scope: only the requesting user's own submissions for this problem
    // (prevents enumeration of other users' code/verdicts).
    let filter = {
      problemId,
      $or: [{ userId: req.user._id }, { submittedBy: req.user._id }],
    };

    // Room scope: if a real (non-solo) roomId is supplied AND the requester is a
    // verified participant of that room, return that room's submissions so the
    // interviewer and candidate share visibility within the interview.
    if (roomId && !isSoloRoom(roomId) && (await isParticipant(roomId, req.user._id))) {
      filter = { problemId, roomId };
    }

    const submissions = await Submission.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({ submissions });
  } catch (error) {
    return next(error);
  }
};

const getSubmissionFeedback = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    // Also select roomId so we can grant access to verified room participants.
    const submission = await Submission.findById(submissionId).select(
      "aiFeedback userId submittedBy roomId"
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const requestingUserId = String(req.user._id);

    // 1. Submission owner (candidate who submitted)
    const ownerId = String(submission.userId || submission.submittedBy || "");
    const isOwner = Boolean(ownerId) && requestingUserId === ownerId;

    // 2. Verified room participant (interviewer / observer / candidate).
    //    Membership is checked against the durable Room record — NOT inferred
    //    from the roomId string. Solo submissions are owner-only.
    let authorized = isOwner;
    const roomId = submission.roomId || "";
    if (!authorized && roomId && !isSoloRoom(roomId)) {
      authorized = await isParticipant(roomId, req.user._id);
    }

    if (!authorized) {
      return res.status(403).json({ message: "Not authorized" });
    }

    return res.status(200).json({ aiFeedback: submission.aiFeedback || null });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSubmission,
  runSubmission,
  getMySubmissions,
  getSubmissionsByProblem,
  getSubmissionFeedback,
};
