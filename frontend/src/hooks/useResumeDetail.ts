import { useQuery } from "@tanstack/react-query";
import { fetchResumeById } from "../services/resumeService";

export const useResumeDetail = (id?: string) => {
  return useQuery({
    queryKey: ["resume", id],
    queryFn: () => id ? fetchResumeById(id) : Promise.reject("No id"),
    enabled: Boolean(id),
    // Poll every 4 seconds while still pending or processing
    refetchInterval: (query) => {
      const data = query.state.data as { analysis?: { status?: string } } | undefined;
      const status = data?.analysis?.status;
      if (!status) return 4000;
      return status === "completed" || status === "failed" ? false : 4000;
    },
  });
};
