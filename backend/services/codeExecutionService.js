const axios = require("axios");
const { resolveJdoodleLanguage } = require("./jdoodleLanguages");

const JDOODLE_URL = "https://api.jdoodle.com/v1/execute";
const JDOODLE_TIMEOUT_MS = Number(process.env.JDOODLE_TIMEOUT_MS || 10000);
const CPU_TIME_LIMIT = Number(process.env.JDOODLE_CPU_TIME_LIMIT || 2);

const normalizeOutput = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

const detectLeetCodeStyle = (language, sourceCode) => {
  if (!sourceCode) {
    return null;
  }

  if (language === "cpp") {
    const hasSolution = /class\s+Solution\b/.test(sourceCode);
    const hasMain = /\bint\s+main\s*\(/.test(sourceCode);
    if (hasSolution && !hasMain) {
      return "LeetCode-style method submissions are not yet supported. Please submit complete executable programs.";
    }
  }

  if (language === "java") {
    const hasSolution = /class\s+Solution\b/.test(sourceCode);
    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(sourceCode);
    if (hasSolution && !hasMain) {
      return "LeetCode-style method submissions are not yet supported. Please submit complete executable programs.";
    }
  }

  return null;
};

const parseMemory = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isNaN(numeric) ? null : numeric;
};

const runSubmission = async ({ sourceCode, language, testCase }) => {
  const mapping = resolveJdoodleLanguage(language);
  if (!mapping) {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (!process.env.JDOODLE_CLIENT_ID || !process.env.JDOODLE_CLIENT_SECRET) {
    throw new Error("JDoodle credentials are missing");
  }

  if (!sourceCode || !sourceCode.trim()) {
    return {
      statusCode: 400,
      compilationStatus: "1",
      stdout: "",
      stderr: "No code provided. Please write some code before running.",
      time: null,
      memory: null,
      passed: false,
    };
  }

  const leetCodeMessage = detectLeetCodeStyle(language, sourceCode);
  if (leetCodeMessage) {
    console.warn("Compilation failed", { reason: "leetcode-style" });
    return {
      statusCode: 400,
      compilationStatus: "1",
      stdout: "",
      stderr: leetCodeMessage,
      time: null,
      memory: null,
      passed: false,
    };
  }

  console.log("Sending code to JDoodle", {
    language,
    jdoodleLanguage: mapping.language,
    versionIndex: mapping.versionIndex,
    sourceCodeLength: sourceCode.length,
    inputSize: String(testCase.input || "").length,
  });

  const payload = {
    clientId: process.env.JDOODLE_CLIENT_ID,
    clientSecret: process.env.JDOODLE_CLIENT_SECRET,
    script: sourceCode,
    stdin: testCase.input || "",
    language: mapping.language,
    versionIndex: mapping.versionIndex,
    compileOnly: false,
  };

  let response;
  try {
    response = await axios.post(JDOODLE_URL, payload, {
      timeout: JDOODLE_TIMEOUT_MS,
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error("JDoodle request failed", {
      status,
      data,
      message: error.message,
    });

    if (status === 401 || status === 403) {
      throw new Error("JDoodle authentication failed");
    }

    if (status === 429) {
      throw new Error("JDoodle quota exceeded");
    }

    throw new Error("JDoodle API request failed");
  }

  console.log("JDoodle response received", {
    statusCode: response.data?.statusCode,
    compilationStatus: response.data?.compilationStatus,
    outputLength: String(response.data?.output || "").length,
  });

  const result = response.data || {};

  // JDoodle returns compilationStatus as a number (0 = success, non-zero = compile error).
  // When there is a compilation error, JDoodle puts the error text in result.output.
  // When execution succeeds, result.output is the program's stdout.
  const compilationStatus = String(result.compilationStatus ?? "0");
  const isCompileError = compilationStatus !== "0";

  const stdout = isCompileError ? "" : (result.output || "");
  const stderr = isCompileError
    ? (result.output || `Compilation error (status: ${compilationStatus})`)
    : "";

  const expected = testCase.expectedOutput || "";
  const normalizedActual = normalizeOutput(stdout);
  const normalizedExpected = normalizeOutput(expected);
  // Only mark as passed when there is an expected value to compare against
  const passed = expected !== "" ? normalizedActual === normalizedExpected : false;

  console.log("Execution result", {
    isCompileError,
    stdoutLength: stdout.length,
    stderrLength: stderr.length,
    expectedOutput: expected ? normalizedExpected : "(none)",
    actualOutput: normalizedActual || "(empty)",
    passed,
  });

  return {
    statusCode: result.statusCode,
    compilationStatus,
    stdout,
    stderr,
    time: result.cpuTime ? Number(result.cpuTime) : null,
    memory: parseMemory(result.memory),
    passed,
  };
};

const mapVerdict = ({ statusCode, compilationStatus, time, passed }) => {
  if (compilationStatus !== "0") {
    console.warn("Compilation failed", { compilationStatus });
    return "Compilation Error";
  }

  if (time !== null && time > CPU_TIME_LIMIT) {
    return "Time Limit Exceeded";
  }

  if (statusCode && statusCode !== 200) {
    console.warn("Runtime failed", { statusCode });
    return "Runtime Error";
  }

  if (passed) {
    return "Accepted";
  }

  return "Wrong Answer";
};

const executeAgainstTests = async ({ sourceCode, language, testCases }) => {
  const results = [];

  for (const testCase of testCases) {
    const result = await runSubmission({ sourceCode, language, testCase });
    results.push(result);

    const verdict = mapVerdict(result);
    console.log("Verdict generated", { verdict });

    if (verdict !== "Accepted") {
      return { results, verdict };
    }
  }

  return { results, verdict: "Accepted" };
};

const executeRun = async ({ sourceCode, language, input }) => {
  const result = await runSubmission({
    sourceCode,
    language,
    testCase: { input: input || "", expectedOutput: "" },
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    runtime: result.time ? Math.round(result.time * 1000) : null,
    memory: result.memory,
  };
};

module.exports = {
  executeAgainstTests,
  mapVerdict,
  executeRun,
};
