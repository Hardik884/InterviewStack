import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, type Variants } from "framer-motion";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
import { useDashboard } from "../hooks/useDashboard";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { formatDate, formatNumber } from "../utils/format";

const PIE_COLORS = ["#ff6a3d", "#1d4e89", "#16a34a", "#d97706"];

const buildActivitySeries = (items: Array<{ createdAt: string }>) => {
  const days = 14;
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = new Date(item.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from({ length: days }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i - 1));
    const label = date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    return { date: label, submissions: counts.get(label) || 0 };
  });
};

const buildHeatmap = (items: Array<{ createdAt: string }>) => {
  const days = 28;
  const counts: Record<string, number> = {};
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

const verdictVariant = (verdict: string) => {
  const v = (verdict || "").toLowerCase();
  if (v === "accepted") return "success";
  if (v === "pending") return "info";
  if (v.includes("error") || v.includes("wrong")) return "danger";
  return "default";
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

const Dashboard = () => {
  const { data, isLoading } = useDashboard();
  const { data: leaderboardData } = useLeaderboard(5);

  const solvedByDifficulty = data?.solvedByDifficulty || {};
  const submissionStats = data?.submissionStats || {};
  const recent = data?.recentActivity || [];

  const difficultyChart = Object.entries(solvedByDifficulty).map(([name, value]) => ({
    name: String(name).charAt(0).toUpperCase() + String(name).slice(1),
    value,
  }));
  const verdictChart = Object.entries(submissionStats).map(([name, value]) => ({
    name,
    value,
  }));
  const activitySeries = buildActivitySeries(recent);
  const heatmap = buildHeatmap(recent);

  const accuracy = data?.totalSubmissions
    ? Math.round((data.totalSolved / data.totalSubmissions) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Performance overview"
        subtitle="Track your daily momentum and system-wide benchmarks."
      />

      {/* ── Stats ── */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} animate={false}>
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-7 w-12" />
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 md:grid-cols-4"
        >
          <motion.div variants={fadeUp}>
            <StatCard
              index={0}
              title="Total submissions"
              value={formatNumber(data?.totalSubmissions)}
              subtitle="All attempts"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <StatCard
              index={1}
              title="Problems solved"
              value={formatNumber(data?.totalSolved)}
              subtitle="Distinct accepted"
              accent
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <StatCard
              index={2}
              title="Accuracy"
              value={`${accuracy}%`}
              subtitle="Accepted / attempts"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <StatCard
              index={3}
              title="Latest verdict"
              value={recent[0]?.verdict || "—"}
              subtitle="Most recent"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ── Charts row 1 ── */}
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Submission momentum" subtitle="Last 14 days">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activitySeries} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,34,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(28,26,34,0.4)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(28,26,34,0.4)" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(28,26,34,0.08)",
                    boxShadow: "0 4px 16px rgba(28,26,34,0.08)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="submissions"
                  stroke="#1d4e89"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#1d4e89" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Leaderboard" subtitle="Top performers">
          <div className="space-y-3">
            {(leaderboardData?.leaderboard || []).map((entry: Record<string, unknown> & { userId: string, rank: number, name: string, solvedCount: number }, i: number) => (
              <motion.div
                key={String(entry.userId)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-ink/30 w-5 shrink-0">#{entry.rank}</span>
                  <span className="font-medium truncate">{entry.name}</span>
                </div>
                <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink/70">
                  {entry.solvedCount}
                </span>
              </motion.div>
            ))}
            {!leaderboardData?.leaderboard?.length && (
              <EmptyState
                title="No leaderboard data"
                description="Solve more problems to appear on the leaderboard."
              />
            )}
          </div>
        </Card>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card title="Solved by difficulty" subtitle="Accepted only">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={difficultyChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {difficultyChart.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,26,34,0.08)", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Verdict distribution" subtitle="All submissions">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verdictChart} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,34,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(28,26,34,0.4)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(28,26,34,0.4)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,26,34,0.08)", fontSize: 12 }}
                />
                <Bar dataKey="value" fill="#1d4e89" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Activity heatmap" subtitle="Last 28 days">
          <div className="grid grid-cols-7 gap-1.5">
            {heatmap.map((cell) => {
              const shade =
                cell.count === 0
                  ? "bg-ink/8"
                  : cell.count === 1
                  ? "bg-accent/30"
                  : cell.count <= 3
                  ? "bg-accent/60"
                  : "bg-accent";

              return (
                <motion.div
                  key={cell.key}
                  className={`h-5 rounded ${shade} cursor-default`}
                  title={`${cell.key} · ${cell.count} submission${cell.count !== 1 ? "s" : ""}`}
                  whileHover={{ scale: 1.2 }}
                  transition={{ duration: 0.1 }}
                />
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Recent activity ── */}
      <Card title="Recent submissions" subtitle="Your latest attempts">
        {recent.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Start solving problems to see your activity here."
          />
        ) : (
          <div className="divide-y divide-ink/5">
            {recent.map((activity: Record<string, unknown> & { _id: string, problemId?: { title: string }, language: string, createdAt: string, verdict: string }, i: number) => (
              <motion.div
                key={String(activity._id)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">
                    {activity.problemId?.title || "Unknown problem"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {activity.language} · {formatDate(activity.createdAt)}
                  </p>
                </div>
                <Badge variant={verdictVariant(activity.verdict)}>
                  {activity.verdict}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
