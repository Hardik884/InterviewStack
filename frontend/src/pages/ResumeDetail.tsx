import { useParams } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";
import { useResumeDetail } from "../hooks/useResumeDetail";

const ResumeDetail = () => {
  const { id } = useParams();
  const { data, isLoading } = useResumeDetail(id);

  if (isLoading) {
    return <p className="text-sm text-ink/60">Loading analysis...</p>;
  }

  const analysis = data?.analysis;
  if (!analysis) {
    return <p className="text-sm text-ink/60">Resume analysis not found.</p>;
  }

  const feedback = analysis.aiFeedback || {};

  return (
    <div className="space-y-6">
      <SectionHeader
        title={analysis.originalFilename}
        subtitle="AI-generated resume insights"
        action={<Badge>Status: {analysis.status}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="ATS score"
          value={analysis.atsScore ?? "-"}
          subtitle="Target 75+"
        />
        <StatCard
          title="Strengths"
          value={(feedback.strengths || []).length}
          subtitle="Key highlights"
        />
        <StatCard
          title="Gaps"
          value={(feedback.missingKeywords || []).length}
          subtitle="Missing keywords"
        />
      </div>

      <Card title="Interview readiness">
        <p className="text-sm text-ink/70">
          {feedback.interviewReadiness || "Pending analysis results."}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Strengths">
          {(feedback.strengths || []).length ? (
            <ul className="list-disc pl-4 text-sm text-ink/70">
              {(feedback.strengths || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No strengths returned yet" />
          )}
        </Card>

        <Card title="Weaknesses">
          {(feedback.weaknesses || []).length ? (
            <ul className="list-disc pl-4 text-sm text-ink/70">
              {(feedback.weaknesses || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No weaknesses returned yet" />
          )}
        </Card>
      </div>

      <Card title="Missing keywords">
        <div className="flex flex-wrap gap-2">
          {(feedback.missingKeywords || []).map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
          {!feedback.missingKeywords?.length && (
            <span className="text-xs text-ink/60">No gaps detected.</span>
          )}
        </div>
      </Card>

      <Card title="Improvement suggestions">
        <ul className="list-disc pl-4 text-sm text-ink/70">
          {(feedback.improvementSuggestions || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default ResumeDetail;
