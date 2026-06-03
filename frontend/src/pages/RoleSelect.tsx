/**
 * RoleSelect.tsx — Pre-join role selection screen.
 *
 * Uses the existing InterviewStack design system (sand/ink/accent palette,
 * Space Grotesk, existing Card/Button component patterns).
 *
 * Flow: /join/:roomId → select role → /lobby/:roomId
 */

import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

type Role = "interviewer" | "candidate";

const roles: {
  id: Role;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  accentClass: string;
  ringClass: string;
}[] = [
  {
    id: "interviewer",
    label: "Interviewer",
    subtitle: "Conduct the session",
    description:
      "Select problems, manage the room, view all submissions, and guide the candidate.",
    icon: "🎯",
    accentClass: "text-navy",
    ringClass: "ring-navy",
  },
  {
    id: "candidate",
    label: "Candidate",
    subtitle: "Solve the problem",
    description:
      "Write and submit code in real-time. Collaborate on the editor with full CRDT sync.",
    icon: "💻",
    accentClass: "text-accent",
    ringClass: "ring-accent",
  },
];

const RoleSelect = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth() as { user?: { name?: string } | null };
  const [selected, setSelected] = useState<Role | null>(null);

  // Preserve problemId passed from ProblemDetails or workspace redirect
  const problemId = (location.state as { problemId?: string } | null)?.problemId;

  const handleContinue = () => {
    if (!selected || !roomId) return;
    sessionStorage.setItem(`room:${roomId}:role`, selected);
    // Store problemId so lobby/workspace can retrieve it
    if (problemId) {
      sessionStorage.setItem(`room:${roomId}:problemId`, problemId);
    }
    navigate(`/lobby/${roomId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 10%, rgba(255,106,61,0.07), transparent 45%), radial-gradient(circle at 80% 0%, rgba(29,78,137,0.07), transparent 40%), linear-gradient(180deg, rgba(246,244,239,0.95), rgba(238,233,226,0.95))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          {/* Brand mark */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-5 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-1.5 text-xs font-semibold text-ink/60 shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Room&nbsp;
              <code className="font-mono text-ink/80">{roomId}</code>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight text-ink"
          >
            Join as…
          </motion.h1>

          {user?.name && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-2 text-sm text-ink/50"
            >
              Welcome back,{" "}
              <span className="font-semibold text-ink/80">{user.name}</span>
            </motion.p>
          )}
        </div>

        {/* Role cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role, i) => {
            const isSelected = selected === role.id;
            return (
              <motion.button
                key={role.id}
                id={`role-${role.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, ease: "easeOut" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(role.id)}
                aria-pressed={isSelected}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? `border-ink/20 bg-white shadow-card ring-2 ${role.ringClass}`
                    : "border-ink/10 bg-white/70 hover:border-ink/20 hover:bg-white hover:shadow-soft"
                }`}
              >
                {/* Check badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-ink"
                    >
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>

                <span className="text-2xl">{role.icon}</span>

                <div>
                  <p className={`text-sm font-bold ${isSelected ? "text-ink" : "text-ink/80"}`}>
                    {role.label}
                  </p>
                  <p className={`mt-0.5 text-xs font-medium ${role.accentClass} opacity-80`}>
                    {role.subtitle}
                  </p>
                </div>

                <p className="text-xs leading-relaxed text-ink/50">
                  {role.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5"
        >
          <motion.button
            id="btn-continue"
            whileHover={selected ? { scale: 1.01 } : {}}
            whileTap={selected ? { scale: 0.99 } : {}}
            onClick={handleContinue}
            disabled={!selected}
            className={`w-full rounded-2xl py-3.5 text-sm font-bold tracking-wide transition-all duration-200 ${
              selected
                ? "bg-ink text-white shadow-soft hover:bg-ink/85 active:bg-ink"
                : "cursor-not-allowed bg-ink/8 text-ink/30"
            }`}
          >
            {selected
              ? `Continue as ${roles.find((r) => r.id === selected)?.label} →`
              : "Select a role to continue"}
          </motion.button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-4 text-center text-xs text-ink/30"
        >
          Your role is saved for this session only.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default RoleSelect;
