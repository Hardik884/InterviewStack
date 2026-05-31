import { motion } from "framer-motion";
import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  accent?: boolean;
  index?: number;
};

const StatCard = ({ title, value, subtitle, accent = false, index = 0 }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={`rounded-3xl border p-5 shadow-soft transition-shadow hover:shadow-md ${
        accent
          ? "border-accent/20 bg-accent/5"
          : "border-ink/8 bg-white/95"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/40">
        {title}
      </p>
      <div className={`mt-2.5 text-2xl font-bold tracking-tight ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </div>
      {subtitle ? (
        <p className="mt-1.5 text-xs text-ink/50">{subtitle}</p>
      ) : null}
    </motion.div>
  );
};

export default StatCard;
