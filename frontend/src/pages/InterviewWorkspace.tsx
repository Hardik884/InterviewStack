import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import SectionHeader from "../components/ui/SectionHeader";
import DifficultyBadge from "../components/DifficultyBadge";
import TagChip from "../components/TagChip";
import StatusPill from "../components/StatusPill";
import WorkspaceLayout from "../components/workspace/WorkspaceLayout";
import { useAuth } from "../hooks/useAuth";
import { useProblem } from "../hooks/useProblem";
import { useInterviewRoom } from "../hooks/useInterviewRoom";
import { useCollaborativeEditor } from "../hooks/useCollaborativeEditor";
import { useSubmissionsByProblem } from "../hooks/useSubmissionsByProblem";
import { useCreateSubmission } from "../hooks/useCreateSubmission";
import { useRunSubmission } from "../hooks/useRunSubmission";
import { getSocket } from "../sockets/socketClient";

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

// Separate type for run-only results (never mixed with submit)
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
  if (!value) {
    return "// Start coding\n";
  }
  if (typeof value === "string") {
    return value;
  }
  return value[lang] || value.javascript || "// Start coding\n";
};

const InterviewWorkspace = () => {
  const { roomId = "", problemId = "" } = useParams();
  const { user, token } = useAuth() as {
    user?: { name?: string } | null;
    token?: string | null;
  };
  const queryClient = useQueryClient();
  const { data, isLoading } = useProblem(problemId);
  const problem = data?.problem;
  const [activeTab, setActiveTab] = useState("Description");
  const [bottomTab, setBottomTab] = useState("Output");
  const [bottomOpen, setBottomOpen] = useState(true);

  // Run-only state – never populated by Submit
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  // Submit-only status label
  const [submitStatus, setSubmitStatus] = useState<"idle" | "queuing" | "queued">("idle");

  const { data: submissionData } = useSubmissionsByProblem(problemId);
  const submissionMutation = useCreateSubmission();
  const runMutation = useRunSubmission();
  const submissions = (submissionData?.submissions || []) as SubmissionItem[];
  const isSubmitting = submissionMutation.isPending;
  const isRunning = runMutation.isPending;

  const {
    participants,
    typingUsers,
    activity,
    connected,
    remoteUpdate,
    sendCodeUpdate,
    updateTyping,
  } = useInterviewRoom({
    token,
    roomId,
    name: user?.name || "Anonymous",
  });

  // language must be determined BEFORE useCollaborativeEditor so defaultCode uses it.
  // We initialise language from state here and pass it down.
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");

  const {
    code,
    codeRef,
    language,
    theme,
    isSaving,
    updateCode,
    changeLanguage,
    toggleTheme,
    resetCode,
  } = useCollaborativeEditor({
    roomId,
    problemId,
    defaultCode: resolveStarterCode(problem?.starterCode, selectedLanguage),
    remoteUpdate,
    sendCodeUpdate,
    updateTyping,
  });

  // Keep selectedLanguage in sync with the editor language
  const prevLanguageRef = useRef(language);
  if (prevLanguageRef.current !== language) {
    prevLanguageRef.current = language;
    setSelectedLanguage(language);
  }

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) {
      return null;
    }
    return `${typingUsers.length} typing`;
  }, [typingUsers.length]);

  const examples = useMemo(() => {
    if (problem?.examples?.length) {
      return problem.examples;
    }
    return problem?.testCases || [];
  }, [problem]) as ExampleCase[];

  // Run: execute current editor code against the first sample input.
  // Never sets verdict. Never touches submission state.
  const handleRun = () => {
    if (!problemId) return;

    // Use codeRef.current so we always get the exact current editor content,
    // even if the React state update is still pending.
    const currentCode = codeRef.current;
    const currentLanguage = language;
    const sampleInput = examples?.[0]?.input || "";

    setRunResult(null);
    setRunStatus("running");
    setBottomOpen(true);
    setBottomTab("Output");

    runMutation.mutate(
      {
        problemId,
        sourceCode: currentCode,
        language: currentLanguage,
        input: sampleInput,
      },
      {
        onSuccess: (data) => {
          const result = data?.result;
          setRunResult({
            stdout: result?.stdout ?? "",
            stderr: result?.stderr ?? "",
            runtime: result?.runtime ?? null,
            memory: result?.memory ?? null,
          });
          setRunStatus("done");
          // If there were errors, switch to Error tab automatically
          if (result?.stderr && !result?.stdout) {
            setBottomTab("Error");
          }
        },
        onError: (error: Error) => {
          setRunResult({
            stdout: "",
            stderr: error?.message || "Run failed. Check your network connection.",
            runtime: null,
            memory: null,
          });
          setRunStatus("error");
          setBottomTab("Error");
        },
      }
    );
  };

  // Submit: enqueue against all test cases. Never sets runResult.
  const handleSubmit = () => {
    if (!problemId) return;

    // Always use codeRef.current for the exact current editor content.
    const currentCode = codeRef.current;
    const currentLanguage = language;

    setSubmitStatus("queuing");
    setBottomOpen(true);
    setBottomTab("Test Cases");
    setActiveTab("Submissions");

    submissionMutation.mutate(
      {
        problemId,
        sourceCode: currentCode,
        language: currentLanguage,
        roomId,
      },
      {
        onSuccess: () => {
          setSubmitStatus("queued");
          // Invalidate immediately so the Submissions tab shows the queued entry
          queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
        },
        onError: () => {
          setSubmitStatus("idle");
        },
      }
    );
  };

  const shareLink = `${window.location.origin}/interview/${roomId}/${problemId}`;

  // Listen for real-time verdict updates over the socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload: { problemId?: string }) => {
      if (payload?.problemId === problemId) {
        queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
        setSubmitStatus("idle");
      }
    };

    socket.on("submission:update", handler);
    return () => {
      socket.off("submission:update", handler);
    };
  }, [problemId, queryClient]);

  // Also poll the query every 3 s while a submission is processing
  useEffect(() => {
    const latestSub = submissions[0];
    if (latestSub?.status === "queued" || latestSub?.status === "processing") {
      const timer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [submissions, problemId, queryClient]);

  const verdictClass = (verdict?: string) => {
    switch (verdict) {
      case "Accepted":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "Wrong Answer":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      case "Compilation Error":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "Runtime Error":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "Time Limit Exceeded":
        return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      default:
        return "bg-ink/5 text-ink/70 border-ink/15";
    }
  };

  const statusClass = (status?: string) => {
    switch (status) {
      case "queued":
        return "bg-ink/5 text-ink/70 border-ink/15";
      case "processing":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "failed":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      default:
        return "bg-ink/5 text-ink/70 border-ink/15";
    }
  };

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
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Examples
              </p>
              {examples.length ? (
                examples.map((item: ExampleCase, index: number) => (
                  <div key={`${item.input}-${index}`} className="mt-3">
                    <p className="text-xs text-ink/60">Input</p>
                    <code className="block rounded-xl bg-ink/5 px-3 py-2 text-xs">
                      {item.input}
                    </code>
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
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Constraints
              </p>
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
              <EmptyState
                title="Hints coming soon"
                description="Add your hints or create in the admin panel."
              />
            )}
          </div>
        )}
        {activeTab === "Discussion" && (
          <EmptyState
            title="Discussion not enabled"
            description="Collaborate in the room chat for now."
          />
        )}
        {activeTab === "Submissions" && (
          <div className="space-y-3">
            {submissions.length ? (
              <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/80">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-ink/10 bg-white/90 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-ink/50">
                  <span>Status</span>
                  <span>Verdict</span>
                  <span>Runtime</span>
                  <span>Memory</span>
                  <span>Language</span>
                  <span>Submitted</span>
                </div>
                {submissions.slice(0, 6).map((submission: SubmissionItem) => (
                  <div
                    key={submission._id}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-ink/10 px-4 py-3 text-xs"
                  >
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 ${statusClass(
                        submission.status
                      )}`}
                    >
                      {submission.status || "queued"}
                    </span>
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 ${verdictClass(
                        submission.verdict
                      )}`}
                    >
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
              <EmptyState
                title="No submissions yet"
                description="Run or submit code to track attempts."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  const centerPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white/95 p-4 text-xs backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-ink/60">Language</span>
          <select
            aria-label="Select language"
            value={language}
            onChange={(event) => {
              setSelectedLanguage(event.target.value);
              changeLanguage(event.target.value);
            }}
            className="rounded-full border border-ink/20 bg-white px-3 py-1"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <StatusPill label={isSaving ? "Saving..." : "Saved"} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-ink/20 px-3 py-1"
            onClick={toggleTheme}
          >
            {theme === "vs-dark" ? "Dark" : "Light"}
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
      <div className="min-h-0 flex-1 p-3">
        <div className="h-full rounded-2xl border border-ink/10 bg-white">
          <Editor
            height="100%"
            width="100%"
            theme={theme}
            language={language}
            value={code}
            onChange={(value) => updateCode(value || "")}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 px-4 py-3 text-sm">
        <Button variant="ghost" onClick={handleRun} disabled={isRunning || isSubmitting}>
          Run Code
        </Button>
        <Button variant="accent" onClick={handleSubmit} disabled={isSubmitting || isRunning}>
          Submit Solution
        </Button>
        {typingLabel ? (
          <span className="text-xs text-ink/60">{typingLabel}</span>
        ) : null}
        {isSubmitting || submitStatus === "queuing" ? (
          <span className="text-xs text-ink/60">Queuing submission...</span>
        ) : submitStatus === "queued" ? (
          <span className="text-xs text-ink/60">Submitted – awaiting verdict...</span>
        ) : null}
        {isRunning ? (
          <span className="text-xs text-ink/60">Running...</span>
        ) : null}
      </div>
    </div>
  );

  const rightPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 p-4 backdrop-blur">
        <SectionHeader
          title="Room"
          subtitle={connected ? "Connected" : "Reconnecting"}
          action={<Badge>{participants.length} online</Badge>}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <Card title="Participants">
          <div className="space-y-2 text-sm">
            {participants.map((participant: { userId: string; name?: string }) => (
              <div key={participant.userId} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                  {participant.name?.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p>{participant.name}</p>
                  <p className="text-xs text-ink/50">Online</p>
                </div>
              </div>
            ))}
            {!participants.length && (
              <p className="text-xs text-ink/60">Waiting for others.</p>
            )}
          </div>
        </Card>

        <Card title="Room activity">
          <div className="space-y-2 text-xs text-ink/60">
            {activity.map((item: { message: string; timestamp: number }, index: number) => (
              <p key={`${item.timestamp}-${index}`}>{item.message}</p>
            ))}
            {!activity.length && (
              <p className="text-xs text-ink/60">No activity yet.</p>
            )}
          </div>
        </Card>

        <Card title="Share room">
          <div className="space-y-2 text-xs">
            <p className="break-all text-ink/60">{shareLink}</p>
            <Button
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(shareLink)}
            >
              Copy invite link
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── Bottom panel ─────────────────────────────────────────────────────────
  // Output tab  → Run stdout only (never submission output)
  // Error tab   → Run stderr / compile errors only (never submission stderr)
  // Test Cases  → Per-example: input, expected, actual (from run), pass/fail

  const latestCompletedSub = submissions.find((s) => s.status === "completed");
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
              bottomTab === tab
                ? "bg-ink text-white"
                : "border border-ink/15 text-ink/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Output tab: stdout from Run only ─────────────────────────── */}
      {bottomTab === "Output" && (
        <div className="rounded-2xl bg-ink/5 p-4 font-mono text-xs text-ink/70 whitespace-pre-wrap">
          {runStatus === "running" ? (
            <span className="text-ink/50 italic">Running…</span>
          ) : runStatus === "idle" ? (
            <span className="text-ink/40 italic">Run code to see output.</span>
          ) : runResult?.stdout ? (
            runResult.stdout
          ) : runStatus === "error" || runResult?.stderr ? (
            <span className="text-ink/40 italic">No stdout. Check the Error tab.</span>
          ) : (
            <span className="text-ink/40 italic">No output produced.</span>
          )}
        </div>
      )}

      {/* ── Error tab: stderr / compile errors from Run only ─────────── */}
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

      {/* ── Test Cases tab ────────────────────────────────────────────── */}
      {bottomTab === "Test Cases" && (
        <div className="space-y-3 text-xs text-ink/70">
          {latestPendingSub && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-blue-700 text-xs">
              Submission is {latestPendingSub.status}… Verdict will appear in the Submissions tab.
            </div>
          )}
          {examples.length ? (
            examples.map((item: ExampleCase, index: number) => {
              const expected = item.output || item.expectedOutput || "";
              // For Test Cases, show Run output vs expected.
              // If the user ran code, compare against run result.
              const actual = runResult?.stdout ?? "";
              const hasRunResult = runStatus === "done";
              const normalizedActual = normalizeOutput(actual);
              const normalizedExpected = normalizeOutput(expected);
              const passed =
                hasRunResult && expected !== ""
                  ? normalizedActual === normalizedExpected
                  : null;

              return (
                <div
                  key={`${item.input}-${index}`}
                  className="rounded-2xl border border-ink/10 bg-white/80 p-3"
                >
                  <p className="font-medium text-ink/50 uppercase tracking-wide text-[10px]">
                    Test Case {index + 1}
                  </p>
                  <p className="mt-2 text-ink/60">Input</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">
                    {item.input}
                  </pre>
                  <p className="mt-3 text-ink/60">Expected Output</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">
                    {expected || "-"}
                  </pre>
                  <p className="mt-3 text-ink/60">Actual Output</p>
                  <pre className="mt-1 break-words whitespace-pre-wrap text-ink font-mono">
                    {hasRunResult
                      ? actual || "(empty)"
                      : "Run code to see output"}
                  </pre>
                  {passed !== null ? (
                    <span
                      className={`mt-3 inline-flex rounded-full border px-2 py-0.5 ${
                        passed
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                      }`}
                    >
                      {passed ? "Pass" : "Fail"}
                    </span>
                  ) : null}
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
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <SectionHeader
        title="Interview workspace"
        subtitle="Collaborative coding session"
        action={<Badge>Room: {roomId}</Badge>}
      />
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
