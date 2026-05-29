import { useMutation } from "@tanstack/react-query";
import { runSubmission } from "../services/submissionService";

export const useRunSubmission = () => {
  return useMutation({
    mutationFn: runSubmission,
  });
};
