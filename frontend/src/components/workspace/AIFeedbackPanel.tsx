import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AiFeedback } from "../../hooks/useSubmissionFeedback";

type Props = {
  feedback: AiFeedback | null | undefined;
  isLoading?: boolean;
  role?: "interviewer" | "candidate";
};

const ScoreBadge = ({ score }: { score: number | null }) => {
  if (score === null) return null;
  const color =
    score >= 8
      ? "from-emerald-500 to-teal-400"
      : score >= 6
      ? "from-blue-500 to-indigo-400"
      : score >= 4
      ? "from-amber-500 to-orange-400"
      : "from-rose-500 to-red-400";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-lg`}
      >
        <span className="text-xl font-bold text-white">{score}</span>
        <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-[9px] font-bold text-ink/60 shadow">
          /10
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold text-ink">Overall Rating</p>
        <p className="text-[11px] text-ink/50">
          {score >= 8
            ? "Excellent"
            : score >= 6
            ? "Good"
            : score >= 4
            ? "Needs Improvement"
            : "Needs Significant Work"}
        </p>
      </div>
    </div>
  );
};

const Section = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div>
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">{label}</p>
    {children}
  </div>
);


const BulletList = ({
  items,
  variant = "neutral",
}: {
  items: string[];
  variant?: "success" | "danger" | "neutral" | "suggestion";
}) => {
  const dot =
    variant === "success"
      ? "bg-emerald-500"
      : variant === "danger"
      ? "bg-rose-500"
      : variant === "suggestion"
      ? "bg-blue-500"
      : "bg-ink/30";

  const textColor =
    variant === "success"
      ? "text-emerald-700"
      : variant === "danger"
      ? "text-rose-700"
      : variant === "suggestion"
      ? "text-blue-700"
      : "text-ink/70";

  if (!items?.length) return <p className="text-xs text-ink/40 italic">None noted.</p>;

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
          <span className={`text-xs leading-relaxed ${textColor}`}>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const ComplexityPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-ink/8 bg-ink/3 px-3 py-2.5">
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/40">{label}</p>
    <p className="mt-0.5 text-xs font-medium text-ink/80">{value || "—"}</p>
  </div>
);

const AIFeedbackPanel = ({ feedback, isLoading, role = "candidate" }: Props) => {
  // Loading / generating state
  if (isLoading || feedback?.status === "pending" || feedback?.status === "generating") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 flex-shrink-0">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-700">Generating AI Feedback…</p>
            <p className="text-xs text-indigo-500/70">
              Gemini is analyzing your solution. This takes a few seconds.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Unavailable / failed state
  if (!feedback || feedback.status === "unavailable" || feedback.status === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-ink/8 bg-ink/2 p-5"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-sm font-semibold text-ink/60">AI Feedback Unavailable</p>
            <p className="text-xs text-ink/40">
              Could not generate feedback for this submission. Your submission result is unaffected.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Null (no feedback yet for older submissions)
  if (feedback.status !== "completed") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <p className="text-sm font-bold text-ink">AI Interview Feedback</p>
            </div>
            {feedback.generatedAt && (
              <p className="text-[10px] text-ink/40">
                {new Date(feedback.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          <ScoreBadge score={feedback.score} />

          {/* Problem Solving + Code Quality */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink/8 bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">
                Problem Solving
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/70">
                {feedback.problemSolving || "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/8 bg-white/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">
                Code Quality
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/70">
                {feedback.codeQuality || "—"}
              </p>
            </div>
          </div>

          {/* Complexity */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ComplexityPill label="Time Complexity" value={feedback.timeComplexity} />
            <ComplexityPill label="Space Complexity" value={feedback.spaceComplexity} />
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
            <Section label="✅ Strengths">
              <BulletList items={feedback.strengths} variant="success" />
            </Section>
          </div>
          <div className="rounded-3xl border border-rose-100 bg-rose-50/60 p-4">
            <Section label="⚠️ Weaknesses">
              <BulletList items={feedback.weaknesses} variant="danger" />
            </Section>
          </div>
        </div>

        {/* Optimization Suggestions */}
        {feedback.optimizationSuggestions?.length > 0 && (
          <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-4">
            <Section label="💡 Optimization Suggestions">
              <BulletList items={feedback.optimizationSuggestions} variant="suggestion" />
            </Section>
          </div>
        )}

        {/* Interviewer Notes — only shown to interviewer role */}
        {role === "interviewer" && feedback.interviewerNotes && (
          <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
            <Section label="🔒 Interviewer Notes (Private)">
              <p className="text-xs leading-relaxed text-amber-800/80">
                {feedback.interviewerNotes}
              </p>
            </Section>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AIFeedbackPanel;
