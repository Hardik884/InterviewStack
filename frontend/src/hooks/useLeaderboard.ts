import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "../services/analyticsService";

export const useLeaderboard = (limit = 10) => {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => fetchLeaderboard(limit),
    staleTime: 60000,
  });
};
