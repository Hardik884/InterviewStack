const express = require("express");
const { registerUser, loginUser, getCurrentUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateRegister,
  validateLogin,
} = require("../middleware/validateRequest");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

// Brute-force / credential-stuffing protection (per IP).
const loginLimiter = rateLimit({
  keyPrefix: "auth:login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again in a few minutes.",
});
const registerLimiter = rateLimit({
  keyPrefix: "auth:register",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many accounts created from this network. Please try again later.",
});

// POST /api/auth/register
router.post("/register", registerLimiter, validateRegister, registerUser);

// POST /api/auth/login
router.post("/login", loginLimiter, validateLogin, loginUser);

// GET /api/auth/me
router.get("/me", protect, getCurrentUser);

module.exports = router;
