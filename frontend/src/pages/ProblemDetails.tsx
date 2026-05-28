import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import Loader from "../components/ui/Loader";
import DifficultyBadge from "../components/DifficultyBadge";
import TagChip from "../components/TagChip";
import { useProblemBySlug } from "../hooks/useProblemBySlug";

const ProblemDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useProblemBySlug(id);
  const [code, setCode] = useState("// Start coding here\n");
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");
  const [activeTab, setActiveTab] = useState("output");
  const [output, setOutput] = useState("Run code to see output.");

  const problem = data?.problem;

  const resolveStarterCode = (value, lang) => {
    if (!value) {
      return "// Start coding here\n";
    }

    if (typeof value === "string") {
      return value;
    }

    return value[lang] || value.javascript || "// Start coding here\n";
  };

  useEffect(() => {
    if (problem?.starterCode) {
      setCode(resolveStarterCode(problem.starterCode, language));
    }
  }, [problem, language]);

  const example = useMemo(() => {
    if (problem?.examples?.length) {
      return problem.examples[0];
    }

    if (problem?.testCases?.length) {
      return problem.testCases[0];
    }

    return null;
  }, [problem]);

  if (isLoading) {
    return <Loader label="Loading problem" />;
  }

  if (!problem) {
    return <p className="text-sm text-ink/60">Problem not found.</p>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={problem.title}
        subtitle="Solve, test, and submit in one place."
        action={<DifficultyBadge value={problem.difficulty} />}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          variant="accent"
          onClick={() =>
            navigate(`/interview/room-${Math.random().toString(36).slice(2, 8)}/${problem._id}`)
          }
        >
          Start Interview
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            navigate(`/interview/solo-${Math.random().toString(36).slice(2, 8)}/${problem._id}`)
          }
        >
          Solve Solo
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1.6fr_1fr]">
        <Card>
          <div className="space-y-4 text-sm text-ink/70">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Description
              </p>
              <p className="mt-2 text-sm text-ink/80">{problem.description}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(problem.tags || []).map((tag) => (
                  <TagChip key={tag} label={tag} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Example
              </p>
              {example ? (
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs text-ink/60">Input</p>
                    <code className="text-xs text-ink/80">{example.input}</code>
                  </div>
                  <div>
                    <p className="text-xs text-ink/60">Output</p>
                    <code className="text-xs text-ink/80">
                      {example.output || example.expectedOutput}
                    </code>
                  </div>
                  {example.explanation ? (
                    <div>
                      <p className="text-xs text-ink/60">Explanation</p>
                      <p className="text-xs text-ink/70">
                        {example.explanation}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink/60">No examples yet.</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Constraints
              </p>
              {problem.constraints?.length ? (
                <ul className="mt-2 list-disc pl-4 text-xs text-ink/60">
                  {problem.constraints.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 list-disc pl-4 text-xs text-ink/60">
                  <li>Time complexity target: optimize where possible.</li>
                  <li>Handle edge cases and empty inputs.</li>
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card title="Editor" subtitle="Realtime ready">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Language</span>
              <select
                aria-label="Select language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-full border border-ink/20 bg-white px-3 py-1"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink/60">Theme</span>
              <button
                type="button"
                className="rounded-full border border-ink/20 px-3 py-1"
                onClick={() =>
                  setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"))
                }
              >
                {theme === "vs-dark" ? "Dark" : "Light"}
              </button>
            </div>
          </div>
          <Editor
            height="420px"
            theme={theme}
            language={language}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => setOutput("All sample tests passed.")}
            >
              Run code
            </Button>
            <Button
              variant="accent"
              onClick={() => setOutput("Submission queued. Await verdict.")}
            >
              Submit
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Participants">
            <div className="space-y-2 text-xs text-ink/60">
              <p>Solo session</p>
              <p>Add collaborators from the Rooms page.</p>
            </div>
          </Card>
          <Card title="Session">
            <div className="space-y-2 text-xs text-ink/60">
              <p>Room: private solo</p>
              <p>Participants: 1</p>
              <Badge>Realtime sync ready</Badge>
            </div>
          </Card>
          <Card title="Room activity">
            <p className="text-xs text-ink/60">No activity yet.</p>
          </Card>
          <Card title="Console">
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  activeTab === "output"
                    ? "bg-ink text-white"
                    : "border border-ink/20"
                }`}
                onClick={() => setActiveTab("output")}
              >
                Output
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${
                  activeTab === "submissions"
                    ? "bg-ink text-white"
                    : "border border-ink/20"
                }`}
                onClick={() => setActiveTab("submissions")}
              >
                Submissions
              </button>
            </div>
            {activeTab === "output" ? (
              <p className="mt-3 text-xs text-ink/70">{output}</p>
            ) : (
              <div className="mt-3 space-y-2 text-xs text-ink/60">
                <p>No submissions yet.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProblemDetails;
