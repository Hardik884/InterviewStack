import api from "./api";

export const fetchProblems = async (params) => {
  const response = await api.get("/api/problems", { params });
  return response.data;
};

export const fetchProblemById = async (id) => {
  const response = await api.get(`/api/problems/${id}`);
  return response.data;
};

export const fetchProblemBySlug = async (slug) => {
  const response = await api.get(`/api/problems/slug/${slug}`);
  return response.data;
};
