import { useQuery } from "@tanstack/react-query";
import { fetchProblemById } from "../services/problemService";

export const useProblem = (id) => {
  return useQuery({
    queryKey: ["problem", id],
    queryFn: () => fetchProblemById(id),
    enabled: Boolean(id),
  });
};
