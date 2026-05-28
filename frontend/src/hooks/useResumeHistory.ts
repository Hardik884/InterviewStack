import { useQuery } from "@tanstack/react-query";
import { fetchResumeHistory } from "../services/resumeService";

export const useResumeHistory = () => {
  return useQuery({
    queryKey: ["resume-history"],
    queryFn: fetchResumeHistory,
  });
};
