const languageMap = {
  javascript: { language: "nodejs", versionIndex: "4" },
  python: { language: "python3", versionIndex: "5" },
  java: { language: "java", versionIndex: "5" },
  cpp: { language: "cpp17", versionIndex: "0" },
  "c++": { language: "cpp17", versionIndex: "0" },
};

const resolveJdoodleLanguage = (language) => languageMap[language];

module.exports = {
  languageMap,
  resolveJdoodleLanguage,
};
