import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

const Input = ({ label, ...props }: InputProps) => {
  return (
    <label className="flex flex-col gap-2 text-xs font-medium text-ink/70">
      {label}
      <input
        {...props}
        className="rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
      />
    </label>
  );
};

export default Input;
