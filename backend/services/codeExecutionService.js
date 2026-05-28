const axios = require("axios");

const JUDGE0_URL =
  process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "";
const JUDGE0_TIMEOUT_MS = Number(process.env.JUDGE0_TIMEOUT_MS || 10000);
const CPU_TIME_LIMIT = Number(process.env.JUDGE0_CPU_TIME_LIMIT || 2);
const WALL_TIME_LIMIT = Number(process.env.JUDGE0_WALL_TIME_LIMIT || 5);

const languageMap = {
  javascript: 63,
  python: 71,
  cpp: 54,
  java: 62,
};

const buildHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
  }
  if (JUDGE0_API_HOST) {
    headers["X-RapidAPI-Host"] = JUDGE0_API_HOST;
  }
  return headers;
};

const normalizeOutput = (value) => String(value || "").trim();

const runSubmission = async ({ sourceCode, language, testCase }) => {
  const languageId = languageMap[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  console.log("Sending to Judge0", {
    language,
    inputSize: String(testCase.input || "").length,
  });

  const payload = {
    source_code: sourceCode,
    language_id: languageId,
    stdin: testCase.input || "",
    expected_output: testCase.expectedOutput || "",
    cpu_time_limit: CPU_TIME_LIMIT,
    wall_time_limit: WALL_TIME_LIMIT,
  };

  let response;
  try {
    response = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      payload,
      { headers: buildHeaders(), timeout: JUDGE0_TIMEOUT_MS }
    );
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error("Judge0 request failed", {
      status,
      data,
      message: error.message,
    });
    throw error;
  }

  console.log("Judge0 response received", {
    status: response.data?.status?.description,
  });

  const result = response.data || {};
  return {
    statusId: result.status?.id,
    statusDescription: result.status?.description,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    compileOutput: result.compile_output || "",
    time: result.time ? Number(result.time) : null,
    memory: result.memory ? Number(result.memory) : null,
    passed:
      normalizeOutput(result.stdout) ===
      normalizeOutput(testCase.expectedOutput || ""),
  };
};

const mapVerdict = (statusId, passed) => {
  if (statusId === 6) {
    return "Compilation Error";
  }

  if (statusId === 5) {
    return "Time Limit Exceeded";
  }

  if (statusId === 7 || statusId === 8 || statusId === 9) {
    return "Runtime Error";
  }

  if (statusId === 3 && passed) {
    return "Accepted";
  }

  return "Wrong Answer";
};

const executeAgainstTests = async ({ sourceCode, language, testCases }) => {
  const results = [];

  for (const testCase of testCases) {
    const result = await runSubmission({ sourceCode, language, testCase });
    results.push(result);

    if (result.statusId !== 3 || !result.passed) {
      return { results, verdict: mapVerdict(result.statusId, result.passed) };
    }
  }

  return { results, verdict: "Accepted" };
};

module.exports = {
  executeAgainstTests,
  mapVerdict,
};
