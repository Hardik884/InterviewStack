import { useQuery } from "@tanstack/react-query";
import { fetchProblemById } from "../services/problemService";

export const useProblem = (id: string | undefined) => {
  return useQuery({
    queryKey: ["problem", id],
    queryFn: () => id ? fetchProblemById(id) : Promise.reject("No id"),
    enabled: Boolean(id),
  });
};
