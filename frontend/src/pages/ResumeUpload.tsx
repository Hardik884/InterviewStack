import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import ProgressBar from "../components/ui/ProgressBar";
import SectionHeader from "../components/ui/SectionHeader";
import { uploadResume } from "../services/resumeService";
import { useResumeStatus } from "../hooks/useResumeStatus";
import toast from "react-hot-toast";

const ResumeUpload = () => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const { data: statusData } = useResumeStatus(jobId);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF resume");
      return;
    }

    setError("");
    setLoading(true);
    setProgress(0);

    try {
      const data = await uploadResume({
        file,
        onProgress: setProgress,
      });
      setJobId(data.jobId);
      setAnalysisId(data.analysisId);
      toast.success("Resume uploaded. Analysis started.");
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resume analyzer"
        subtitle="Upload a resume and get ATS-focused feedback in minutes."
        action={
          <Link className="text-xs font-medium text-ink" to="/resume/history">
            View history
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Upload resume" subtitle="PDF only, max 5MB">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink/20 bg-white/60 px-6 py-10 text-center"
          >
            <p className="text-sm font-semibold">Drag and drop PDF</p>
            <p className="text-xs text-ink/60">
              or click to browse from your device
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              aria-label="Resume PDF"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <Button variant="ghost" onClick={() => inputRef.current?.click()}>
              Select file
            </Button>
          </div>

          {file ? (
            <p className="mt-3 text-xs text-ink/60">
              Selected: {file.name}
            </p>
          ) : null}

          {progress > 0 ? (
            <div className="mt-4 space-y-2">
              <ProgressBar value={progress} />
              <p className="text-xs text-ink/60">Upload {progress}%</p>
            </div>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}

          <div className="mt-4">
            <Button variant="accent" onClick={handleUpload} disabled={loading}>
              {loading ? "Uploading..." : "Upload & analyze"}
            </Button>
          </div>
        </Card>

        <Card title="Analysis status">
          {jobId ? (
            <div className="space-y-2 text-sm">
              <p>Job ID: {jobId}</p>
              <p>Status: {statusData?.status || "queued"}</p>
              {analysisId ? <p>Analysis ID: {analysisId}</p> : null}
              {statusData?.status === "completed" ? (
                <p className="text-xs text-ink/60">
                  <Link className="font-medium text-ink" to={`/resume/${analysisId}`}>
                    Open the resume detail page
                  </Link>
                  {" "}to view AI feedback.
                </p>
              ) : null}
            </div>
          ) : (
            <Loader label="Upload a resume to start analysis." />
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResumeUpload;
