const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const { getCache, setCache } = require("../services/cacheService");

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `analytics:dashboard:${userId}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const totalSubmissionsPromise = Submission.countDocuments({ userId });

    const solvedCountPromise = Submission.aggregate([
      { $match: { userId: req.user._id, verdict: "Accepted" } },
      { $group: { _id: "$problemId" } },
      { $count: "total" },
    ]);

    const difficultyPromise = Submission.aggregate([
      { $match: { userId: req.user._id, verdict: "Accepted" } },
      { $group: { _id: "$problemId" } },
      {
        $lookup: {
          from: "problems",
          localField: "_id",
          foreignField: "_id",
          as: "problem",
        },
      },
      { $unwind: "$problem" },
      { $group: { _id: "$problem.difficulty", count: { $sum: 1 } } },
    ]);

    const verdictStatsPromise = Submission.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: "$verdict", count: { $sum: 1 } } },
    ]);

    const recentActivityPromise = Submission.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("problemId verdict language runtime createdAt")
      .populate("problemId", "title difficulty");

    const [totalSubmissions, solvedCount, difficultyStats, verdictStats, recentActivity] =
      await Promise.all([
        totalSubmissionsPromise,
        solvedCountPromise,
        difficultyPromise,
        verdictStatsPromise,
        recentActivityPromise,
      ]);

    const response = {
      totalSubmissions,
      totalSolved: solvedCount[0]?.total || 0,
      solvedByDifficulty: difficultyStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      submissionStats: verdictStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentActivity,
    };

    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const cacheKey = `analytics:leaderboard:${limit}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const leaderboard = await Submission.aggregate([
      { $match: { verdict: "Accepted" } },
      { $group: { _id: "$userId", solvedProblems: { $addToSet: "$problemId" } } },
      { $project: { solvedCount: { $size: "$solvedProblems" } } },
      { $sort: { solvedCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$user._id", name: "$user.name", email: "$user.email", solvedCount: 1 } },
    ]);

    const response = {
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    };

    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const getActivity = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `analytics:activity:${userId}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const submissions = await Submission.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(15)
      .select("problemId verdict language runtime createdAt")
      .populate("problemId", "title difficulty");

    const response = { submissions };
    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  getLeaderboard,
  getActivity,
};
