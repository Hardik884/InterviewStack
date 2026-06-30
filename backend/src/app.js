const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("../routes/authRoutes");
const problemRoutes = require("../routes/problemRoutes");
const submissionRoutes = require("../routes/submissionRoutes");
const analyticsRoutes = require("../analytics/analyticsRoutes");
const resumeRoutes = require("../routes/resumeRoutes");
const testRoutes = require("../routes/testRoutes");
const livekitRoutes = require("../routes/livekitRoutes");
const { corsOptions } = require("../config/cors");
const { notFound, errorHandler } = require("../middleware/errorHandler");

const app = express();

// Trust the platform proxy (Render/Vercel) so req.ip reflects the real client
// IP for rate limiting rather than the proxy address.
app.set("trust proxy", 1);

// ── Security headers ─────────────────────────────────────────────────────────
// This service only ever returns JSON (the SPA is hosted separately on Vercel),
// so a strict Content-Security-Policy here adds little and risks breaking
// future error pages; instead we ship the safe transport/clickjacking headers
// and allow cross-origin resource sharing for the SPA.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// ── Security & parsing ───────────────────────────────────────────────────────
// Limit request body size to prevent payload flooding.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// CORS — explicit allow-list (no wildcard). See config/cors.js.
app.use(cors(corsOptions));

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
app.use("/api/livekit", livekitRoutes);

// ── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
