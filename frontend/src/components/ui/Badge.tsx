import { motion } from "framer-motion";
import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
};

const variantStyles = {
  default: "border-ink/10 bg-ink/5 text-ink/70",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const Badge = ({ children, variant = "default" }: BadgeProps) => {
  return (
    <motion.span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.span>
  );
};

export default Badge;
