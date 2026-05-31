import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md";
  isLoading?: boolean;
};

const Button = ({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  const styles = {
    primary:
      "bg-ink text-white hover:bg-ink/85 focus-visible:outline-ink shadow-sm",
    ghost:
      "border border-ink/20 text-ink hover:bg-ink/5 hover:border-ink/30",
    accent:
      "bg-accent text-white hover:bg-accent/85 focus-visible:outline-accent shadow-sm",
    danger:
      "border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300",
  };

  return (
    <motion.button
      type={type}
      className={`${base} ${sizes[size]} ${styles[variant]}`}
      disabled={disabled || isLoading}
      whileHover={disabled || isLoading ? {} : { scale: 1.02 }}
      whileTap={disabled || isLoading ? {} : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      {...(props as Record<string, unknown>)}
    >
      {isLoading ? (
        <>
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;
