const express = require("express");
const {
  createProblem,
  getProblems,
  getProblemById,
  getProblemBySlug,
  updateProblemById,
  deleteProblemById,
} = require("../controllers/problemController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateProblemCreate,
  validateProblemUpdate,
  validateObjectIdParam,
} = require("../middleware/validateRequest");

const router = express.Router();

// POST /api/problems — admin only
router.post("/", protect, authorize("admin"), validateProblemCreate, createProblem);

// GET /api/problems
router.get("/", getProblems);

// GET /api/problems/slug/:slug
router.get("/slug/:slug",getProblemBySlug);

// GET /api/problems/:id
router.get("/:id", protect, validateObjectIdParam("id"), getProblemById);

// PUT /api/problems/:id — admin only
router.put("/:id", protect, authorize("admin"), validateObjectIdParam("id"), validateProblemUpdate, updateProblemById);

// DELETE /api/problems/:id — admin only
router.delete("/:id", protect, authorize("admin"), validateObjectIdParam("id"), deleteProblemById);

module.exports = router;
