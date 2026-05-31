import { motion } from "framer-motion";
import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  animate?: boolean;
};

const Card = ({ title, subtitle, children, className = "", animate = true }: CardProps) => {
  const inner = (
    <div
      className={`rounded-3xl border border-ink/8 bg-white/95 p-5 shadow-soft ${className}`}
    >
      {title ? (
        <div className="mb-4">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );

  if (!animate) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {inner}
    </motion.div>
  );
};

export default Card;
