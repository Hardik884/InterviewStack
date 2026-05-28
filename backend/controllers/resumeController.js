const ResumeAnalysis = require("../models/ResumeAnalysis");
const resumeQueue = require("../queues/resumeQueue");
const { enqueueResumeAnalysis } = require("../jobs/resumeJob");

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const analysis = await ResumeAnalysis.create({
      userId: req.user._id,
      originalFilename: req.file.originalname,
      status: "pending",
      jobId: null,
    });

    let job;
    try {
      job = await enqueueResumeAnalysis({
        analysisId: analysis._id.toString(),
        filePath: req.file.path,
        userId: req.user._id.toString(),
      });
    } catch (queueError) {
      await ResumeAnalysis.findByIdAndUpdate(analysis._id, {
        status: "failed",
        errorMessage: queueError.message,
      });

      throw queueError;
    }

    await ResumeAnalysis.findByIdAndUpdate(analysis._id, {
      jobId: job.id,
    });

    return res.status(202).json({
      message: "Resume uploaded. Analysis started.",
      analysisId: analysis._id,
      jobId: job.id,
    });
  } catch (error) {
    return next(error);
  }
};

const getResumeHistory = async (req, res, next) => {
  try {
    const history = await ResumeAnalysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("originalFilename atsScore status createdAt");

    return res.status(200).json({ history });
  } catch (error) {
    return next(error);
  }
};

const getResumeById = async (req, res, next) => {
  try {
    const analysis = await ResumeAnalysis.findOne({
      _id: req.params.id,
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

const getResumeStatus = async (req, res, next) => {
  try {
    const analysis = await ResumeAnalysis.findOne({
      jobId: req.params.jobId,
      userId: req.user._id,
    }).select("status jobId errorMessage createdAt");

    if (!analysis) {
      return res.status(404).json({ message: "Resume job not found" });
    }

    const job = await resumeQueue.getJob(req.params.jobId);
    const jobState = job ? await job.getState() : "not-found";

    return res.status(200).json({
      status: analysis.status,
      jobId: analysis.jobId,
      jobState,
      errorMessage: analysis.errorMessage,
      createdAt: analysis.createdAt,
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
