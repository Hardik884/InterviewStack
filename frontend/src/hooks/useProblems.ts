import { useQuery } from "@tanstack/react-query";
import { fetchProblems } from "../services/problemService";

type ProblemQuery = {
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
    keepPreviousData: true,
  });
};
