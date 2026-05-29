import { useEffect, useMemo, useState } from "react";
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

type RunResult = {
  stdout?: string;
  stderr?: string;
  runtime?: number | null;
  memory?: number | null;
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
  const [output, setOutput] = useState("Run code to see output.");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState("");
  const { data: submissionData } = useSubmissionsByProblem(problemId);
  const submissionMutation = useCreateSubmission();
  const runMutation = useRunSubmission();
  const submissions = (submissionData?.submissions || []) as SubmissionItem[];
  const latestSubmission = submissions[0];
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

  const resolveStarterCode = (value: string | Record<string, string> | undefined, lang: string) => {
    if (!value) {
      return "// Start coding\n";
    }

    if (typeof value === "string") {
      return value;
    }

    return value[lang] || value.javascript || "// Start coding\n";
  };

  const {
    code,
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
    defaultCode: resolveStarterCode(problem?.starterCode, "javascript"),
    remoteUpdate,
    sendCodeUpdate,
    updateTyping,
  });

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

  const handleRun = () => {
    if (!problemId) {
      return;
    }

    const sampleInput = examples?.[0]?.input || "";

    setRunError("");
    setOutput("Running sample input...");
    setBottomOpen(true);
    setBottomTab("Output");

    runMutation.mutate(
      {
        problemId,
        sourceCode: code,
        language,
        input: sampleInput,
      },
      {
        onSuccess: (data) => {
          setRunResult(data?.result || null);
          setOutput(data?.result?.stdout || "No output.");
        },
        onError: (error) => {
          setRunResult(null);
          setRunError(error?.message || "Run failed");
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!problemId) {
      return;
    }

    setOutput("Submission queued. Await verdict.");
    setBottomOpen(true);

    submissionMutation.mutate({
      problemId,
      sourceCode: code,
      language,
      roomId,
    });
  };

  const shareLink = `${window.location.origin}/interview/${roomId}/${problemId}`;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handler = (payload: { problemId?: string }) => {
      if (payload?.problemId === problemId) {
        queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
      }
    };

    socket.on("submission:update", handler);
    return () => {
      socket.off("submission:update", handler);
    };
  }, [problemId, queryClient]);

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

  const normalizeOutput = (value?: string) =>
    String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

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
              {(problem?.companyTags || ["Amazon", "Google", "Microsoft"]).map(
                (tag: string) => (
                  <Badge key={tag}>{tag}</Badge>
                )
              )}
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
            onChange={(event) => changeLanguage(event.target.value)}
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
        <Button variant="ghost" onClick={handleRun} disabled={isRunning}>
          Run Code
        </Button>
        <Button variant="accent" onClick={handleSubmit} disabled={isSubmitting}>
          Submit Solution
        </Button>
        {typingLabel ? (
          <span className="text-xs text-ink/60">{typingLabel}</span>
        ) : null}
        {isSubmitting ? (
          <span className="text-xs text-ink/60">Queueing...</span>
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
      {bottomTab === "Output" && (
        <div className="rounded-2xl bg-ink/5 p-4 text-xs text-ink/70">
          {runResult?.stdout || latestSubmission?.stdout || output}
        </div>
      )}
      {bottomTab === "Error" && (
        <div className="rounded-2xl bg-ink/5 p-4 text-xs text-ink/70">
          {runError || runResult?.stderr || latestSubmission?.stderr || "No errors."}
        </div>
      )}
      {bottomTab === "Test Cases" && (
        <div className="space-y-3 text-xs text-ink/70">
          {examples.length ? (
            examples.map((item: ExampleCase, index: number) => {
              const expected = item.output || item.expectedOutput || "";
              const actual = runResult?.stdout || latestSubmission?.stdout || "";
              const normalizedActual = normalizeOutput(actual);
              const normalizedExpected = normalizeOutput(expected);
              const passed = actual ? normalizedActual === normalizedExpected : null;

              return (
                <div
                  key={`${item.input}-${index}`}
                  className="rounded-2xl border border-ink/10 bg-white/80 p-3"
                >
                  <p className="text-ink/60">Input</p>
                  <p className="mt-1 break-words text-ink">{item.input}</p>
                  <p className="mt-3 text-ink/60">Expected Output</p>
                  <p className="mt-1 break-words text-ink">
                    {expected || "-"}
                  </p>
                  <p className="mt-3 text-ink/60">Actual Output</p>
                  <p className="mt-1 break-words text-ink">
                    {actual || "Run to see output"}
                  </p>
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
            <p>No testcases available.</p>
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
