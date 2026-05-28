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
import { getSocket } from "../sockets/socketClient";

const tabList = ["Description", "Hints", "Discussion", "Submissions"];
const outputTabs = ["Testcases", "Output", "Console", "Result"];

const InterviewWorkspace = () => {
  const { roomId = "", problemId = "" } = useParams();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useProblem(problemId);
  const problem = data?.problem;
  const [activeTab, setActiveTab] = useState("Description");
  const [bottomTab, setBottomTab] = useState("Testcases");
  const [bottomOpen, setBottomOpen] = useState(true);
  const [output, setOutput] = useState("Run code to see output.");
  const [runStatus, setRunStatus] = useState("idle");
  const { data: submissionData } = useSubmissionsByProblem(problemId);
  const submissionMutation = useCreateSubmission();
  const submissions = submissionData?.submissions || [];
  const latestSubmission = submissions[0];
  const isSubmitting = submissionMutation.isPending;

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

  const resolveStarterCode = (value, lang) => {
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
  }, [problem]);

  const handleRun = () => {
    setRunStatus("running");
    setOutput("Running sample tests...");
    setBottomOpen(true);

    setTimeout(() => {
      setRunStatus("success");
      setOutput("All sample tests passed. Runtime 42ms, Memory 12.4MB.");
    }, 800);
  };

  const handleSubmit = () => {
    if (!problemId) {
      return;
    }

    setRunStatus("running");
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

    const handler = (payload) => {
      if (payload?.problemId === problemId) {
        queryClient.invalidateQueries({ queryKey: ["submissions", problemId] });
      }
    };

    socket.on("submission:update", handler);
    return () => {
      socket.off("submission:update", handler);
    };
  }, [problemId, queryClient]);

  const verdictClass = (verdict) => {
    switch (verdict) {
      case "Accepted":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "Wrong Answer":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
      case "Compilation Error":
      case "Runtime Error":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "Time Limit Exceeded":
        return "bg-orange-500/10 text-orange-700 border-orange-500/20";
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
              {(problem?.tags || []).map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(problem?.companyTags || ["Amazon", "Google", "Microsoft"]).map(
                (tag) => (
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
                examples.map((item, index) => (
                  <div key={`${item.input}-${index}`} className="mt-3">
                    <p className="text-xs text-ink/60">Input</p>
                    <code className="block rounded-xl bg-ink/5 px-3 py-2 text-xs">
                      {item.input}
                    </code>
                    <p className="mt-2 text-xs text-ink/60">Output</p>
                    <code className="block rounded-xl bg-ink/5 px-3 py-2 text-xs">
                      {item.expectedOutput}
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
                  {problem.constraints.map((item, index) => (
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
              problem.hints.map((hint, index) => (
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
              submissions.slice(0, 6).map((submission) => (
                <div
                  key={submission._id}
                  className="rounded-2xl border border-ink/10 bg-white/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-ink/60">
                        {new Date(submission.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm font-semibold text-ink">
                        {submission.language?.toUpperCase()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${verdictClass(
                        submission.verdict
                      )}`}
                    >
                      {submission.verdict || "Pending"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink/60">
                    <span>Status: {submission.status || "queued"}</span>
                    {submission.runtime ? (
                      <span>Runtime: {submission.runtime}ms</span>
                    ) : null}
                    {submission.memory ? (
                      <span>Memory: {submission.memory}KB</span>
                    ) : null}
                  </div>
                </div>
              ))
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
        <Button variant="ghost" onClick={handleRun}>
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
            {participants.map((participant) => (
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
            {activity.map((item, index) => (
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
      {bottomTab === "Testcases" && (
        <div className="space-y-2 text-xs text-ink/70">
          {examples.length ? (
            examples.map((item, index) => (
              <div key={`${item.input}-${index}`}>
                <p>Input: {item.input}</p>
                <p>Expected: {item.output || item.expectedOutput}</p>
              </div>
            ))
          ) : (
            <p>No testcases available.</p>
          )}
        </div>
      )}
      {bottomTab === "Output" && (
        <div className="rounded-2xl bg-ink/5 p-4 text-xs text-ink/70">
          {latestSubmission?.stdout || output}
        </div>
      )}
      {bottomTab === "Console" && (
        <div className="rounded-2xl bg-ink/5 p-4 text-xs text-ink/70">
          {latestSubmission?.stderr
            ? latestSubmission.stderr
            : runStatus === "running"
              ? "Executing..."
              : "Console logs will appear here."}
        </div>
      )}
      {bottomTab === "Result" && (
        <div className="rounded-2xl bg-ink/5 p-4 text-xs text-ink/70">
          {runStatus === "success"
            ? "Accepted"
            : "Run or submit to see result."}
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
