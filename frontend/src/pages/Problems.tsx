import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Pagination from "../components/ui/Pagination";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import ProblemRow from "../components/ProblemRow";
import ProblemRowSkeleton from "../components/ProblemRowSkeleton";
import { useProblems } from "../hooks/useProblems";
import { useDebounce } from "../hooks/useDebounce";

const DIFFICULTIES = ["", "easy", "medium", "hard"];
const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "title", label: "Title A–Z" },
  { value: "difficulty", label: "Difficulty" },
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

const Problems = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState("");
  const [tags, setTags] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const debouncedSearch = useDebounce(search, 350);

  const params = useMemo(
    () => ({
      page,
      limit: 10,
      difficulty: difficulty || undefined,
      tags: tags || undefined,
      search: debouncedSearch || undefined,
      sort,
    }),
    [page, difficulty, tags, debouncedSearch, sort]
  );

  const { data, isLoading, isError, refetch } = useProblems(params);
  const problems = data?.problems || [];

  const handleStartInterview = (problem: { _id: string }) => {
    const roomId = `room-${Math.random().toString(36).slice(2, 8)}`;
    navigate(`/interview/${roomId}/${problem._id}`);
  };

  const resetFilters = () => {
    setSearch("");
    setDifficulty("");
    setTags("");
    setSort("recent");
    setPage(1);
  };

  const hasFilters = search || difficulty || tags;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Problem library"
        subtitle="Curated problem sets with real interview patterns."
        action={
          <span className="text-xs text-ink/40 font-medium">
            {data?.total ? `${data.total} problems` : ""}
          </span>
        }
      />

      {/* Filters */}
      <Card animate={false}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <Input
            label="Search"
            placeholder="Search by title or concept"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink/60 tracking-wide">Difficulty</label>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d || "all"}
                  type="button"
                  onClick={() => { setDifficulty(d); setPage(1); }}
                  className={`flex-1 rounded-full border px-2.5 py-2 text-xs font-medium capitalize transition-colors ${
                    difficulty === d
                      ? "border-ink bg-ink text-white"
                      : "border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {d || "All"}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Tags"
            placeholder="arrays, dp, trees…"
            value={tags}
            onChange={(e) => { setTags(e.target.value); setPage(1); }}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink/60 tracking-wide">Sort by</label>
            <select
              className="rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10 hover:border-ink/25 transition-all"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort problems"
            >
              {SORTS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 text-xs text-ink/50 hover:text-accent transition-colors"
          >
            × Clear filters
          </button>
        )}
      </Card>

      {/* Problem list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProblemRowSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Failed to load problems"
          description="Check your connection and try again."
          action={
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : !problems.length ? (
        <EmptyState
          title="No problems match"
          description="Try adjusting your filters or search terms."
          action={
            hasFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {problems.map((problem) => (
            <motion.div
              key={problem._id}
              variants={fadeUp}
              onClick={() => navigate(`/problems/${problem.slug || problem._id}`)}
              role="button"
              tabIndex={0}
              aria-label={`Open problem: ${problem.title}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate(`/problems/${problem.slug || problem._id}`);
                }
              }}
              className="cursor-pointer"
            >
              <ProblemRow problem={problem} onStart={handleStartInterview} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <Pagination
        page={data?.page || page}
        totalPages={data?.totalPages || 1}
        onPrev={() => setPage((p) => Math.max(p - 1, 1))}
        onNext={() => setPage((p) => Math.min(p + 1, data?.totalPages || p))}
      />
    </div>
  );
};

export default Problems;
