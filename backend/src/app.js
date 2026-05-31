const express = require("express");
const cors = require("cors");
const authRoutes = require("../routes/authRoutes");
const problemRoutes = require("../routes/problemRoutes");
const submissionRoutes = require("../routes/submissionRoutes");
const analyticsRoutes = require("../analytics/analyticsRoutes");
const resumeRoutes = require("../routes/resumeRoutes");
const testRoutes = require("../routes/testRoutes");
const { notFound, errorHandler } = require("../middleware/errorHandler");

const app = express();

// ── Security & parsing ───────────────────────────────────────────────────────
// Limit request body size to prevent payload flooding.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// CORS — restrict to the configured frontend origin in production.
const allowedOrigin = process.env.CLIENT_URL || "*";
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/test", testRoutes);

// ── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
