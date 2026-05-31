import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { clearToken, clearStoredUser, getToken } from "../utils/storage";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout to catch hung requests
});

// Attach JWT on every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally: clear credentials and redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      clearStoredUser();
      // Only redirect if not already on an auth page.
      if (!window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
