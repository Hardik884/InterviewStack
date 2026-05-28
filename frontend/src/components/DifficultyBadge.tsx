import { cn } from "../utils/cn";

const DifficultyBadge = ({ value }) => {
  const styles = {
    easy: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    hard: "bg-rose-100 text-rose-700",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        styles[value] || "bg-ink/10 text-ink"
      )}
    >
      {value || "unknown"}
    </span>
  );
};

export default DifficultyBadge;
