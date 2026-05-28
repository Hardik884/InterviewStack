const express = require("express");
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const {
  uploadResume,
  getResumeHistory,
  getResumeById,
  getResumeStatus,
} = require("../controllers/resumeController");
const { validateObjectIdParam } = require("../middleware/validateRequest");

const router = express.Router();

const maxFileSizeMb = Math.max(
  parseInt(process.env.RESUME_MAX_FILE_MB, 10) || 5,
  1
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads", "resumes"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) {
    return cb(new Error("Only PDF files are allowed"));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
});

// POST /api/resume/upload
router.post("/upload", protect, upload.single("resume"), uploadResume);

// GET /api/resume/history
router.get("/history", protect, getResumeHistory);

// GET /api/resume/status/:jobId
router.get(
  "/status/:jobId",
  protect,
  validateObjectIdParam("jobId"),
  getResumeStatus
);

// GET /api/resume/:id
router.get("/:id", protect, validateObjectIdParam("id"), getResumeById);

module.exports = router;
