import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Pagination from "../components/ui/Pagination";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";
import ProblemRow from "../components/ProblemRow";
import ProblemRowSkeleton from "../components/ProblemRowSkeleton";
import { useProblems } from "../hooks/useProblems";
import { useDebounce } from "../hooks/useDebounce";

const Problems = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState("");
  const [tags, setTags] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const debouncedSearch = useDebounce(search, 400);

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

  const handleStartInterview = (problem) => {
    const roomId = `room-${Math.random().toString(36).slice(2, 8)}`;
    navigate(`/interview/${roomId}/${problem._id}`);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Problem library"
        subtitle="Curated problem sets with real interview patterns."
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <Input
            label="Search"
            placeholder="Search by title or concept"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input
            label="Difficulty"
            placeholder="easy, medium, hard"
            value={difficulty}
            onChange={(event) => {
              setPage(1);
              setDifficulty(event.target.value);
            }}
          />
          <Input
            label="Tags"
            placeholder="arrays, dp, strings"
            value={tags}
            onChange={(event) => {
              setPage(1);
              setTags(event.target.value);
            }}
          />
          <label className="flex flex-col gap-2 text-xs font-medium text-ink/70">
            Sort by
            <select
              className="rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Newest</option>
              <option value="title">Title</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </label>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProblemRowSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Failed to load problems"
          description="Check your connection and try again."
          action={
            <button
              type="button"
              className="rounded-full border border-ink/20 px-3 py-1 text-xs text-ink"
              onClick={() => refetch()}
            >
              Retry
            </button>
          }
        />
      ) : !problems.length ? (
        <EmptyState
          title="No problems match"
          description="Try adjusting filters or search keywords."
        />
      ) : (
        <div className="space-y-3">
          {problems.map((problem) => (
            <div
              key={problem._id}
              onClick={() => navigate(`/problems/${problem.slug || problem._id}`)}
              role="button"
              tabIndex={0}
              aria-label={`Open problem ${problem.title}`}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  navigate(`/problems/${problem.slug || problem._id}`);
                }
              }}
            >
              <ProblemRow problem={problem} onStart={handleStartInterview} />
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={data?.page || page}
        totalPages={data?.totalPages || 1}
        onPrev={() => setPage((prev) => Math.max(prev - 1, 1))}
        onNext={() => setPage((prev) => Math.min(prev + 1, data?.totalPages || prev))}
      />
    </div>
  );
};

export default Problems;
