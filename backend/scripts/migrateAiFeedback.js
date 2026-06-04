require("dotenv").config();
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    const result = await mongoose.connection.collection("submissions").updateMany(
      { aiFeedback: null },
      {
        $set: {
          aiFeedback: {
            score: null,
            problemSolving: "",
            codeQuality: "",
            timeComplexity: "",
            spaceComplexity: "",
            strengths: [],
            weaknesses: [],
            optimizationSuggestions: [],
            interviewerNotes: "",
            generatedAt: null,
            status: "pending",
          },
        },
      }
    );
    console.log("[Migration] Backfilled", result.modifiedCount, "null aiFeedback documents");
    process.exit(0);
  })
  .catch((e) => {
    console.error("[Migration] Failed:", e.message);
    process.exit(1);
  });
