const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const BCRYPT_ROUNDS = 12; // Increased from 10 for better security

const signToken = (user) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id: String(user._id), name: user.name, role: user.role || "candidate" },
    secret,
    { expiresIn }
  );
};

/**
 * POST /api/auth/register
 * Validates inputs server-side and creates a new user.
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Server-side validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const trimmedName = String(name).trim().slice(0, 128);
    const trimmedEmail = String(email).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: trimmedEmail }).select("_id").lean();
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
    });

    const token = signToken(user);

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/login
 * Constant-time comparison prevents timing attacks.
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Always select+compare to avoid timing oracle (user not found ≠ wrong password timing)
    const user = await User.findOne({ email: trimmedEmail }).select("+password");

    // Use a dummy hash to keep compare time consistent even for non-existent users.
    const DUMMY_HASH = "$2a$12$invalidhashfortimingreductionXXXXXXXXXXXXXXXXXXXXXXX";
    const passwordToCheck = user ? user.password : DUMMY_HASH;
    const isMatch = await bcrypt.compare(String(password), passwordToCheck);

    if (!user || !isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns the current user from the verified JWT.
 */
const getCurrentUser = async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(200).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
};

module.exports = { registerUser, loginUser, getCurrentUser };
