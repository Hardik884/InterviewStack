const fs = require("fs/promises");
const pdfParse = require("pdf-parse");

const parsePdfResume = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  return (data.text || "").trim();
};

module.exports = {
  parsePdfResume,
};
