const express = require("express");
const {
  createProblem,
  getProblems,
  getProblemById,
  getProblemBySlug,
  updateProblemById,
  deleteProblemById,
} = require("../controllers/problemController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateProblemCreate,
  validateProblemUpdate,
  validateObjectIdParam,
} = require("../middleware/validateRequest");

const router = express.Router();

// POST /api/problems
router.post("/", protect, validateProblemCreate, createProblem);

// GET /api/problems
router.get("/", getProblems);

// GET /api/problems/slug/:slug
router.get("/slug/:slug",getProblemBySlug);

// GET /api/problems/:id
router.get("/:id", protect, validateObjectIdParam("id"), getProblemById);

// PUT /api/problems/:id
router.put("/:id", protect, validateObjectIdParam("id"), validateProblemUpdate, updateProblemById);

// DELETE /api/problems/:id
router.delete("/:id", protect, validateObjectIdParam("id"), deleteProblemById);

module.exports = router;
