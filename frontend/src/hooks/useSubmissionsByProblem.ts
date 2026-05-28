import { useQuery } from "@tanstack/react-query";
import { fetchSubmissionsByProblem } from "../services/submissionService";

export const useSubmissionsByProblem = (problemId?: string) => {
  return useQuery({
    queryKey: ["submissions", problemId],
    queryFn: () => fetchSubmissionsByProblem(problemId as string),
    enabled: Boolean(problemId),
  });
};
