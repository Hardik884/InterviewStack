const express = require("express");
const { registerUser, loginUser, getCurrentUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateRegister,
  validateLogin,
} = require("../middleware/validateRequest");

const router = express.Router();

// POST /api/auth/register
router.post("/register", validateRegister, registerUser);

// POST /api/auth/login
router.post("/login", validateLogin, loginUser);

// GET /api/auth/me
router.get("/me", protect, getCurrentUser);

module.exports = router;
