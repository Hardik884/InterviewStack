// Load environment variables BEFORE requiring any module that reads process.env
// at load time (config/redis.js captures REDIS_URL at require-time). Requiring
// ./src/app or ./config/redis before this line would bind Redis/BullMQ to the
// localhost fallback instead of the configured REDIS_URL.
require("dotenv").config();

const http = require("http");
const path = require("path");
const { fork } = require("child_process");
const mongoose = require("mongoose");
const app = require("./src/app");
const connectDB = require("./config/db");
const initSocket = require("./sockets/socketHandler");
const { connectRedis, redisClient, bullConnection } = require("./config/redis");
const { registerSubmissionQueueEvents, registerAiFeedbackQueueEvents } = require("./services/submissionQueueEvents");
const { ensureUploadDirectories } = require("./config/uploads");

const PORT = process.env.PORT || 5000;

/**
 * Spawn a BullMQ worker as a child process.
 * Restarts automatically on crash (up to maxRestarts times).
 */
// Track spawned worker children so they can be terminated on shutdown.
const childWorkers = [];
// Set true once shutdown begins so the auto-restart logic does not respawn
// workers that exit because we asked them to.
let shuttingDown = false;

const spawnWorker = (workerPath, name, maxRestarts = 5) => {
  let restarts = 0;

  const start = () => {
    console.log(`[Server] 🚀 Starting worker: ${name}`);
    const child = fork(workerPath, [], {
      env: { ...process.env },
      stdio: "inherit",
    });

    child.workerName = name;
    childWorkers.push(child);

    child.on("exit", (code, signal) => {
      // Remove this instance from the tracking list.
      const idx = childWorkers.indexOf(child);
      if (idx !== -1) childWorkers.splice(idx, 1);

      if (shuttingDown) {
        console.log(`[Server] Worker ${name} stopped during shutdown.`);
        return;
      }
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

    registerGracefulShutdown(server, io);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown — on SIGTERM/SIGINT (e.g. Render deploys, Ctrl-C) we:
 *   1. Stop accepting new HTTP connections and close Socket.IO.
 *   2. Forward the signal to worker children so they can drain (SIGTERM)
 *      their in-flight BullMQ jobs via their own handlers; SIGKILL after a
 *      grace period if they hang.
 *   3. Close MongoDB and Redis connections.
 * A hard-exit watchdog guarantees the process dies even if a close() hangs.
 */
const registerGracefulShutdown = (server, io) => {
  const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 15000);

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] Received ${signal}. Starting graceful shutdown…`);

    // Watchdog: never let shutdown hang forever.
    const hardExit = setTimeout(() => {
      console.error("[Server] Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    hardExit.unref();

    try {
      // 1. Close Socket.IO (disconnects clients) and stop new HTTP traffic.
      await new Promise((resolve) => io.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
      console.log("[Server] HTTP server and Socket.IO closed.");

      // 2. Ask worker children to drain, then kill any stragglers.
      for (const child of childWorkers) {
        try { child.kill("SIGTERM"); } catch (_) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      for (const child of childWorkers) {
        try { child.kill("SIGKILL"); } catch (_) {}
      }

      // 3. Close datastores.
      await mongoose.connection.close().catch(() => {});
      try { if (redisClient.isOpen) await redisClient.quit(); } catch (_) {}
      try { await bullConnection.quit(); } catch (_) {}

      console.log("[Server] Shutdown complete.");
      clearTimeout(hardExit);
      process.exit(0);
    } catch (err) {
      console.error("[Server] Error during shutdown:", err.message);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
