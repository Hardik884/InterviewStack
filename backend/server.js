const dotenv = require("dotenv");
const http = require("http");
const path = require("path");
const { fork } = require("child_process");
const app = require("./src/app");
const connectDB = require("./config/db");
const initSocket = require("./sockets/socketHandler");
const { connectRedis } = require("./config/redis");
const { registerSubmissionQueueEvents, registerAiFeedbackQueueEvents } = require("./services/submissionQueueEvents");
const { ensureUploadDirectories } = require("./config/uploads");

// Load environment variables from .env
dotenv.config();

const PORT = process.env.PORT || 5000;

/**
 * Spawn a BullMQ worker as a child process.
 * Restarts automatically on crash (up to maxRestarts times).
 */
const spawnWorker = (workerPath, name, maxRestarts = 5) => {
  let restarts = 0;

  const start = () => {
    console.log(`[Server] 🚀 Starting worker: ${name}`);
    const child = fork(workerPath, [], {
      env: { ...process.env },
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[Server] Worker ${name} exited cleanly.`);
        return;
      }
      restarts += 1;
      console.error(
        `[Server] ⚠ Worker ${name} exited with code=${code} signal=${signal}. Restart ${restarts}/${maxRestarts}.`
      );
      if (restarts <= maxRestarts) {
        setTimeout(start, 2000 * restarts); // exponential back-off
      } else {
        console.error(`[Server] ❌ Worker ${name} exceeded max restarts. Not restarting.`);
      }
    });

    child.on("error", (err) => {
      console.error(`[Server] Worker ${name} process error:`, err.message);
    });

    return child;
  };

  return start();
};

const startServer = async () => {
  try {
    await connectDB();
    try {
      await connectRedis();
    } catch (redisError) {
      console.error("Redis connection failed:", redisError.message);
    }

    await ensureUploadDirectories();
    const server = http.createServer(app);
    const io = initSocket(server);
    registerSubmissionQueueEvents(io);
    registerAiFeedbackQueueEvents(io);

    // ── Spawn BullMQ workers ──────────────────────────────────────────────────
    // Workers run as child processes so they can be restarted independently.
    // Both workers share the same .env loaded above.
    spawnWorker(path.resolve(__dirname, "workers/resumeWorker.js"),      "ResumeWorker");
    spawnWorker(path.resolve(__dirname, "workers/submissionWorker.js"),  "SubmissionWorker");
    spawnWorker(path.resolve(__dirname, "workers/aiFeedbackWorker.js"),  "AiFeedbackWorker");

    server.listen(PORT, () => {
      console.log(`[Server] ✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
