import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import type { ReactNode } from "react";

const features = [
  { icon: "⚡", label: "Live coding rooms" },
  { icon: "📊", label: "Performance analytics" },
  { icon: "🤖", label: "AI resume insights" },
  { icon: "🎯", label: "Curated problem sets" },
];

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-sand text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-ink" aria-label="InterviewStack home">
            <Logo size={28} />
            <span className="text-[15px] font-semibold tracking-tight">InterviewStack</span>
          </Link>
          <span className="text-xs uppercase tracking-[0.25em] text-ink/40 hidden sm:block">
            AI Prep Suite
          </span>
        </div>

        {/* Main content */}
        <div className="mt-8 grid flex-1 gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">

          {/* Left — hero copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-3xl border border-ink/10 bg-white/70 p-8 shadow-soft"
          >
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Build confidence with{" "}
              <span className="text-accent">structured practice</span>
            </h1>
            <p className="mt-4 text-sm text-ink/60 leading-relaxed">
              Analytics, problem sets, collaborative rooms, and AI resume
              insights — all in one platform.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {features.map((feature) => (
                <motion.div
                  key={feature.label}
                  className="flex items-center gap-2 rounded-2xl border border-ink/8 bg-white/60 px-3 py-2.5"
                  whileHover={{ scale: 1.02, borderColor: "rgba(28,26,34,0.2)" }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="text-base">{feature.icon}</span>
                  <span className="text-xs font-medium text-ink/70">{feature.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — auth form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
            className="rounded-3xl border border-ink/10 bg-white/95 p-8 shadow-soft"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
