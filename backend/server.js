const dotenv = require("dotenv");
const http = require("http");
const app = require("./src/app");
const connectDB = require("./config/db");
const initSocket = require("./sockets/socketHandler");
const { connectRedis } = require("./config/redis");
const { registerSubmissionQueueEvents } = require("./services/submissionQueueEvents");
const { ensureUploadDirectories } = require("./config/uploads");

// Load environment variables from .env
dotenv.config();

const PORT = process.env.PORT || 5000;

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

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
