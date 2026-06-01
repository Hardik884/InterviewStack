const fs = require("fs");
const path = require("path");

const uploadRoot = process.env.UPLOAD_ROOT || "uploads";
const resumeUploadDir = process.env.RESUME_UPLOAD_DIR || "resumes";

const resolveUploadRoot = () => path.resolve(__dirname, "..", uploadRoot);
const resolveResumeUploadPath = () =>
  path.resolve(resolveUploadRoot(), resumeUploadDir);

const ensureDirectorySync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const ensureUploadDirectories = async () => {
  const rootPath = resolveUploadRoot();
  const resumePath = resolveResumeUploadPath();

  await fs.promises.mkdir(rootPath, { recursive: true });
  await fs.promises.mkdir(resumePath, { recursive: true });

  console.log("✓ Upload directory ready:", rootPath);
  console.log("✓ Resume upload directory ready:", resumePath);
};

module.exports = {
  uploadRoot,
  resumeUploadDir,
  resolveUploadRoot,
  resolveResumeUploadPath,
  ensureDirectorySync,
  ensureUploadDirectories,
};
