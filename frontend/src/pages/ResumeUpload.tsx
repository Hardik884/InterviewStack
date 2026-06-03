/**
 * ResumeUpload.tsx — Resume upload + real-time pipeline status display.
 *
 * Pipeline flow shown to user:
 *   Upload → Queued → Processing → AI Analysis → Completed (inline results)
 *
 * Bugs fixed:
 *   - Status polling previously returned 400 (ObjectId validation on jobId) → fixed in routes
 *   - Gemini model name was wrong → fixed in aiService.js
 *   - Silent failure when analysis failed → now shows error state with message
 *   - Results only shown after navigating away → now displayed inline
 */

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";
import SectionHeader from "../components/ui/SectionHeader";
import { uploadResume } from "../services/resumeService";
import { useResumeStatus } from "../hooks/useResumeStatus";
import toast from "react-hot-toast";

// ── Pipeline step definitions ────────────────────────────────────────────────

type PipelineStatus = "idle" | "uploading" | "queued" | "processing" | "completed" | "failed";

const steps: { key: PipelineStatus; label: string; icon: string }[] = [
  { key: "uploading",  label: "Uploading",      icon: "📤" },
  { key: "queued",     label: "Queued",          icon: "⏳" },
  { key: "processing", label: "Parsing PDF",     icon: "📄" },
  { key: "completed",  label: "AI Analysis Done", icon: "✅" },
];

const statusOrder: PipelineStatus[] = ["idle", "uploading", "queued", "processing", "completed", "failed"];

const getStepState = (stepKey: PipelineStatus, current: PipelineStatus) => {
  const si = statusOrder.indexOf(stepKey);
  const ci = statusOrder.indexOf(current);
  if (current === "failed") return si < ci ? "done" : "pending";
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
};

// ── Score ring ───────────────────────────────────────────────────────────────

const ScoreRing = ({ score }: { score: number }) => {
  const clamp = Math.min(100, Math.max(0, score));
  const color =
    clamp >= 75 ? "#10b981" : clamp >= 50 ? "#f59e0b" : "#ef4444";
  const dash = 2 * Math.PI * 36;
  const offset = dash - (clamp / 100) * dash;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="36" fill="none" stroke="#1e293b" strokeWidth="8" />
        <motion.circle
          cx="48" cy="48" r="36" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={dash}
          initial={{ strokeDashoffset: dash }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xl font-bold text-white">{clamp}</p>
        <p className="text-[10px] text-white/40">/ 100</p>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ResumeUpload = () => {
  const [file, setFile]           = useState<File | null>(null);
  const [progress, setProgress]   = useState(0);
  const [jobId, setJobId]         = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [error, setError]         = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Polling — active when jobId is set and not done ──────────────────────
  const { data: statusData } = useResumeStatus(jobId);

  // Derive current pipeline status from poll data
  const liveStatus: PipelineStatus =
    !jobId ? pipelineStatus :
    statusData?.status === "completed"  ? "completed"  :
    statusData?.status === "processing" ? "processing" :
    statusData?.status === "failed"     ? "failed"     :
    statusData?.status === "pending"    ? "queued"     :
    pipelineStatus;

  const isRunning = ["uploading", "queued", "processing"].includes(liveStatus);
  const isDone    = liveStatus === "completed";
  const isFailed  = liveStatus === "failed";

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError("Please select a PDF resume"); return; }
    setError("");
    setPipelineStatus("uploading");
    setProgress(0);
    setJobId("");
    setAnalysisId("");

    try {
      const data = await uploadResume({ file, onProgress: setProgress });
      setJobId(data.jobId);
      setAnalysisId(data.analysisId);
      setPipelineStatus("queued");
      toast.success("Resume uploaded — analysis started!");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Upload failed. Please try again.";
      setError(msg);
      setPipelineStatus("failed");
      toast.error(msg);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError("");
    } else if (dropped) {
      setError("Only PDF files are supported.");
    }
  };

  const handleReset = () => {
    setFile(null);
    setJobId("");
    setAnalysisId("");
    setError("");
    setProgress(0);
    setPipelineStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const feedback = statusData?.aiFeedback || {};
  const atsScore: number | null = statusData?.atsScore ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resume analyzer"
        subtitle="Upload a PDF resume and get ATS-focused AI feedback in under 60 seconds."
        action={
          <Link className="text-xs font-medium text-ink hover:underline" to="/resume/history">
            View history →
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Upload panel ─────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-ink">Upload resume</p>

          {/* Drop zone */}
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            animate={{ borderColor: isDragging ? "#6366f1" : "#e2e8f0" }}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              isDragging ? "bg-indigo-50" : "bg-white/60"
            }`}
          >
            <motion.div
              animate={{ scale: isDragging ? 1.15 : 1 }}
              className="text-4xl"
            >
              {file ? "📄" : "📂"}
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-ink">
                {file ? file.name : "Drag & drop your resume"}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB · PDF`
                  : "PDF only, max 10 MB"}
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              aria-label="Resume PDF"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setError(""); }
              }}
            />
            <Button
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={isRunning}
            >
              {file ? "Change file" : "Select file"}
            </Button>
          </motion.div>

          {/* Upload progress bar */}
          <AnimatePresence>
            {pipelineStatus === "uploading" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-1"
              >
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <motion.div
                    className="h-full rounded-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
                <p className="text-right text-xs text-ink/50">{progress}%</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-600"
              >
                ⚠ {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Failed error from API */}
          <AnimatePresence>
            {isFailed && statusData?.errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
              >
                <p className="font-semibold">Analysis failed</p>
                <p className="mt-1 text-red-600/80">{statusData.errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="mt-2 font-medium underline hover:text-red-800"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="accent"
              onClick={handleUpload}
              disabled={!file || isRunning}
            >
              {pipelineStatus === "uploading" ? "Uploading…" : "Upload & analyze"}
            </Button>
            {(isDone || isFailed) && (
              <Button variant="ghost" onClick={handleReset}>
                Analyze another
              </Button>
            )}
          </div>
        </div>

        {/* ── Status & results panel ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Pipeline tracker */}
          <div className="rounded-3xl border border-ink/10 bg-white/80 p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-ink">Analysis status</p>

            {liveStatus === "idle" ? (
              <p className="text-xs text-ink/40">Upload a resume to start.</p>
            ) : (
              <div className="space-y-3">
                {steps.map((step) => {
                  const state = getStepState(step.key, liveStatus);
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-colors ${
                          state === "done"
                            ? "bg-emerald-100 text-emerald-600"
                            : state === "active"
                            ? "bg-indigo-100 text-indigo-600 animate-pulse"
                            : "bg-ink/5 text-ink/30"
                        }`}
                      >
                        {state === "done" ? "✓" : step.icon}
                      </div>
                      <span
                        className={`text-sm ${
                          state === "done"
                            ? "text-emerald-700 line-through opacity-60"
                            : state === "active"
                            ? "font-semibold text-indigo-700"
                            : "text-ink/35"
                        }`}
                      >
                        {step.label}
                      </span>
                      {state === "active" && (
                        <span className="ml-auto h-1.5 w-1.5 animate-ping rounded-full bg-indigo-500" />
                      )}
                    </div>
                  );
                })}

                {isFailed && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm text-red-600">
                      ✕
                    </div>
                    <span className="text-sm font-semibold text-red-600">Failed</span>
                  </div>
                )}
              </div>
            )}

            {/* Job details */}
            {jobId && (
              <div className="mt-4 space-y-1 border-t border-ink/8 pt-3">
                <p className="text-xs text-ink/40">
                  Job: <span className="font-mono text-ink/60">{jobId}</span>
                </p>
                {analysisId && (
                  <p className="text-xs text-ink/40">
                    Analysis:{" "}
                    <Link
                      to={`/resume/${analysisId}`}
                      className="font-mono text-indigo-600 hover:underline"
                    >
                      {analysisId}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Inline results — shown once completed */}
          <AnimatePresence>
            {isDone && atsScore !== null && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl border border-ink/10 bg-white/90 p-5 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <ScoreRing score={atsScore} />
                  <div>
                    <p className="text-base font-bold text-ink">ATS Score</p>
                    <p className="text-xs text-ink/50">
                      {atsScore >= 75
                        ? "Strong — ready for most ATS systems"
                        : atsScore >= 50
                        ? "Moderate — room for improvement"
                        : "Needs work — consider rewriting key sections"}
                    </p>
                    <p className="mt-2 text-xs text-ink/40">
                      {feedback.interviewReadiness || ""}
                    </p>
                  </div>
                </div>

                {/* Quick bullets */}
                {(feedback.strengths?.length > 0 ||
                  feedback.weaknesses?.length > 0) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {feedback.strengths?.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-emerald-700">
                          ✓ Strengths
                        </p>
                        <ul className="space-y-1">
                          {(feedback.strengths as string[])
                            .slice(0, 3)
                            .map((s: string) => (
                              <li
                                key={s}
                                className="text-xs text-ink/70 before:mr-1 before:content-['·']"
                              >
                                {s}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {feedback.weaknesses?.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-rose-700">
                          ✕ Weaknesses
                        </p>
                        <ul className="space-y-1">
                          {(feedback.weaknesses as string[])
                            .slice(0, 3)
                            .map((s: string) => (
                              <li
                                key={s}
                                className="text-xs text-ink/70 before:mr-1 before:content-['·']"
                              >
                                {s}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <Link
                  to={`/resume/${analysisId}`}
                  className="mt-4 block rounded-xl bg-ink px-4 py-2.5 text-center text-xs font-semibold text-white hover:bg-ink/80 transition-colors"
                >
                  View full analysis →
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ResumeUpload;
