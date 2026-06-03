/**
 * ResumeDetail.tsx — Full AI analysis results page.
 *
 * Handles: loading, processing (not yet done), completed, failed states.
 * Polls until completed.
 */

import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import { useResumeDetail } from "../hooks/useResumeDetail";

// ── Animated score ring ───────────────────────────────────────────────────────

const ScoreRing = ({ score }: { score: number }) => {
  const clamp = Math.min(100, Math.max(0, score));
  const color =
    clamp >= 75 ? "#10b981" : clamp >= 50 ? "#f59e0b" : "#ef4444";
  const dash = 2 * Math.PI * 44;
  const offset = dash - (clamp / 100) * dash;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r="44" fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <motion.circle
          cx="56" cy="56" r="44" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={dash}
          initial={{ strokeDashoffset: dash }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-2xl font-bold text-ink"
        >
          {clamp}
        </motion.p>
        <p className="text-[10px] text-ink/40">/ 100</p>
      </div>
    </div>
  );
};

// ── Processing skeleton ───────────────────────────────────────────────────────

const PulseSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-ink/5 ${className}`} />
);

// ── Main component ────────────────────────────────────────────────────────────

const ResumeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useResumeDetail(id);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Resume analysis" subtitle="Loading…" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PulseSkeleton key={i} className="h-28" />
          ))}
        </div>
        <PulseSkeleton className="h-40" />
      </div>
    );
  }

  const analysis = data?.analysis;
  if (!analysis) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Not found" subtitle="Resume analysis not found." />
        <Link to="/resume/upload" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to upload
        </Link>
      </div>
    );
  }

  // ── Still processing ─────────────────────────────────────────────────────
  if (analysis.status === "pending" || analysis.status === "processing") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={analysis.originalFilename}
          subtitle="AI analysis in progress…"
          action={<Badge>⏳ {analysis.status}</Badge>}
        />
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-ink/10 bg-white/80 p-12 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600"
          />
          <div>
            <p className="text-base font-semibold text-ink">
              {analysis.status === "pending"
                ? "Waiting in queue…"
                : "Parsing and analyzing your resume…"}
            </p>
            <p className="mt-1 text-xs text-ink/50">
              This typically takes 20–60 seconds. This page will update automatically.
            </p>
          </div>
          <div className="flex gap-8 text-center">
            {["PDF Parsed", "AI Running", "Results Saved"].map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.4 }}
                  className="h-2 w-2 rounded-full bg-indigo-500"
                />
                <p className="text-xs text-ink/40">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Failed state ──────────────────────────────────────────────────────────
  if (analysis.status === "failed") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={analysis.originalFilename}
          subtitle="Analysis failed"
          action={<Badge>❌ Failed</Badge>}
        />
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-2xl">😔</p>
          <p className="mt-3 text-sm font-semibold text-red-700">Analysis could not complete</p>
          <p className="mt-1 text-xs text-red-500">
            {analysis.errorMessage || "An unexpected error occurred during processing."}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              to="/resume/upload"
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Upload again
            </Link>
            <Link
              to="/resume/history"
              className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              View history
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Completed state ───────────────────────────────────────────────────────
  const feedback = analysis.aiFeedback || {};
  const atsScore: number = analysis.atsScore ?? 0;
  const scoreLabel =
    atsScore >= 75 ? "Strong resume" :
    atsScore >= 50 ? "Moderate — room to improve" :
    "Needs significant improvements";
  const scoreColor =
    atsScore >= 75 ? "text-emerald-700" :
    atsScore >= 50 ? "text-amber-700" :
    "text-rose-700";

  return (
    <div className="space-y-6">
      <SectionHeader
        title={analysis.originalFilename}
        subtitle="AI-generated ATS resume insights"
        action={
          <div className="flex items-center gap-2">
            <Badge>✅ Completed</Badge>
            <Link to="/resume/history" className="text-xs text-ink/50 hover:underline">
              History →
            </Link>
          </div>
        }
      />

      {/* ── Score banner ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-6 rounded-3xl border border-ink/10 bg-white/90 p-6 shadow-sm"
      >
        <ScoreRing score={atsScore} />
        <div>
          <p className="text-2xl font-bold text-ink">{atsScore} / 100</p>
          <p className={`text-sm font-medium ${scoreColor}`}>{scoreLabel}</p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-ink/60">
            {feedback.interviewReadiness || "Your resume has been analyzed by AI."}
          </p>
        </div>
      </motion.div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="ATS score"
          value={atsScore}
          subtitle="Target 75+"
        />
        <StatCard
          title="Strengths"
          value={(feedback.strengths || []).length}
          subtitle="Key highlights"
        />
        <StatCard
          title="Missing keywords"
          value={(feedback.missingKeywords || []).length}
          subtitle="Gaps detected"
        />
      </div>

      {/* ── Strengths & Weaknesses ────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="✓ Strengths">
          {(feedback.strengths || []).length ? (
            <ul className="space-y-2">
              {(feedback.strengths as string[]).map((item: string) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-ink/70"
                >
                  <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/40">No strengths identified.</p>
          )}
        </Card>

        <Card title="✕ Weaknesses">
          {(feedback.weaknesses || []).length ? (
            <ul className="space-y-2">
              {(feedback.weaknesses as string[]).map((item: string) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-ink/70"
                >
                  <span className="mt-0.5 shrink-0 text-rose-500">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/40">No weaknesses identified.</p>
          )}
        </Card>
      </div>

      {/* ── Missing keywords ─────────────────────────────────────────────── */}
      <Card title="🔍 Missing keywords">
        {(feedback.missingKeywords || []).length ? (
          <div className="flex flex-wrap gap-2">
            {(feedback.missingKeywords as string[]).map((item: string) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40">No missing keywords detected.</p>
        )}
      </Card>

      {/* ── Improvement suggestions ───────────────────────────────────────── */}
      <Card title="💡 Improvement suggestions">
        {(feedback.improvementSuggestions || []).length ? (
          <ol className="space-y-3">
            {(feedback.improvementSuggestions as string[]).map(
              (item: string, i: number) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink/70">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/8 text-xs font-bold text-ink">
                    {i + 1}
                  </span>
                  {item}
                </li>
              )
            )}
          </ol>
        ) : (
          <p className="text-sm text-ink/40">No suggestions available.</p>
        )}
      </Card>
    </div>
  );
};

export default ResumeDetail;
