import api from "./api";

export const loginUser = async (payload: Record<string, unknown>) => {
  const response = await api.post("/api/auth/login", payload);
  return response.data;
};

export const registerUser = async (payload: Record<string, unknown>) => {
  const response = await api.post("/api/auth/register", payload);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/api/auth/me");
  return response.data;
};
