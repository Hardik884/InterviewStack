const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getDashboard,
  getLeaderboard,
  getActivity,
} = require("./analyticsController");

const router = express.Router();

// GET /api/analytics/dashboard
router.get("/dashboard", protect, getDashboard);

// GET /api/analytics/leaderboard
router.get("/leaderboard", protect, getLeaderboard);

// GET /api/analytics/activity
router.get("/activity", protect, getActivity);

module.exports = router;
