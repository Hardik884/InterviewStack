const { Queue } = require("bullmq");
const { bullConnection, attachRedisErrorLogger } = require("../config/redis");
const { AI_FEEDBACK_QUEUE_NAME } = require("./constants");

const aiFeedbackQueue = new Queue(AI_FEEDBACK_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

attachRedisErrorLogger(aiFeedbackQueue, "aiFeedbackQueue");

module.exports = aiFeedbackQueue;
