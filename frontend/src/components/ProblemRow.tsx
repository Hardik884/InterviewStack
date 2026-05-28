import DifficultyBadge from "./DifficultyBadge";
import StatusPill from "./StatusPill";
import TagChip from "./TagChip";

type ProblemRowProps = {
  problem: {
    _id: string;
    title: string;
    description: string;
    difficulty: string;
    tags?: string[];
    createdAt: string;
  };
  onStart: (problem) => void;
};

const ProblemRow = ({ problem, onStart }: ProblemRowProps) => {
  return (
    <div className="rounded-3xl border border-ink/10 bg-white/90 p-4 shadow-soft transition hover:border-ink/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-ink">{problem.title}</p>
          <p className="mt-1 text-xs text-ink/60">
            {problem.description?.slice(0, 140)}...
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(problem.tags || []).map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink/60">
            <span>Acceptance: 42%</span>
            <span>Added {new Date(problem.createdAt).toLocaleDateString()}</span>
            <div className="flex gap-2">
              <TagChip label="Amazon" />
              <TagChip label="Google" />
            </div>
          </div>
          <button
            type="button"
            className="mt-4 rounded-full border border-ink/20 px-3 py-1 text-xs text-ink hover:bg-ink/5"
            onClick={() => onStart(problem)}
          >
            Start interview session
          </button>
        </div>
        <div className="flex items-center gap-2">
          <DifficultyBadge value={problem.difficulty} />
          <StatusPill label="Unattempted" />
        </div>
      </div>
    </div>
  );
};

export default ProblemRow;
