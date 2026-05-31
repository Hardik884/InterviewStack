import { motion } from "framer-motion";
import DifficultyBadge from "./DifficultyBadge";
import TagChip from "./TagChip";
import Button from "./ui/Button";

type ProblemRowProps = {
  problem: {
    _id: string;
    title: string;
    description: string;
    difficulty: string;
    tags?: string[];
    createdAt: string;
  };
  onStart: (problem: ProblemRowProps["problem"]) => void;
};

const ProblemRow = ({ problem, onStart }: ProblemRowProps) => {
  const preview = problem.description
    ? problem.description.length > 130
      ? `${problem.description.slice(0, 130)}…`
      : problem.description
    : "";

  return (
    <motion.div
      className="rounded-3xl border border-ink/8 bg-white/95 p-4 shadow-soft transition-shadow hover:shadow-md hover:border-ink/15"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">{problem.title}</p>
            <DifficultyBadge value={problem.difficulty} />
          </div>
          {preview && (
            <p className="mt-1.5 text-xs text-ink/55 leading-relaxed">{preview}</p>
          )}
          {problem.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {problem.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink/40">
            <span>Added {new Date(problem.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onStart(problem);
            }}
          >
            Start session
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProblemRow;
