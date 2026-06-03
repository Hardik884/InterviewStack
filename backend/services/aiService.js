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

module.exports = {
  analyzeResume,
  sanitizeInput,
  buildResumePrompt,
};
