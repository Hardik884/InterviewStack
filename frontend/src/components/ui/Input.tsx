import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

const Input = ({ label, error, hint, id, className, ...props }: InputProps) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold text-ink/60 tracking-wide"
      >
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={cn(
          "rounded-2xl border bg-white px-4 py-2.5 text-sm text-ink shadow-sm",
          "placeholder:text-ink/30",
          "transition-all duration-150",
          "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
            : "border-ink/15 hover:border-ink/25",
          className
        )}
      />
      {error ? (
        <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink/40">{hint}</p>
      ) : null}
    </div>
  );
};

export default Input;
