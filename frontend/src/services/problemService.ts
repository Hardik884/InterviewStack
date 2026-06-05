import api from "./api";

export const fetchProblems = async (params?: Record<string, string | number>) => {
  const response = await api.get("/api/problems", { params });
  return response.data;
};

export const fetchProblemById = async (id: string) => {
  const response = await api.get(`/api/problems/${id}`);
  return response.data;
};

export const fetchProblemBySlug = async (slug: string) => {
  const response = await api.get(`/api/problems/slug/${slug}`);
  return response.data;
};
