import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import Loader from "../components/ui/Loader";
import DifficultyBadge from "../components/DifficultyBadge";
import TagChip from "../components/TagChip";
import { useProblemBySlug } from "../hooks/useProblemBySlug";
import { useRunSubmission } from "../hooks/useRunSubmission";
import { useCreateSubmission } from "../hooks/useCreateSubmission";
import toast from "react-hot-toast";

type RunResult = {
  stdout: string;
  stderr: string;
  runtime?: number | null;
  memory?: number | null;
};

const resolveStarterCode = (
  value: string | Record<string, string> | undefined,
  lang: string
): string => {
  if (!value) return `// Start coding here\n`;
  if (typeof value === "string") return value;
  return value[lang] || value.javascript || `// Start coding here\n`;
};

const normalizeOutput = (v?: string) =>
  String(v || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();

const ProblemDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useProblemBySlug(id);
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [activeTab, setActiveTab] = useState<"output" | "error" | "submissions">("output");

  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "queuing" | "queued">("idle");

  const codeRef = useRef("// Start coding here\n");
  const [code, setCode] = useState("// Start coding here\n");

  const problem = data?.problem;
  const runMutation = useRunSubmission();
  const submitMutation = useCreateSubmission();

  // Sync starter code when problem/language changes
  useEffect(() => {
    if (problem?.starterCode) {
      const starter = resolveStarterCode(problem.starterCode, language);
      setCode(starter);
      codeRef.current = starter;
    }
  }, [problem, language]);

  const example = useMemo(() => {
    if (problem?.examples?.length) return problem.examples[0];
    if (problem?.testCases?.length) return problem.testCases[0];
    return null;
  }, [problem]);

  const handleCodeChange = (value: string | undefined) => {
    const next = value || "";
    setCode(next);
    codeRef.current = next;
  };

  const handleRun = () => {
    const currentCode = codeRef.current;
    if (!currentCode.trim()) {
      toast.error("Please write some code before running.");
      return;
    }
    setRunStatus("running");
    setActiveTab("output");
    setRunResult(null);

    runMutation.mutate(
      {
        problemId: problem?._id || "",
        sourceCode: currentCode,
        language,
        input: example?.input || "",
      },
      {
        onSuccess: (data) => {
          const r = data?.result;
          setRunResult({
            stdout: r?.stdout ?? "",
            stderr: r?.stderr ?? "",
            runtime: r?.runtime ?? null,
            memory: r?.memory ?? null,
          });
          setRunStatus("done");
          if (r?.stderr && !r?.stdout) setActiveTab("error");
        },
        onError: (err: Error) => {
          setRunResult({ stdout: "", stderr: err.message || "Run failed.", runtime: null, memory: null });
          setRunStatus("error");
          setActiveTab("error");
        },
      }
    );
  };

  const handleSubmit = () => {
    const currentCode = codeRef.current;
    if (!currentCode.trim()) {
      toast.error("Please write some code before submitting.");
      return;
    }
    setSubmitStatus("queuing");

    // Navigate to the workspace so the full pipeline can run
    const roomId = `solo-${Math.random().toString(36).slice(2, 8)}`;
    navigate(`/interview/${roomId}/${problem?._id}`);
  };

  if (isLoading) return <Loader label="Loading problem…" />;
  if (!problem) return <p className="text-sm text-ink/60">Problem not found.</p>;

  const expected = example?.output || example?.expectedOutput || "";
  const actual = runResult?.stdout ?? "";
  const hasRun = runStatus === "done";
  const passesExample =
    hasRun && expected ? normalizeOutput(actual) === normalizeOutput(expected) : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={problem.title}
        subtitle="Solve, test, and submit in one place."
        action={<DifficultyBadge value={problem.difficulty} />}
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="accent" onClick={() => navigate(`/interview/room-${Math.random().toString(36).slice(2, 8)}/${problem._id}`)}>
          Start Interview
        </Button>
        <Button variant="ghost" onClick={handleSubmit}>
          Solve Solo
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1.6fr]">
        {/* ── Problem description ── */}
        <Card animate={false}>
          <div className="overflow-y-auto max-h-[70vh] space-y-5 text-sm text-ink/70 pr-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">Description</p>
              <p className="mt-2 text-sm text-ink/75 leading-relaxed">{problem.description}</p>
            </div>
            {problem.tags?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">Tags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {problem.tags.map((tag: string) => <TagChip key={tag} label={tag} />)}
                </div>
              </div>
            ) : null}
            {example && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">Example</p>
                <div className="mt-2 space-y-2 rounded-2xl border border-ink/8 bg-ink/2 p-3">
                  <div>
                    <p className="text-[10px] text-ink/50 font-medium">Input</p>
                    <code className="text-xs font-mono text-ink/80 whitespace-pre-wrap">{example.input}</code>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink/50 font-medium">Output</p>
                    <code className="text-xs font-mono text-ink/80">{example.output || example.expectedOutput}</code>
                  </div>
                  {example.explanation && (
                    <div>
                      <p className="text-[10px] text-ink/50 font-medium">Explanation</p>
                      <p className="text-xs text-ink/65">{example.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {problem.constraints?.length ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40">Constraints</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-ink/60">
                  {problem.constraints.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>

        {/* ── Editor ── */}
        <Card title="Editor" subtitle="Write your solution">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink/50">Language</span>
              <select
                aria-label="Select language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-full border border-ink/20 bg-white px-3 py-1 text-xs"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <button
              type="button"
              className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-ink/5 transition-colors"
              onClick={() => setTheme((t) => (t === "vs-dark" ? "light" : "vs-dark"))}
            >
              {theme === "vs-dark" ? "☀ Light" : "◑ Dark"}
            </button>
          </div>

          <Editor
            height="360px"
            theme={theme}
            language={language}
            value={code}
            onChange={handleCodeChange}
            options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false }}
          />

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              isLoading={runMutation.isPending}
              disabled={runMutation.isPending}
            >
              ▶ Run code
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleSubmit}
              isLoading={submitStatus === "queuing"}
              disabled={submitStatus === "queuing"}
            >
              Submit
            </Button>
          </div>

          {/* Console tabs */}
          <div className="mt-5 border-t border-ink/8 pt-4">
            <div className="flex gap-2 text-xs mb-3">
              {(["output", "error"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                    activeTab === tab ? "bg-ink text-white" : "border border-ink/15 text-ink/60 hover:bg-ink/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "output" && (
              <motion.div
                key="output"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-ink/3 p-3 font-mono text-xs text-ink/70 whitespace-pre-wrap min-h-[60px]"
              >
                {runStatus === "running" ? (
                  <span className="italic text-ink/40">Running…</span>
                ) : runStatus === "idle" ? (
                  <span className="italic text-ink/35">Run code to see output.</span>
                ) : runResult?.stdout ? (
                  <>
                    <div className="mb-2">{runResult.stdout}</div>
                    {runResult.runtime != null && (
                      <div className="text-ink/40">
                        Runtime: {runResult.runtime}ms
                        {runResult.memory != null ? ` · Memory: ${runResult.memory}KB` : ""}
                      </div>
                    )}
                    {passesExample !== null && expected && (
                      <div className={`mt-2 font-semibold ${passesExample ? "text-emerald-600" : "text-rose-500"}`}>
                        {passesExample ? "✓ Matches expected output" : "✗ Does not match expected"}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="italic text-ink/35">No stdout. Check the Error tab.</span>
                )}
              </motion.div>
            )}

            {activeTab === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-rose-50 border border-rose-100 p-3 font-mono text-xs text-rose-700 whitespace-pre-wrap min-h-[60px]"
              >
                {runResult?.stderr || <span className="italic text-rose-300">No errors.</span>}
              </motion.div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProblemDetails;
