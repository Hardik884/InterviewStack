const { GoogleGenerativeAI } = require("@google/generative-ai");

const sanitizeInput = (text, maxLength = 12000) => {
  if (!text) return "";
  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return cleaned.slice(0, maxLength);
};

const buildResumePrompt = (resumeText) => {
  return [
    "You are an ATS-focused resume analyzer.",
    "Return ONLY valid JSON — no markdown fences, no extra text.",
    "The JSON must have exactly these keys:",
    "  atsScore (integer 0-100),",
    "  strengths (array of strings),",
    "  weaknesses (array of strings),",
    "  missingKeywords (array of strings),",
    "  improvementSuggestions (array of strings),",
    "  interviewReadiness (string).",
    "",
    "Resume text:",
    resumeText,
  ].join("\n");
};

/** Strip markdown code fences that some Gemini versions add. */
const stripFences = (raw) =>
  raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

const parseAiJson = (rawText) => {
  const stripped = stripFences(rawText);
  try {
    return JSON.parse(stripped);
  } catch (_) {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) {}
    }
    throw new Error(`AI response is not valid JSON. Raw: ${rawText.slice(0, 200)}`);
  }
};

const analyzeResume = async (resumeText) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment");
  }

  console.log("[AI] Starting Gemini analysis...");

  const client = new GoogleGenerativeAI(apiKey);
  // gemini-3.1-flash-lite: latest stable model
  const model = client.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const sanitized = sanitizeInput(resumeText);
  if (!sanitized || sanitized.trim().length < 50) {
    throw new Error("Resume text is too short or empty to analyze");
  }

  const prompt = buildResumePrompt(sanitized);

  console.log(`[AI] Sending ${sanitized.length} chars to Gemini...`);
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  console.log("[AI] Gemini responded. Parsing JSON...");

  const parsed = parseAiJson(responseText);
  console.log("[AI] Analysis complete. ATS score:", parsed.atsScore);
  return parsed;
};

/**
 * Build interview feedback prompt for Gemini.
 * Keeps token usage low by being concise and structured.
 */
const buildFeedbackPrompt = ({ title, description, code, language, verdict, stdout, stderr }) => {
  const codeSnippet = sanitizeInput(code, 6000);
  const descSnippet = sanitizeInput(description, 1500);
  const stdoutSnippet = sanitizeInput(stdout, 500);
  const stderrSnippet = sanitizeInput(stderr, 500);

  return [
    "You are an expert software engineering interviewer.",
    "Analyze the candidate's solution and return ONLY valid JSON — no markdown fences, no extra text.",
    "",
    "The JSON must have EXACTLY these keys:",
    "  score          : integer 1-10 (overall rating)",
    "  problemSolving : string (1-2 sentences on their approach)",
    "  codeQuality    : string (1-2 sentences on readability/structure)",
    "  timeComplexity : string (e.g. 'O(n log n) — good use of sorting')",
    "  spaceComplexity: string (e.g. 'O(n) — auxiliary hash map')",
    "  strengths      : array of short strings (2-4 items)",
    "  weaknesses     : array of short strings (1-3 items)",
    "  optimizationSuggestions: array of short strings (1-3 items)",
    "  interviewerNotes: string (private note for the interviewer, 1-2 sentences)",
    "",
    `Problem: ${title}`,
    `Description: ${descSnippet}`,
    `Language: ${language}`,
    `Verdict: ${verdict}`,
    stdoutSnippet ? `Stdout: ${stdoutSnippet}` : "",
    stderrSnippet ? `Stderr/Error: ${stderrSnippet}` : "",
    "",
    "Candidate Code:",
    codeSnippet,
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * Generate structured interview feedback for a submission using Gemini.
 * Never throws — returns null on failure so the caller can handle gracefully.
 */
const generateInterviewFeedback = async ({
  title,
  description,
  code,
  language,
  verdict,
  stdout = "",
  stderr = "",
}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[AI Feedback] GEMINI_API_KEY not set");
    return null;
  }

  try {
    console.log("[AI Feedback] Building prompt...");
    const prompt = buildFeedbackPrompt({ title, description, code, language, verdict, stdout, stderr });

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    console.log(`[AI Feedback] Sending ${prompt.length} chars to Gemini...`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("[AI Feedback] Received response, parsing...");

    const parsed = parseAiJson(responseText);

    // Validate required fields
    const required = [
      "score", "problemSolving", "codeQuality", "timeComplexity",
      "spaceComplexity", "strengths", "weaknesses",
      "optimizationSuggestions", "interviewerNotes",
    ];
    for (const key of required) {
      if (parsed[key] === undefined) {
        console.warn(`[AI Feedback] Missing field: ${key}`);
      }
    }

    console.log("[AI Feedback] Feedback generated. Score:", parsed.score);
    return parsed;
  } catch (err) {
    console.error("[AI Feedback] Generation failed:", err.message);
    return null;
  }
};

module.exports = {
  analyzeResume,
  sanitizeInput,
  buildResumePrompt,
  generateInterviewFeedback,
};

