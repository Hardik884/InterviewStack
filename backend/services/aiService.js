const { GoogleGenerativeAI } = require("@google/generative-ai");

const sanitizeInput = (text, maxLength = 12000) => {
  if (!text) {
    return "";
  }

  const cleaned = text.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return cleaned.slice(0, maxLength);
};

const buildResumePrompt = (resumeText) => {
  return [
    "You are an ATS-focused resume analyzer.",
    "Return ONLY valid JSON with keys:",
    "atsScore (number 0-100),",
    "strengths (array of strings),",
    "weaknesses (array of strings),",
    "missingKeywords (array of strings),",
    "improvementSuggestions (array of strings),",
    "interviewReadiness (string).",
    "No markdown, no extra text.",
    "Resume text:",
    resumeText,
  ].join("\n");
};

const parseAiJson = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw new Error("AI response is not valid JSON");
  }
};

const analyzeResume = async (resumeText) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const sanitized = sanitizeInput(resumeText);
  const prompt = buildResumePrompt(sanitized);

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  return parseAiJson(responseText);
};

module.exports = {
  analyzeResume,
  sanitizeInput,
  buildResumePrompt,
};
