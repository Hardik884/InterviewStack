import { useQuery } from "@tanstack/react-query";
import { fetchResumeById } from "../services/resumeService";

export const useResumeDetail = (id?: string) => {
  return useQuery({
    queryKey: ["resume", id],
    queryFn: () => fetchResumeById(id),
    enabled: Boolean(id),
  });
};
