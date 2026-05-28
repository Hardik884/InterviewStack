import api from "./api";

type CreateSubmissionPayload = {
  problemId: string;
  sourceCode: string;
  language: string;
  roomId?: string;
};

export const createSubmission = async (payload: CreateSubmissionPayload) => {
  const response = await api.post("/api/submissions", payload);
  return response.data;
};

export const fetchSubmissionsByProblem = async (problemId: string) => {
  const response = await api.get(`/api/submissions/problem/${problemId}`);
  return response.data;
};

export const fetchMySubmissions = async () => {
  const response = await api.get("/api/submissions/me");
  return response.data;
};
