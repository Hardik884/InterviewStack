const Problem = require("../models/Problem");
const {
  getCache,
  setCache,
  delCache,
  delCacheByPattern,
} = require("../services/cacheService");

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

const ensureUniqueSlug = async (title) => {
  const base = slugify(title) || "problem";
  let slug = base;
  let counter = 1;

  while (await Problem.findOne({ slug })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }

  return slug;
};

const createProblem = async (req, res, next) => {
  try {
    const {
      title,
      description,
      difficulty,
      tags,
      categories,
      examples,
      constraints,
      starterCode,
      acceptanceRate,
      companyTags,
      hints,
      editorialSummary,
      estimatedFrequency,
      relatedTopics,
      testCases,
    } = req.body;

    const slug = await ensureUniqueSlug(title);

    const problem = await Problem.create({
      title,
      slug,
      description,
      difficulty,
      tags,
      categories,
      examples,
      constraints,
      starterCode,
      acceptanceRate,
      companyTags,
      hints,
      editorialSummary,
      estimatedFrequency,
      relatedTopics,
      testCases,
      createdBy: req.user._id,
    });

    await delCacheByPattern("problems:list:*");

    return res.status(201).json({
      message: "Problem created successfully",
      problem,
    });
  } catch (error) {
    return next(error);
  }
};

const getProblems = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : "";
    const sort = req.query.sort || "recent";

    const filter = {};
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    if (req.query.tags) {
      const tags = req.query.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
      if (tags.length > 0) {
        filter.tags = { $in: tags };
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ];
    }

    const sortMap = {
      recent: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
      difficulty: { difficulty: 1, createdAt: -1 },
    };

    const sortBy = sortMap[sort] || sortMap.recent;

    const tagsKey = req.query.tags ? req.query.tags : "all";
    const difficultyKey = req.query.difficulty || "all";
    const searchKey = search || "none";
    const cacheKey = `problems:list:${page}:${limit}:${difficultyKey}:${tagsKey}:${searchKey}:${sort}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .select("title slug description difficulty tags createdAt"),
      Problem.countDocuments(filter),
    ]);

    const response = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      problems,
    };

    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const getProblemById = async (req, res, next) => {
  try {
    const cacheKey = `problems:detail:${req.params.id}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const problem = await Problem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const response = { problem };
    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const getProblemBySlug = async (req, res, next) => {
  try {
    const cacheKey = `problems:slug:${req.params.slug}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json(cached);
    }

    const problem = await Problem.findOne({ slug: req.params.slug });

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    const response = { problem };
    await setCache(cacheKey, response);

    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const updateProblemById = async (req, res, next) => {
  try {
    const allowedFields = [
      "title",
      "description",
      "difficulty",
      "tags",
      "categories",
      "examples",
      "constraints",
      "starterCode",
      "acceptanceRate",
      "companyTags",
      "hints",
      "editorialSummary",
      "estimatedFrequency",
      "relatedTopics",
      "testCases",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.title) {
      updates.slug = await ensureUniqueSlug(updates.title);
    }

    const problem = await Problem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    await delCache(`problems:detail:${req.params.id}`);
    await delCache(`problems:slug:${problem.slug}`);
    await delCacheByPattern("problems:list:*");

    return res.status(200).json({
      message: "Problem updated successfully",
      problem,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteProblemById = async (req, res, next) => {
  try {
    const problem = await Problem.findByIdAndDelete(req.params.id);

    if (!problem) {
      return res.status(404).json({ message: "Problem not found" });
    }

    await delCache(`problems:detail:${req.params.id}`);
    await delCache(`problems:slug:${problem.slug}`);
    await delCacheByPattern("problems:list:*");

    return res.status(200).json({ message: "Problem deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProblem,
  getProblems,
  getProblemById,
  getProblemBySlug,
  updateProblemById,
  deleteProblemById,
};
