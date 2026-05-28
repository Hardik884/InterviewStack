import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../services/analyticsService";

export const useDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });
};
