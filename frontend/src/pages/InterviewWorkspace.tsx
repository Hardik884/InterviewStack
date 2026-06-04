/**
 * InterviewWorkspace.tsx — Yjs CRDT collaborative editor workspace.
 *
 * Editor synchronisation is now fully handled by Yjs via useYjsEditor.
 * Monaco is driven as an uncontrolled editor — MonacoBinding owns content.
 *
 * Legacy removed:
 *   - useCollaborativeEditor (debounce, isRemoteUpdateRef, sendCodeUpdate)
 *   - useCursorPresence (cursor:move, selection:change socket events)
 *   - remoteUpdate, applyRemoteSnapshot, snapshotRef wiring
 *   - Monaco value/onChange props (now uncontrolled via MonacoBinding)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import SectionHeader from "../components/ui/SectionHeader";
import DifficultyBadge from "../components/DifficultyBadge";
import TagChip from "../components/TagChip";
import WorkspaceLayout from "../components/workspace/WorkspaceLayout";
import ReconnectBanner from "../components/workspace/ReconnectBanner";
import PresenceSidebar from "../components/workspace/PresenceSidebar";
import { useAuth } from "../hooks/useAuth";
import { useProblem } from "../hooks/useProblem";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useYjsEditor } from "../hooks/useYjsEditor";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { useSubmissionsByProblem } from "../hooks/useSubmissionsByProblem";
import { useCreateSubmission } from "../hooks/useCreateSubmission";
import { useRunSubmission } from "../hooks/useRunSubmission";
import { getSocket } from "../sockets/socketClient";
import { useLiveKitCall } from "../hooks/useLiveKitCall";
import VideoPanel from "../components/workspace/VideoPanel";
import type * as Monaco from "monaco-editor";

const tabList = ["Description", "Hints", "Discussion", "Submissions"];
const outputTabs = ["Output", "Error", "Test Cases"];

type ExampleCase = {
  input: string;
  output?: string;
  expectedOutput?: string;
};

type SubmissionItem = {
  _id: string;
  createdAt: string;
  language?: string;
  verdict?: string;
  status?: string;
  runtime?: number | null;
  memory?: number | null;
  stdout?: string;
  stderr?: string;
};

type RunResult = {
  stdout: string;
  stderr: string;
  runtime?: number | null;
  memory?: number | null;
};

const normalizeOutput = (value?: string) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const resolveStarterCode = (
  value: string | Record<string, string> | undefined,
  lang: string
): string => {
  if (!value) return "// Start coding\n";
  if (typeof value === "string") return value;
  return value[lang] || value.javascript || "// Start coding\n";
};

const InterviewWorkspace = () => {
  const { roomId = "", problemId = "" } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth() as {
    user?: { name?: string; _id?: string; id?: string } | null;
    token?: string | null;
  };
  const queryClient = useQueryClient();

  // ── Role ──────────────────────────────────────────────────────────────────
  const role = useMemo<"interviewer" | "candidate">(() => {
    const stored = sessionStorage.getItem(`room:${roomId}:role`);
    if (stored === "interviewer" || stored === "host") return "interviewer";
    return "candidate";
  }, [roomId]);

  // ── Role guard: redirect to role selection if no role stored ────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(`room:${roomId}:role`);
    if (!stored && roomId && !roomId.startsWith("solo-")) {
      navigate(`/join/${roomId}`, { replace: true, state: { problemId } });
    }
  }, [roomId, problemId, navigate]);

  // ── User identity ─────────────────────────────────────────────────────────
  const myUserId = useMemo(
    () =>
      (user as Record<string, string> | null)?._id ??
      (user as Record<string, string> | null)?.id ??
      "",
    [user]
  );

  // ── Yjs CRDT editor (must come before useProblem so remoteProblemId is available) ──
  const defaultCode = "// Start coding\n";

  const {
    editorRef,
    language,
    setLanguage,
    theme,
    toggleTheme,
    resetCode,
    isSaving,
    handleEditorMount,
    remoteProblemId,
  } = useYjsEditor({
    roomId,
    userId:   myUserId,
    userName: user?.name || "Anonymous",
    userRole: role,
    defaultCode,
  });

  // codeRef for Run/Submit — reads Monaco model directly (avoids stale closure)
  const codeRef = useRef<string>("");
  const getLatestCode = useCallback((): string => {
    const editor = editorRef.current as Monaco.editor.IStandaloneCodeEditor | null;
    if (editor) {
      const val = editor.getValue();
      codeRef.current = val;
      return val;
    }
    return codeRef.current;
  }, [editorRef]);

  // ── Effective problemId: URL param takes precedence, fall back to Yjs meta ─
  const effectiveProblemId = problemId || remoteProblemId || "";

  // Emit problem:set once on mount so all participants receive the problemId
  // (interviewer navigates here with a URL problemId; candidate may not have it)
  useEffect(() => {
    if (!problemId || !roomId) return;
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("problem:set", { roomId, problemId });
    }
    // Also store locally so candidates can navigate to it from the lobby
    sessionStorage.setItem(`room:${roomId}:problemId`, problemId);
  }, [problemId, roomId]);

  const { data, isLoading } = useProblem(effectiveProblemId);
  const problem = data?.problem;

  const [activeTab, setActiveTab]   = useState("Description");
  const [bottomTab, setBottomTab]   = useState("Output");
  const [bottomOpen, setBottomOpen] = useState(true);

  const [runResult, setRunResult]     = useState<RunResult | null>(null);
  const [runStatus, setRunStatus]     = useState<"idle" | "running" | "done" | "error">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "queuing" | "queued">("idle");

  // Shared run result received from another participant (e.g. interviewer sees candidate's run)
  const [sharedRunResult, setSharedRunResult] = useState<(RunResult & { fromSelf?: boolean }) | null>(null);
  const [sharedRunStatus, setSharedRunStatus] = useState<"idle" | "done" | "error">("idle");

  const { data: submissionData } = useSubmissionsByProblem(effectiveProblemId);
  const submissionMutation = useCreateSubmission();
  const runMutation        = useRunSubmission();
  const submissions        = (submissionData?.submissions || []) as SubmissionItem[];
  const isSubmitting       = submissionMutation.isPending;
  const isRunning          = runMutation.isPending;

  // ── Room presence (participants, activity, connection status) ─────────────
  const { participants, activity, connectionStatus: roomConnectionStatus } = useInterviewRoom({
    token,
    roomId,
    name: user?.name || "Anonymous",
    role,
  });

  // ── LiveKit video call ─────────────────────────────────────────────────────
  const isSoloSession = roomId.startsWith("solo-");
  const {
    connectionState: callState,
    participants: callParticipants,
    isMuted: callMuted,
    isCameraOff: callCameraOff,
    error: callError,
    toggleMic,
    toggleCamera,
    leaveCall,
    reconnect: reconnectCall,
  } = useLiveKitCall({
    roomId,
    role,
    enabled: !isSoloSession,
  });

  // ── Connection status (for banner) ────────────────────────────────────────
  const { status: connectionStatus, reconnectAttempt } = useConnectionStatus({
    socket: getSocket() ?? undefined,
  });

  // ── Run ────────────────────────────────────────────────────────────────────
  const handleRun = () => {
    if (!effectiveProblemId) return;
    const currentCode = getLatestCode();
    const sampleInput = examples?.[0]?.input || "";

    setRunResult(null);
    setRunStatus("running");
    setBottomOpen(true);
    setBottomTab("Output");

    runMutation.mutate(
      { problemId: effectiveProblemId, sourceCode: currentCode, language, input: sampleInput },
      {
        onSuccess: (data) => {
          const result = data?.result;
          const runRes: RunResult = {
            stdout: result?.stdout ?? "",
            stderr: result?.stderr ?? "",
            runtime: result?.runtime ?? null,
            memory:  result?.memory  ?? null,
          };
          setRunResult(runRes);
          setRunStatus("done");
          if (result?.stderr && !result?.stdout) setBottomTab("Error");

          // ── Broadcast run result to all room participants ──────────────────
          // Only emit if we're in a real room (not solo), so the interviewer sees it.
          const socket = getSocket();
          if (socket?.connected && roomId && !roomId.startsWith("solo-")) {
            socket.emit("run:result", { roomId, result: runRes });
          }
        },
        onError: (error: Error) => {
          const runRes: RunResult = {
            stdout: "",
            stderr: error?.message || "Run failed. Check your network connection.",
            runtime: null,
            memory:  null,
          };
          setRunResult(runRes);
          setRunStatus("error");
          setBottomTab("Error");

          // Also broadcast errors so interviewer sees the failure
          const socket = getSocket();
          if (socket?.connected && roomId && !roomId.startsWith("solo-")) {
            socket.emit("run:result", { roomId, result: runRes });
          }
        },
      }
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!effectiveProblemId) return;
    const currentCode = getLatestCode();

    setSubmitStatus("queuing");
    setBottomOpen(true);
    setBottomTab("Test Cases");
    setActiveTab("Submissions");

    submissionMutation.mutate(
      { problemId: effectiveProblemId, sourceCode: currentCode, language, roomId },
      {
        onSuccess: () => {
          setSubmitStatus("queued");
          queryClient.invalidateQueries({ queryKey: ["submissions", effectiveProblemId] });
        },
        onError: () => setSubmitStatus("idle"),
      }
    );
  };

  // ── Copy invite link ───────────────────────────────────────────────────────
  const shareLink = `${window.location.origin}/interview/${roomId}/${effectiveProblemId}`;
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    toast.success("Invite link copied!");
  };

  // ── Real-time submission verdict ───────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload: {
      problemId?: string;
      status?: string;
      verdict?: string;
      stdout?: string;
      stderr?: string;
      runtime?: number | null;
      memory?: number | null;
      executionTime?: number | null;
    }) => {
      if (payload?.problemId === effectiveProblemId) {
        queryClient.invalidateQueries({ queryKey: ["submissions", effectiveProblemId] });
        setSubmitStatus("idle");

        // Share submission execution output room-wide so interviewer sees results
        if (payload.status === "completed" || payload.status === "failed") {
          const submissionResult: RunResult = {
            stdout: payload.stdout || "",
            stderr: payload.stderr || "",
            runtime: payload.runtime ?? payload.executionTime ?? null,
            memory: payload.memory ?? null,
          };
          // Only update shared results if there's actual output
          if (submissionResult.stdout || submissionResult.stderr) {
            setSharedRunResult(submissionResult);
            setSharedRunStatus(submissionResult.stderr && !submissionResult.stdout ? "error" : "done");
            setBottomOpen(true);
            setBottomTab("Output");
          }
        }
      }
    };
    socket.on("submission:update", handler);
    return () => { socket.off("submission:update", handler); };
  }, [effectiveProblemId, queryClient]);

  // ── Shared run results (interviewer sees candidate's run output) ───────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    const handler = (payload: { roomId: string; result: RunResult }) => {
      if (payload.roomId !== roomId) return;
      setSharedRunResult(payload.result);
      setSharedRunStatus(payload.result.stderr && !payload.result.stdout ? "error" : "done");
      setBottomOpen(true);
    };
    socket.on("run:result", handler);
    return () => { socket.off("run:result", handler); };
  }, [roomId]);

  // ── Poll while submission pending ──────────────────────────────────────────
  useEffect(() => {
    const latestSub = submissions[0];
    if (latestSub?.status === "queued" || latestSub?.status === "processing") {
      const timer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [submissions, problemId, queryClient]);

  const examples = useMemo(() => {
    if (problem?.examples?.length) return problem.examples;
    return problem?.testCases || [];
  }, [problem]) as ExampleCase[];

  // ── Verdict / status helpers ───────────────────────────────────────────────
  const verdictClass = (verdict?: string) => {
    switch (verdict) {
      case "Accepted":            return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "Wrong Answer":        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      case "Compilation Error":   return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "Runtime Error":       return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "Time Limit Exceeded": return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      default:                    return "bg-ink/5 text-ink/70 border-ink/15";
    }
  };

  const statusClass = (status?: string) => {
    switch (status) {
      case "queued":     return "bg-ink/5 text-ink/70 border-ink/15";
      case "processing": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "completed":  return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "failed":     return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      default:           return "bg-ink/5 text-ink/70 border-ink/15";
    }
  };

  // ── Left panel ─────────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 p-4 backdrop-blur">
        {isLoading ? (
          <p className="text-sm text-ink/60">Loading problem...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-ink">
                  {problem?.title || "Problem"}
                </p>
                <p className="text-xs text-ink/60">
                  Acceptance: {problem?.acceptanceRate || 42}%
                </p>
              </div>
              <DifficultyBadge value={problem?.difficulty} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(problem?.tags || []).map((tag: string) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(problem?.companyTags || []).map((tag: string) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabList.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1 text-xs ${
                activeTab === tab
                  ? "bg-ink text-white"
                  : "border border-ink/15 text-ink/70"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {activeTab === "Description" && (
          <div className="space-y-4 text-ink/80">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {problem?.description || "No description available."}
            </ReactMarkdown>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Examples</p>
              {examples.length ? (
                examples.map((item: ExampleCase, index: number) => (
                  <div key={`${item.input}-${index}`} className="mt-3">
                    <p className="text-xs text-ink/60">Input</p>
                    <code className="block rounded-xl bg-ink/5 px-3 py-2 text-xs">{item.input}</code>
                    <p className="mt-2 text-xs text-ink/60">Output</p>
                    <code className="block rounded-xl bg-ink/5 px-3 py-2 text-xs">
                      {item.output || item.expectedOutput}
                    </code>
                  </div>
                ))
              ) : (
                <p className="mt-2 text-xs text-ink/60">No examples yet.</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Constraints</p>
              {problem?.constraints?.length ? (
                <ul className="mt-2 list-disc pl-4 text-xs text-ink/60">
                  {problem.constraints.map((item: string, index: number) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 list-disc pl-4 text-xs text-ink/60">
                  <li>Optimize for linear or log-linear complexity.</li>
                  <li>Handle empty input and edge cases.</li>
                </ul>
              )}
            </div>
          </div>
        )}
        {activeTab === "Hints" && (
          <div className="space-y-2 text-xs text-ink/70">
            {problem?.hints?.length ? (
              problem.hints.map((hint: string, index: number) => (
                <p key={`${hint}-${index}`}>{hint}</p>
              ))
            ) : (
              <EmptyState title="Hints coming soon" description="Add your hints or create in the admin panel." />
            )}
          </div>
        )}
        {activeTab === "Discussion" && (
          <EmptyState title="Discussion not enabled" description="Collaborate in the room chat for now." />
        )}
        {activeTab === "Submissions" && (
          <div className="space-y-3">
            {submissions.length ? (
              <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/80">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-ink/10 bg-white/90 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-ink/50">
                  <span>Status</span><span>Verdict</span><span>Runtime</span>
                  <span>Memory</span><span>Language</span><span>Submitted</span>
                </div>
                {submissions.slice(0, 6).map((submission: SubmissionItem) => (
                  <div
                    key={submission._id}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-ink/10 px-4 py-3 text-xs"
                  >
                    <span className={`w-fit rounded-full border px-2 py-0.5 ${statusClass(submission.status)}`}>
                      {submission.status || "queued"}
                    </span>
                    <span className={`w-fit rounded-full border px-2 py-0.5 ${verdictClass(submission.verdict)}`}>
                      {submission.verdict || "Pending"}
                    </span>
                    <span>{submission.runtime ? `${submission.runtime}ms` : "-"}</span>
                    <span>{submission.memory ? `${submission.memory}KB` : "-"}</span>
                    <span>{submission.language?.toUpperCase()}</span>
                    <span>{new Date(submission.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No submissions yet" description="Run or submit code to track attempts." />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Center panel ──────────────────────────────────────────────────────────
  const centerPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white/95 p-4 text-xs backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-ink/60">Language</span>
          <select
            aria-label="Select language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-full border border-ink/20 bg-white px-3 py-1"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isSaving ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}>
            {isSaving ? "Syncing…" : "Synced ✓"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-ink/20 px-3 py-1"
            onClick={toggleTheme}
          >
            {theme === "vs-dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <button
            type="button"
            className="rounded-full border border-ink/20 px-3 py-1"
            onClick={resetCode}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Monaco Editor — uncontrolled (MonacoBinding drives content) */}
      <div className="min-h-0 flex-1 p-3">
        <div className="h-full rounded-2xl border border-ink/10 bg-white overflow-hidden">
          <Editor
            height="100%"
            width="100%"
            theme={theme}
            language={language}
            defaultValue=""
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              padding: { top: 12 },
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 px-4 py-3 text-sm">
        <Button variant="ghost" onClick={handleRun} disabled={isRunning || isSubmitting}>
          ▶ Run
        </Button>
        <Button variant="accent" onClick={handleSubmit} disabled={isSubmitting || isRunning}>
          Submit
        </Button>
        {(isSubmitting || submitStatus === "queuing") && (
          <span className="text-xs text-ink/60">Queuing submission…</span>
        )}
        {submitStatus === "queued" && (
          <span className="text-xs text-ink/60">Submitted — awaiting verdict…</span>
        )}
        {isRunning && (
          <span className="text-xs text-ink/60">Running…</span>
        )}
      </div>
    </div>
  );

  // ── Right panel ───────────────────────────────────────────────────────────
  const rightPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <PresenceSidebar
          participants={participants}
          typingUsers={[]}
          connectionStatus={connectionStatus}
          reconnectAttempt={reconnectAttempt}
          myUserId={myUserId}
        />
      </div>

      <div className="flex-none space-y-3 border-t border-ink/8 p-3 overflow-y-auto max-h-56">
        <Card title="Activity">
          <div className="space-y-1 text-xs text-ink/60 max-h-24 overflow-y-auto">
            {activity.map((item: { message: string; timestamp: number }, index: number) => (
              <p key={`${item.timestamp}-${index}`}>{item.message}</p>
            ))}
            {!activity.length && <p>No activity yet.</p>}
          </div>
        </Card>

        <Card title="Share room">
          <div className="space-y-2 text-xs">
            <p className="break-all text-ink/60 text-[10px]">{shareLink}</p>
            <Button variant="ghost" onClick={handleCopyLink}>
              📋 Copy invite link
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── Bottom panel ──────────────────────────────────────────────────────────
  const latestPendingSub = submissions.find(
    (s) => s.status === "queued" || s.status === "processing"
  );

  const bottomPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {outputTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setBottomTab(tab)}
            className={`rounded-full px-3 py-1 text-xs ${
              bottomTab === tab ? "bg-ink text-white" : "border border-ink/15 text-ink/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {bottomTab === "Output" && (
        <div className="space-y-3">
          {/* Local run result */}
          <div className="rounded-2xl bg-ink/5 p-4 font-mono text-xs text-ink/70 whitespace-pre-wrap">
            {runStatus === "running" ? (
              <span className="text-ink/50 italic">Running…</span>
            ) : runStatus === "idle" && !sharedRunResult ? (
              <span className="text-ink/40 italic">Run code to see output.</span>
            ) : runResult?.stdout ? (
              <>
                <div>{runResult.stdout}</div>
                {runResult.runtime != null && (
                  <div className="mt-2 text-ink/40">
                    {runResult.runtime}ms{runResult.memory != null ? ` · ${runResult.memory}KB` : ""}
                  </div>
                )}
              </>
            ) : runStatus === "error" || runResult?.stderr ? (
              <span className="text-ink/40 italic">No stdout. Check the Error tab.</span>
            ) : sharedRunResult ? null : (
              <span className="text-ink/40 italic">No output produced.</span>
            )}
          </div>

          {/* Shared run result from the other participant */}
          {sharedRunResult && sharedRunStatus !== "idle" && (
            <div className="rounded-2xl border border-navy/15 bg-navy/4 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-navy/60">
                {role === "interviewer" ? "📺 Candidate's Run Output" : "🔄 Shared Run Output"}
              </p>
              <div className="font-mono text-xs text-ink/70 whitespace-pre-wrap">
                {sharedRunResult.stdout || (
                  <span className="italic text-ink/40">No stdout.</span>
                )}
              </div>
              {sharedRunResult.stderr && (
                <div className="mt-2 font-mono text-xs text-rose-600 whitespace-pre-wrap">
                  {sharedRunResult.stderr}
                </div>
              )}
              {sharedRunResult.runtime != null && (
                <p className="mt-2 text-[10px] text-ink/40">
                  {sharedRunResult.runtime}ms{sharedRunResult.memory != null ? ` · ${sharedRunResult.memory}KB` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {bottomTab === "Error" && (
        <div className="rounded-2xl bg-ink/5 p-4 font-mono text-xs text-rose-700/80 whitespace-pre-wrap">
          {runStatus === "idle" ? (
            <span className="text-ink/40 italic">Run code to see errors.</span>
          ) : runResult?.stderr ? (
            runResult.stderr
          ) : (
            <span className="text-ink/40 italic">No errors or compile output.</span>
          )}
        </div>
      )}

      {bottomTab === "Test Cases" && (
        <div className="space-y-3 text-xs text-ink/70">
          {latestPendingSub && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-blue-700 text-xs">
              Submission is {latestPendingSub.status}… Verdict will appear in the Submissions tab.
            </div>
          )}
          {examples.length ? (
            examples.map((item: ExampleCase, index: number) => {
              const expected     = item.output || item.expectedOutput || "";
              const actual       = runResult?.stdout ?? "";
              const hasRunResult = runStatus === "done";
              const passed =
                hasRunResult && expected !== ""
                  ? normalizeOutput(actual) === normalizeOutput(expected)
                  : null;

              return (
                <div key={`${item.input}-${index}`} className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                  <p className="font-medium text-ink/50 uppercase tracking-wide text-[10px]">
                    Test Case {index + 1}
                  </p>
                  <p className="mt-2 text-ink/60">Input</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">{item.input}</pre>
                  <p className="mt-3 text-ink/60">Expected Output</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">{expected || "-"}</pre>
                  <p className="mt-3 text-ink/60">Actual Output</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">
                    {hasRunResult ? actual || "(empty)" : "Run code to see output"}
                  </pre>
                  {passed !== null && (
                    <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 ${
                      passed
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                        : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                    }`}>
                      {passed ? "✓ Pass" : "✗ Fail"}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <p>No test cases available.</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      <ReconnectBanner status={connectionStatus} reconnectAttempt={reconnectAttempt} />

      <SectionHeader
        title="Interview workspace"
        subtitle="Collaborative coding session — powered by Yjs CRDT"
        action={
          <div className="flex items-center gap-2">
            <Badge>Room: {roomId}</Badge>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              connectionStatus === "online"
                ? "bg-emerald-100 text-emerald-700"
                : connectionStatus === "reconnecting"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              {connectionStatus === "online"
                ? "🟢 Live"
                : connectionStatus === "reconnecting"
                ? "🟡 Reconnecting"
                : "🔴 Offline"}
            </span>
          </div>
        }
      />

      {/* Video call panel — sits between the header and workspace grid */}
      {!isSoloSession && (
        <VideoPanel
          participants={callParticipants}
          connectionState={callState}
          isMuted={callMuted}
          isCameraOff={callCameraOff}
          error={callError}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onLeave={leaveCall}
          onReconnect={reconnectCall}
        />
      )}

      <WorkspaceLayout
        left={leftPanel}
        center={centerPanel}
        right={rightPanel}
        bottom={bottomPanel}
        bottomOpen={bottomOpen}
        onToggleBottom={() => setBottomOpen((prev) => !prev)}
      />
    </div>
  );
};

export default InterviewWorkspace;
