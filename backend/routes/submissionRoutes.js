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

const router = express.Router();

// POST /api/submissions
router.post("/", protect, validateSubmissionCreate, createSubmission);

// POST /api/submissions/run
router.post("/run", protect, validateSubmissionRun, runSubmission);

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

