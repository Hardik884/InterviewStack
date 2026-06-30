const express = require("express");
const {
  createSubmission,
  runSubmission,
  getMySubmissions,
  getSubmissionsByProblem,
  getSubmissionFeedback,
} = require("../controllers/submissionController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateSubmissionCreate,
  validateSubmissionRun,
  validateObjectIdParam,
} = require("../middleware/validateRequest");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

// Code execution costs real money (JDoodle) — limit per user.
const submitLimiter = rateLimit({
  keyPrefix: "submission:create",
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "You are submitting too quickly. Please wait a moment.",
});
const runLimiter = rateLimit({
  keyPrefix: "submission:run",
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "You are running code too quickly. Please wait a moment.",
});

// POST /api/submissions
router.post("/", protect, submitLimiter, validateSubmissionCreate, createSubmission);

// POST /api/submissions/run
router.post("/run", protect, runLimiter, validateSubmissionRun, runSubmission);

// GET /api/submissions/me
router.get("/me", protect, getMySubmissions);

// GET /api/submissions/problem/:problemId
router.get(
  "/problem/:problemId",
  protect,
  validateObjectIdParam("problemId"),
  getSubmissionsByProblem
);

// GET /api/submissions/:submissionId/feedback
router.get(
  "/:submissionId/feedback",
  protect,
  validateObjectIdParam("submissionId"),
  getSubmissionFeedback
);

module.exports = router;

