const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { delCache, delCacheByPattern } = require("../services/cacheService");
const submissionQueue = require("../queues/submissionQueue");
const { getIO } = require("../sockets/socketRegistry");
const { SUBMISSION_QUEUE_NAME } = require("../queues/constants");
const { executeRun } = require("../services/codeExecutionService");

const createSubmission = async (req, res, next) => {
  try {
    const { problemId, code, sourceCode, language, roomId } = req.body;
    console.log("Submission API hit", { problemId, language, roomId });

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const submission = await Submission.create({
      userId: req.user._id,
      submittedBy: req.user._id,
      problemId,
      roomId: roomId || "",
      code: code || sourceCode,
      sourceCode: sourceCode || code,
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
    if (io && submission.roomId) {
      io.to(submission.roomId).emit("submission:update", {
        submissionId: submission._id,
        verdict: "Pending",
        status: "queued",
        problemId: String(submission.problemId),
        userId: String(submission.userId),
      });
      console.log("Socket event emitted", {
        event: "submission:update",
        submissionId: submission._id,
        roomId: submission.roomId,
      });
    }

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
    console.log("Run API hit", { problemId, language });

    const problem = await Problem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const examples = problem.examples?.length
      ? problem.examples
      : problem.testCases || [];
    const sampleInput = input || examples?.[0]?.input || "";

    const result = await executeRun({
      sourceCode: sourceCode || code,
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
