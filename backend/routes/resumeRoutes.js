const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const { ensureDirectorySync, resolveResumeUploadPath } = require("../config/uploads");
const {
  uploadResume,
  getResumeHistory,
  getResumeById,
  getResumeStatus,
} = require("../controllers/resumeController");
const { validateObjectIdParam } = require("../middleware/validateRequest");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

// Resume parsing + Gemini analysis is expensive — limit uploads per user.
const uploadLimiter = rateLimit({
  keyPrefix: "resume:upload",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Resume upload limit reached. Please try again later.",
});

const maxFileSizeMb = Math.max(
  parseInt(process.env.RESUME_MAX_FILE_MB, 10) || 5,
  1
);
const maxFilenameLength = Math.max(
  parseInt(process.env.RESUME_MAX_FILENAME_LENGTH, 10) || 120,
  30
);

const isPdfUpload = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return file.mimetype === "application/pdf" && ext === ".pdf";
};

const buildSafeFilename = () => {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return `resume-${timestamp}-${randomSuffix}.pdf`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadPath = resolveResumeUploadPath();
      ensureDirectorySync(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, buildSafeFilename());
  },
});

const fileFilter = (req, file, cb) => {
  if (file.originalname && file.originalname.length > maxFilenameLength) {
    const error = new Error("Filename is too long");
    error.statusCode = 400;
    return cb(error);
  }

  const isPdf = isPdfUpload(file);

  if (!isPdf) {
    const error = new Error("Only PDF files are allowed");
    error.statusCode = 400;
    return cb(error);
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 1,
    fieldNameSize: 100,
  },
});

// POST /api/resume/upload
router.post("/upload", protect, uploadLimiter, upload.single("resume"), uploadResume);

// GET /api/resume/history
router.get("/history", protect, getResumeHistory);

// GET /api/resume/status/:jobId
// NOTE: jobId is a BullMQ job ID (string), NOT a MongoDB ObjectId — no ObjectId validation here.
router.get("/status/:jobId", protect, getResumeStatus);

// GET /api/resume/:id
router.get("/:id", protect, validateObjectIdParam("id"), getResumeById);

module.exports = router;
