import { useQuery } from "@tanstack/react-query";
import { fetchSubmissionsByProblem } from "../services/submissionService";

export const useSubmissionsByProblem = (problemId?: string, roomId?: string) => {
  return useQuery({
    queryKey: ["submissions", problemId, roomId ?? null],
    queryFn: () => fetchSubmissionsByProblem(problemId as string, roomId),
    enabled: Boolean(problemId),
  });
};
