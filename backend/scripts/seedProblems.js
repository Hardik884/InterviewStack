const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Problem = require("../models/Problem");
const User = require("../models/User");
const { getProblems } = require("../src/seeds/problems");

require("dotenv").config();

const resolveSeedUser = async () => {
  const email = process.env.SEED_USER_EMAIL || "seed@interviewstack.local";
  const password = process.env.SEED_USER_PASSWORD || "SeedPass123!";

  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }
    return user;
  }

  const hashed = await bcrypt.hash(password, 10);
  user = await User.create({
    name: "Seed Bot",
    email,
    password: hashed,
    role: "admin",
  });

  return user;
};

const seedProblems = async () => {
  const mode = process.env.SEED_MODE || "reset";
  const seedUser = await resolveSeedUser();
  const problems = getProblems().map((problem) => ({
    ...problem,
    createdBy: seedUser._id,
  }));

  if (mode === "upsert") {
    const ops = problems.map((problem) => ({
      updateOne: {
        filter: { slug: problem.slug },
        update: problem,
        upsert: true,
      },
    }));

    const result = await Problem.bulkWrite(ops);
    console.log("Seed mode: upsert");
    console.log(`Upserted: ${result.upsertedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    return;
  }

  const deleteResult = await Problem.deleteMany({});
  const insertResult = await Problem.insertMany(problems);

  console.log("Seed mode: reset");
  console.log(`Deleted: ${deleteResult.deletedCount}`);
  console.log(`Inserted: ${insertResult.length}`);
};

const run = async () => {
  try {
    await connectDB();
    await seedProblems();
  } catch (error) {
    console.error("Problem seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
