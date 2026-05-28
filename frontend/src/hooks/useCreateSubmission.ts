import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSubmission } from "../services/submissionService";

export const useCreateSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubmission,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["submissions", variables.problemId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
