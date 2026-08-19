const { Queue } = require("bullmq");
const { bullConnection, attachRedisErrorLogger } = require("../config/redis");
const { SUBMISSION_QUEUE_NAME } = require("./constants");

const submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

attachRedisErrorLogger(submissionQueue, "submissionQueue");

module.exports = submissionQueue;
