import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchProblems } from "../services/problemService";

export type ProblemQuery = {
  page?: number;
  limit?: number;
  difficulty?: string;
  tags?: string;
  search?: string;
  sort?: string;
};

export const useProblems = (params: ProblemQuery) => {
  return useQuery({
    queryKey: ["problems", params],
    queryFn: () => fetchProblems(params),
    placeholderData: keepPreviousData,
  });
};
