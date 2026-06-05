import type { ReactNode } from "react";

const StatusPill = ({ label }: { label: ReactNode }) => {
  return (
    <span className="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-1 text-xs text-ink/70">
      {label}
    </span>
  );
};

export default StatusPill;
