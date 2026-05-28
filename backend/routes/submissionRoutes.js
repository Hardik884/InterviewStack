const express = require("express");
const {
  createSubmission,
  getMySubmissions,
  getSubmissionsByProblem,
} = require("../controllers/submissionController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateSubmissionCreate,
  validateObjectIdParam,
} = require("../middleware/validateRequest");

const router = express.Router();

// POST /api/submissions
router.post("/", protect, validateSubmissionCreate, createSubmission);

// GET /api/submissions/me
router.get("/me", protect, getMySubmissions);

// GET /api/submissions/problem/:problemId
router.get(
  "/problem/:problemId",
  protect,
  validateObjectIdParam("problemId"),
  getSubmissionsByProblem
);

module.exports = router;
