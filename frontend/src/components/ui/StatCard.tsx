import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
};

const StatCard = ({ title, value, subtitle }: StatCardProps) => {
  return (
    <div className="rounded-3xl border border-ink/10 bg-white/90 p-4 shadow-soft">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50">{title}</p>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {subtitle ? (
        <p className="mt-1 text-xs text-ink/60">{subtitle}</p>
      ) : null}
    </div>
  );
};

export default StatCard;
