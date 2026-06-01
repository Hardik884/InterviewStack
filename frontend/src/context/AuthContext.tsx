import { createContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, loginUser, registerUser } from "../services/authService";
import { disconnectSocket } from "../sockets/socketClient";
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
} from "../utils/storage";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const hydrate = async () => {
      if (!token) {
        if (isActive) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const data = await getCurrentUser();
        if (!isActive) return;
        const resolvedUser = data?.user ?? data;
        setStoredUser(resolvedUser);
        setUser(resolvedUser);
      } catch (error) {
        if (!isActive) return;
        clearToken();
        clearStoredUser();
        setTokenState(null);
        setUser(null);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    hydrate();

    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== "auth_token") return;
      const sessionToken = sessionStorage.getItem("auth_token");
      const nextToken = event.newValue;

      if (!sessionToken) return;

      if (!nextToken || nextToken !== sessionToken) {
        sessionStorage.removeItem("auth_token");
        sessionStorage.removeItem("auth_user");
        setTokenState(null);
        setUser(null);
        disconnectSocket();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleAuthSuccess = (data) => {
    disconnectSocket();
    setToken(data.token);
    setStoredUser(data.user);
    setTokenState(data.token);
    setUser(data.user);
  };

  const login = async (payload) => {
    const data = await loginUser(payload);
    handleAuthSuccess(data);
  };

  const register = async (payload) => {
    const data = await registerUser(payload);
    handleAuthSuccess(data);
  };

  const logout = () => {
    clearToken();
    clearStoredUser();
    setTokenState(null);
    setUser(null);
    disconnectSocket();
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
