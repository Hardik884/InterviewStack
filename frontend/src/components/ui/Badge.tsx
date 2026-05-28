import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
};

const Badge = ({ children }: BadgeProps) => {
  return (
    <span className="rounded-full border border-ink/10 bg-ink/5 px-2.5 py-1 text-xs text-ink/70">
      {children}
    </span>
  );
};

export default Badge;
