import { useQuery } from "@tanstack/react-query";
import { fetchResumeStatus } from "../services/resumeService";

export const useResumeStatus = (jobId?: string) => {
  return useQuery({
    queryKey: ["resume-status", jobId],
    queryFn: () => jobId ? fetchResumeStatus(jobId) : Promise.reject("No jobId"),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      if (!data) {
        return 3000;
      }

      return data.status === "completed" || data.status === "failed" ? false : 3000;
    },
  });
};
