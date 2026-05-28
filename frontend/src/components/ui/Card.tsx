import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

const Card = ({ title, subtitle, children }: CardProps) => {
  return (
    <div className="rounded-3xl border border-ink/10 bg-white/90 p-5 shadow-soft">
      {title ? (
        <div className="mb-3">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {subtitle ? (
            <p className="text-xs text-ink/60">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

export default Card;
