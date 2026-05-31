import { motion } from "framer-motion";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-dashed border-ink/15 bg-white/40 px-6 py-10 text-center"
    >
      {icon ? (
        <div className="mb-3 flex justify-center text-ink/20">{icon}</div>
      ) : (
        <div className="mb-3 flex justify-center">
          <svg
            className="h-8 w-8 text-ink/15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M9 9h6M9 12h4" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 text-xs text-ink/50 max-w-xs mx-auto leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </motion.div>
  );
};

export default EmptyState;
