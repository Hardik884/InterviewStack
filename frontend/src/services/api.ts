import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { getToken, clearToken, clearStoredUser } from "../utils/storage";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach JWT on every request when available.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      clearStoredUser();
    }

    return Promise.reject(error);
  }
);

export default api;
