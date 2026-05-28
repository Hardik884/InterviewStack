import { useQuery } from "@tanstack/react-query";
import { fetchProblemBySlug } from "../services/problemService";

export const useProblemBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ["problem", slug],
    queryFn: () => fetchProblemBySlug(slug),
    enabled: Boolean(slug),
  });
};
