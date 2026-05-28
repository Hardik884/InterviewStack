const express = require("express");
const {
	getTestMessage,
	getProtectedMessage,
} = require("../controllers/testController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/test
router.get("/", getTestMessage);

// GET /api/test/protected
router.get("/protected", protect, getProtectedMessage);

module.exports = router;
