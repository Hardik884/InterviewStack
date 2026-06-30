const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res
        .status(500)
        .json({ message: "JWT_SECRET is not defined in the environment" });
    }

    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select("_id name email role");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Role-based authorization guard. Use AFTER `protect`.
 * Example: router.post("/", protect, authorize("admin"), handler)
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const role = req.user.role || "candidate";
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ message: "Forbidden: insufficient permissions" });
  }
  return next();
};

module.exports = {
  protect,
  authorize,
};
