import api from "./api";

export const fetchDashboard = async () => {
  const response = await api.get("/api/analytics/dashboard");
  return response.data;
};

export const fetchLeaderboard = async (limit = 10) => {
  const response = await api.get("/api/analytics/leaderboard", {
    params: { limit },
  });
  return response.data;
};

export const fetchActivity = async () => {
  const response = await api.get("/api/analytics/activity");
  return response.data;
};
