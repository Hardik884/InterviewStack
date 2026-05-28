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

// Parse JSON bodies
app.use(express.json());

// Enable CORS for all routes (customize as needed)
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/test", testRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
