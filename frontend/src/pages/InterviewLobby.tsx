/**
 * InterviewLobby.tsx — Post-role-selection interview lobby.
 *
 * Uses the InterviewStack design system (sand/ink/accent/navy palette,
 * Space Grotesk, existing Card/Button component patterns).
 *
 * Flow:
 *   RoleSelect → InterviewLobby → InterviewWorkspace (/interview/:roomId/:problemId)
 *
 * Interviewer sees: problem picker + "Start Interview" button
 * Candidate sees:   waiting state + "Ready" indicator
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useProblems } from "../hooks/useProblems";

type ParticipantRole = "interviewer" | "candidate";

type Problem = {
  _id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags?: string[];
};

const difficultyColor: Record<string, string> = {
  Easy:   "text-emerald-600 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Hard:   "text-rose-600 bg-rose-50 border-rose-200",
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" },
  }),
};

const InterviewLobby = () => {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth() as {
    user?: { name?: string; _id?: string; id?: string } | null;
    token?: string | null;
  };

  // ── Role resolution ─────────────────────────────────────────────────────
  const role = useMemo<ParticipantRole>(() => {
    const stored = sessionStorage.getItem(`room:${roomId}:role`);
    if (stored === "interviewer") return "interviewer";
    if (stored === "candidate") return "candidate";
    return "candidate";
  }, [roomId]);

  // ── If no role stored, redirect to role select ──────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(`room:${roomId}:role`);
    if (!stored) {
      navigate(`/join/${roomId}`, { replace: true });
    }
  }, [roomId, navigate]);

  const displayName = user?.name || "Anonymous";

  // ── Room presence ────────────────────────────────────────────────────────
  const { participants, connectionStatus } = useInterviewRoom({
    token,
    roomId,
    name: displayName,
    role,
  });

  // ── Problem picker (interviewer only) ────────────────────────────────────
  const { data: problemsData } = useProblems({ limit: 50 });
  const problems: Problem[] = problemsData?.problems || [];
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [search, setSearch] = useState("");
  const [isReady, setIsReady] = useState(false);

  const selectedProblem = problems.find((p) => p._id === selectedProblemId);
  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  // ── Start interview (interviewer) ────────────────────────────────────────
  const handleStart = () => {
    if (!selectedProblemId) return;
    navigate(`/interview/${roomId}/${selectedProblemId}`);
  };

  // ── Candidate: join workspace once interviewer starts ────────────────────
  const handleCandidateJoin = () => {
    const storedProblemId = sessionStorage.getItem(`room:${roomId}:problemId`);
    if (storedProblemId) {
      navigate(`/interview/${roomId}/${storedProblemId}`);
    } else {
      navigate(`/rooms/${roomId}`);
    }
  };

  const isOnline = connectionStatus === "online";
  const myUserId = (user as { _id?: string } | null)?._id ?? (user as { id?: string } | null)?.id;
  const hasInterviewer = participants.some((p) => p.role === "interviewer" || p.role === "host");
  const hasCandidate = participants.some((p) => p.role === "candidate");

  return (
    <div
      className="flex min-h-screen items-start justify-center bg-sand p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 10%, rgba(255,106,61,0.07), transparent 45%), radial-gradient(circle at 80% 0%, rgba(29,78,137,0.07), transparent 40%), linear-gradient(180deg, rgba(246,244,239,0.95), rgba(238,233,226,0.95))",
      }}
    >
      <div className="w-full max-w-xl space-y-4 py-10">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">
              Interview Lobby
            </p>
            <h1 className="mt-1 text-2xl font-bold text-ink">
              {role === "interviewer" ? "Set up the session" : "Ready to code?"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                isOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOnline ? "animate-pulse bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {isOnline ? "Connected" : "Connecting…"}
            </span>

            {/* Role badge */}
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                role === "interviewer"
                  ? "border-navy/20 bg-navy/8 text-navy"
                  : "border-accent/20 bg-accent/8 text-accent"
              }`}
            >
              {role === "interviewer" ? "🎯 Interviewer" : "💻 Candidate"}
            </span>
          </div>
        </motion.div>

        {/* ── Room Info ──────────────────────────────────────────────────── */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-card"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 mb-3">Room</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-lg font-bold text-ink">{roomId}</p>
              <p className="mt-0.5 text-xs text-ink/50">Share this ID with your participant</p>
            </div>
            <button
              id="btn-copy-room"
              onClick={() =>
                navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`)
              }
              className="rounded-xl border border-ink/15 bg-ink/3 px-3 py-1.5 text-xs text-ink/60 hover:bg-ink/8 hover:text-ink transition-all"
            >
              📋 Copy invite link
            </button>
          </div>
        </motion.div>

        {/* ── Participants ─────────────────────────────────────────────────── */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-card"
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">
            Participants ({participants.length})
          </p>
          <div className="space-y-2">
            <AnimatePresence>
              {participants.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-ink/40 italic"
                >
                  Waiting for participants to join…
                </motion.p>
              )}
              {participants.map((p) => (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between rounded-xl border border-ink/8 bg-white px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        p.role === "interviewer" || p.role === "host"
                          ? "bg-navy/10 text-navy"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {p.name[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {p.name}
                        {p.userId === myUserId && (
                          <span className="ml-2 text-xs text-ink/40">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-ink/50 capitalize">{p.role}</p>
                    </div>
                  </div>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Waiting states */}
          <div className="mt-3 space-y-1.5">
            {!hasCandidate && (
              <p className="flex items-center gap-2 text-xs text-ink/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/30" />
                Waiting for candidate to join…
              </p>
            )}
            {!hasInterviewer && role === "candidate" && (
              <p className="flex items-center gap-2 text-xs text-ink/40">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/30" />
                Waiting for interviewer…
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Interviewer: Problem picker ───────────────────────────────────── */}
        {role === "interviewer" && (
          <motion.div
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-card"
          >
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">
              Select a Problem
            </p>

            <input
              id="problem-search"
              type="text"
              placeholder="Search problems…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 w-full rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-navy/40 focus:outline-none focus:ring-0"
            />

            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {filteredProblems.slice(0, 20).map((p) => (
                <button
                  key={p._id}
                  id={`problem-${p._id}`}
                  onClick={() => setSelectedProblemId(p._id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
                    selectedProblemId === p._id
                      ? "border-ink/20 bg-white shadow-card text-ink ring-2 ring-ink/10"
                      : "border-ink/8 bg-white/60 text-ink/70 hover:border-ink/15 hover:bg-white hover:text-ink"
                  }`}
                >
                  <span className="truncate font-medium">{p.title}</span>
                  <span
                    className={`ml-3 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                      difficultyColor[p.difficulty] ?? "text-ink/50"
                    }`}
                  >
                    {p.difficulty}
                  </span>
                </button>
              ))}
              {filteredProblems.length === 0 && (
                <p className="py-4 text-center text-xs text-ink/40">
                  No problems match "{search}"
                </p>
              )}
            </div>

            {selectedProblem && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700"
              >
                <span>✓</span>
                <span className="font-medium">{selectedProblem.title}</span>
                <span className="text-emerald-600/60">selected</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Candidate: Ready state ──────────────────────────────────────── */}
        {role === "candidate" && (
          <motion.div
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-card text-center"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/8 text-3xl"
            >
              💻
            </motion.div>
            <p className="text-base font-semibold text-ink">
              {isReady ? "You're ready!" : "Mark yourself ready"}
            </p>
            <p className="mt-1 text-xs text-ink/50">
              The interviewer will start the session and share the problem.
            </p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <motion.button
                id="btn-ready"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsReady((v) => !v)}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                  isReady
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-ink/15 bg-ink text-white hover:bg-ink/85"
                }`}
              >
                {isReady ? "✓ Ready" : "I'm ready"}
              </motion.button>
              <button
                id="btn-enter-session"
                onClick={handleCandidateJoin}
                className="text-xs text-ink/40 underline hover:text-ink/70 transition-colors"
              >
                Enter session directly →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        {role === "interviewer" && (
          <motion.div
            custom={3}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.button
              id="btn-start-interview"
              whileHover={selectedProblemId ? { scale: 1.015 } : {}}
              whileTap={selectedProblemId ? { scale: 0.98 } : {}}
              onClick={handleStart}
              disabled={!selectedProblemId}
              className={`w-full rounded-2xl py-4 text-base font-bold transition-all duration-200 ${
                selectedProblemId
                  ? "bg-ink text-white shadow-soft hover:bg-ink/85"
                  : "cursor-not-allowed bg-ink/8 text-ink/30"
              }`}
            >
              {selectedProblemId
                ? `Start Interview — ${selectedProblem?.title}`
                : "Select a problem to start"}
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default InterviewLobby;
