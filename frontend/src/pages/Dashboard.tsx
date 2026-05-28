import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
import { useDashboard } from "../hooks/useDashboard";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { formatDate, formatNumber } from "../utils/format";

const buildActivitySeries = (items) => {
  const days = 14;
  const result = [];
  const counts = new Map();
  items.forEach((item) => {
    const dateKey = new Date(item.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
  });

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
    result.push({ date: label, submissions: counts.get(label) || 0 });
  }

  return result;
};

const buildHeatmap = (items) => {
  const days = 28;
  const counts = {};
  items.forEach((item) => {
    const key = new Date(item.createdAt).toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  });

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    const key = date.toISOString().slice(0, 10);
    return { key, count: counts[key] || 0 };
  });
};

const Dashboard = () => {
  const { data, isLoading } = useDashboard();
  const { data: leaderboardData } = useLeaderboard(5);

  const solvedByDifficulty = data?.solvedByDifficulty || {};
  const submissionStats = data?.submissionStats || {};
  const recent = data?.recentActivity || [];

  const difficultyChart = Object.entries(solvedByDifficulty).map(
    ([key, value]) => ({ name: key, value })
  );
  const verdictChart = Object.entries(submissionStats).map(([key, value]) => ({
    name: key,
    value,
  }));

  const activitySeries = buildActivitySeries(recent);
  const heatmap = buildHeatmap(recent);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Your performance overview"
        subtitle="Track daily momentum and system-wide benchmarks."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`stat-${index}`}>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total submissions"
            value={formatNumber(data?.totalSubmissions)}
            subtitle="All attempts"
          />
          <StatCard
            title="Problems solved"
            value={formatNumber(data?.totalSolved)}
            subtitle="Accepted distinct"
          />
          <StatCard
            title="Accuracy"
            value={`${
              data?.totalSubmissions
                ? Math.round((data.totalSolved / data.totalSubmissions) * 100)
                : 0
            }%`}
            subtitle="Solved / attempts"
          />
          <StatCard
            title="Latest verdict"
            value={recent[0]?.verdict || "-"}
            subtitle="Most recent"
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Submission momentum" subtitle="Last 14 days">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activitySeries} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="submissions"
                  stroke="#1d4e89"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Leaderboard" subtitle="Top performers">
          <div className="space-y-3">
            {(leaderboardData?.leaderboard || []).map((entry) => (
              <div
                key={entry.userId}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  #{entry.rank} {entry.name}
                </span>
                <span className="font-medium">{entry.solvedCount}</span>
              </div>
            ))}
            {!leaderboardData?.leaderboard?.length && (
              <EmptyState
                title="No leaderboard data"
                description="Solve more problems to climb rankings."
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card title="Solved breakdown" subtitle="Accepted by difficulty">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={difficultyChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={35}
                  outerRadius={65}
                  fill="#ff6a3d"
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Submission stats" subtitle="Verdict distribution">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verdictChart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1d4e89" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Submission heatmap" subtitle="Last 28 days">
          <div className="grid grid-cols-7 gap-2">
            {heatmap.map((cell) => {
              const shade =
                cell.count === 0
                  ? "bg-ink/10"
                  : cell.count === 1
                  ? "bg-accent/40"
                  : "bg-accent";

              return (
                <div
                  key={cell.key}
                  className={`h-6 rounded-md ${shade}`}
                  title={`${cell.key} · ${cell.count} submissions`}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Recent submissions" subtitle="Latest attempts">
        <div className="space-y-3">
          {recent.map((activity) => (
            <div
              key={activity._id}
              className="flex items-center justify-between border-b border-ink/5 pb-3 text-sm last:border-b-0"
            >
              <div>
                <p className="font-medium">{activity.problemId?.title}</p>
                <p className="text-xs text-ink/60">
                  {activity.language} · {formatDate(activity.createdAt)}
                </p>
              </div>
              <Badge>{activity.verdict}</Badge>
            </div>
          ))}
          {!recent.length && (
            <EmptyState
              title="No submissions yet"
              description="Start solving problems to see activity here."
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
