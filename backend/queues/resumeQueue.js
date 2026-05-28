const { Queue } = require("bullmq");
const { bullConnection } = require("../config/redis");

const resumeQueue = new Queue("resume-analysis", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

module.exports = resumeQueue;
