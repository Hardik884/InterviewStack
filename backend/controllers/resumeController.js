const ResumeAnalysis = require("../models/ResumeAnalysis");
const resumeQueue = require("../queues/resumeQueue");
const { enqueueResumeAnalysis } = require("../jobs/resumeJob");

// ── Upload & enqueue ──────────────────────────────────────────────────────────

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    console.log(`[Resume] UPLOAD_RECEIVED — ${req.file.originalname} (${req.file.size} bytes) userId=${req.user._id}`);

    const analysis = await ResumeAnalysis.create({
      userId:           req.user._id,
      originalFilename: req.file.originalname,
      filePath:         req.file.path,   // persist path for re-processing
      status:           "pending",
      jobId:            null,
    });

    console.log(`[Resume] JOB_CREATED — analysisId=${analysis._id}`);

    let job;
    try {
      job = await enqueueResumeAnalysis({
        analysisId: analysis._id.toString(),
        filePath:   req.file.path,
        userId:     req.user._id.toString(),
      });
      console.log(`[Resume] JOB_ADDED_TO_QUEUE — jobId=${job.id} analysisId=${analysis._id}`);
    } catch (queueError) {
      console.error("[Resume] Queue error:", queueError.message);
      await ResumeAnalysis.findByIdAndUpdate(analysis._id, {
        status:       "failed",
        errorMessage: queueError.message,
      });
      throw queueError;
    }

    await ResumeAnalysis.findByIdAndUpdate(analysis._id, { jobId: job.id });

    return res.status(202).json({
      message:    "Resume uploaded. Analysis started.",
      analysisId: analysis._id,
      jobId:      job.id,
    });
  } catch (error) {
    return next(error);
  }
};


// ── History ───────────────────────────────────────────────────────────────────

const getResumeHistory = async (req, res, next) => {
  try {
    const history = await ResumeAnalysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("originalFilename atsScore status createdAt errorMessage");

    return res.status(200).json({ history });
  } catch (error) {
    return next(error);
  }
};

// ── Get by ID ─────────────────────────────────────────────────────────────────

const getResumeById = async (req, res, next) => {
  try {
    const analysis = await ResumeAnalysis.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ message: "Resume analysis not found" });
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    return next(error);
  }
};

// ── Status (used for polling) ─────────────────────────────────────────────────
// NOTE: jobId is a BullMQ string ID, NOT a MongoDB ObjectId.

const getResumeStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // First look up by jobId string in the DB
    const analysis = await ResumeAnalysis.findOne({
      jobId:  jobId,
      userId: req.user._id,
    }).select("status jobId errorMessage createdAt atsScore aiFeedback originalFilename");

    if (!analysis) {
      return res.status(404).json({ message: "Resume job not found" });
    }

    // Try to get BullMQ queue state (non-critical — jobs are removed after completion)
    let jobState = "unknown";
    try {
      const job = await resumeQueue.getJob(jobId);
      jobState = job ? await job.getState() : "completed-or-removed";
    } catch (_) {
      jobState = "unavailable";
    }

    return res.status(200).json({
      status:           analysis.status,
      jobId:            analysis.jobId,
      jobState,
      errorMessage:     analysis.errorMessage,
      createdAt:        analysis.createdAt,
      atsScore:         analysis.atsScore,
      originalFilename: analysis.originalFilename,
      // Include aiFeedback in status so the upload page can show inline results
      aiFeedback:       analysis.status === "completed" ? analysis.aiFeedback : null,
      analysisId:       analysis._id,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadResume,
  getResumeHistory,
  getResumeById,
  getResumeStatus,
};
