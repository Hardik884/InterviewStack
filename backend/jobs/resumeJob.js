const resumeQueue = require("../queues/resumeQueue");

const enqueueResumeAnalysis = async ({ analysisId, filePath, userId }) => {
  try {
    return await resumeQueue.add(
      "analyze-resume",
      {
        analysisId,
        filePath,
        userId,
      },
      {
        jobId: analysisId,
      }
    );
  } catch (error) {
    if (error.message && error.message.includes("Job already exists")) {
      return resumeQueue.getJob(analysisId);
    }

    throw error;
  }
};

module.exports = {
  enqueueResumeAnalysis,
};
