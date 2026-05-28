import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SectionHeader from "../components/ui/SectionHeader";
import EmptyState from "../components/ui/EmptyState";
import { useResumeHistory } from "../hooks/useResumeHistory";
import { formatDate } from "../utils/format";

type ResumeHistoryItem = {
  _id: string;
  originalFilename: string;
  atsScore?: number | null;
  status: string;
  createdAt: string;
};

const ResumeHistory = () => {
  const { data } = useResumeHistory();
  const history: ResumeHistoryItem[] = data?.history || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resume history"
        subtitle="Track every AI analysis and feedback iteration."
      />

      {!history.length ? (
        <EmptyState
          title="No resumes analyzed yet"
          description="Upload a resume to start tracking your improvements."
          action={
            <Link className="text-xs font-medium text-ink" to="/resume/upload">
              Upload resume
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {history.map((item) => (
            <Card key={item._id}>
              <div className="flex items-start justify-between">
                <div>
                  <Link className="text-sm font-semibold" to={`/resume/${item._id}`}>
                    {item.originalFilename}
                  </Link>
                  <p className="mt-1 text-xs text-ink/60">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              <p className="mt-3 text-xs text-ink/60">
                ATS score: {item.atsScore ?? "-"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResumeHistory;
