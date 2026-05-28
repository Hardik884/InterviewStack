import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "ghost" | "accent";
};

const Button = ({
  children,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const styles = {
    primary: "bg-ink text-white hover:bg-ink/90 focus-visible:outline-ink",
    ghost: "border border-ink/20 text-ink hover:bg-ink/5",
    accent: "bg-accent text-white hover:bg-accent/90 focus-visible:outline-accent",
  };

  return (
    <button type={type} className={`${base} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
