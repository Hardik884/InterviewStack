import { useQuery } from "@tanstack/react-query";
import { fetchSubmissionFeedback } from "../services/submissionService";

export type AiFeedback = {
  score: number | null;
  problemSolving: string;
  codeQuality: string;
  timeComplexity: string;
  spaceComplexity: string;
  strengths: string[];
  weaknesses: string[];
  optimizationSuggestions: string[];
  interviewerNotes: string;
  generatedAt: string | null;
  status: "pending" | "generating" | "completed" | "failed" | "unavailable";
};

export const useSubmissionFeedback = (submissionId?: string | null, enabled = true) => {
  return useQuery({
    queryKey: ["feedback", submissionId],
    queryFn: () => fetchSubmissionFeedback(submissionId as string),
    enabled: Boolean(submissionId) && enabled,
    // Poll while feedback is generating
    refetchInterval: (query) => {
      const status = (query.state.data as { aiFeedback?: AiFeedback } | undefined)?.aiFeedback
        ?.status;
      if (status === "pending" || status === "generating") return 3000;
      return false;
    },
    staleTime: 30_000,
  });
};
