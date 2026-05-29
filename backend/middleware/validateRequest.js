const mongoose = require("mongoose");

const isEmailValid = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isDifficultyValid = (difficulty) =>
  ["easy", "medium", "hard"].includes(difficulty);

const isStarterCodeValid = (starterCode) => {
  if (!starterCode) {
    return true;
  }

  if (typeof starterCode === "string") {
    return true;
  }

  if (typeof starterCode !== "object") {
    return false;
  }

  const allowed = ["javascript", "cpp", "java", "python"];
  return Object.keys(starterCode).every((key) => allowed.includes(key));
};

const validateObjectIdParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${paramName} format` });
  }

  return next();
};

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (!isEmailValid(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  return next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!isEmailValid(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  return next();
};

const validateProblemCreate = (req, res, next) => {
  const {
    title,
    description,
    difficulty,
    tags,
    categories,
    examples,
    constraints,
    starterCode,
    acceptanceRate,
    companyTags,
    hints,
    relatedTopics,
    testCases,
  } = req.body;

  if (!title || !description || !difficulty) {
    return res.status(400).json({
      message: "Title, description, and difficulty are required",
    });
  }

  if (!isDifficultyValid(difficulty)) {
    return res.status(400).json({ message: "Invalid difficulty value" });
  }

  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({ message: "Tags must be an array" });
  }

  if (!isStarterCodeValid(starterCode)) {
    return res.status(400).json({ message: "Starter code must be a string or language map" });
  }

  if (categories && !Array.isArray(categories)) {
    return res.status(400).json({ message: "Categories must be an array" });
  }

  if (constraints && !Array.isArray(constraints)) {
    return res.status(400).json({ message: "Constraints must be an array" });
  }

  if (examples && !Array.isArray(examples)) {
    return res.status(400).json({ message: "Examples must be an array" });
  }

  if (companyTags && !Array.isArray(companyTags)) {
    return res.status(400).json({ message: "Company tags must be an array" });
  }

  if (hints && !Array.isArray(hints)) {
    return res.status(400).json({ message: "Hints must be an array" });
  }

  if (relatedTopics && !Array.isArray(relatedTopics)) {
    return res.status(400).json({ message: "Related topics must be an array" });
  }

  if (acceptanceRate !== undefined && typeof acceptanceRate !== "number") {
    return res.status(400).json({ message: "Acceptance rate must be a number" });
  }

  if (testCases && !Array.isArray(testCases)) {
    return res.status(400).json({ message: "Test cases must be an array" });
  }

  return next();
};

const validateProblemUpdate = (req, res, next) => {
  const {
    title,
    description,
    difficulty,
    tags,
    categories,
    examples,
    constraints,
    starterCode,
    acceptanceRate,
    companyTags,
    hints,
    relatedTopics,
    testCases,
  } = req.body;

  if (difficulty && !isDifficultyValid(difficulty)) {
    return res.status(400).json({ message: "Invalid difficulty value" });
  }

  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({ message: "Tags must be an array" });
  }

  if (!isStarterCodeValid(starterCode)) {
    return res.status(400).json({ message: "Starter code must be a string or language map" });
  }

  if (categories && !Array.isArray(categories)) {
    return res.status(400).json({ message: "Categories must be an array" });
  }

  if (constraints && !Array.isArray(constraints)) {
    return res.status(400).json({ message: "Constraints must be an array" });
  }

  if (examples && !Array.isArray(examples)) {
    return res.status(400).json({ message: "Examples must be an array" });
  }

  if (companyTags && !Array.isArray(companyTags)) {
    return res.status(400).json({ message: "Company tags must be an array" });
  }

  if (hints && !Array.isArray(hints)) {
    return res.status(400).json({ message: "Hints must be an array" });
  }

  if (relatedTopics && !Array.isArray(relatedTopics)) {
    return res.status(400).json({ message: "Related topics must be an array" });
  }

  if (acceptanceRate !== undefined && typeof acceptanceRate !== "number") {
    return res.status(400).json({ message: "Acceptance rate must be a number" });
  }

  if (testCases && !Array.isArray(testCases)) {
    return res.status(400).json({ message: "Test cases must be an array" });
  }

  if (title !== undefined && !title) {
    return res.status(400).json({ message: "Title cannot be empty" });
  }

  if (description !== undefined && !description) {
    return res.status(400).json({ message: "Description cannot be empty" });
  }

  return next();
};

const validateSubmissionCreate = (req, res, next) => {
  const { problemId, code, sourceCode, language, roomId } = req.body;

  if (!problemId || !(code || sourceCode) || !language) {
    return res.status(400).json({
      message: "Problem ID, code, and language are required",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(problemId)) {
    return res.status(400).json({ message: "Invalid problemId format" });
  }

  if (roomId && typeof roomId !== "string") {
    return res.status(400).json({ message: "Room ID must be a string" });
  }

  return next();
};

const validateSubmissionRun = (req, res, next) => {
  const { problemId, code, sourceCode, language } = req.body;

  if (!problemId || !(code || sourceCode) || !language) {
    return res.status(400).json({
      message: "Problem ID, code, and language are required",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(problemId)) {
    return res.status(400).json({ message: "Invalid problemId format" });
  }

  return next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProblemCreate,
  validateProblemUpdate,
  validateSubmissionCreate,
  validateSubmissionRun,
  validateObjectIdParam,
};
