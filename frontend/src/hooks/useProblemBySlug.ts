import { useQuery } from "@tanstack/react-query";
import { fetchProblemBySlug } from "../services/problemService";

export const useProblemBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ["problem", slug],
    queryFn: () => slug ? fetchProblemBySlug(slug) : Promise.reject("No slug"),
    enabled: Boolean(slug),
  });
};
