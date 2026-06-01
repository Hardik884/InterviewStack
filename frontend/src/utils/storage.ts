const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const getToken = () =>
  sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const getStoredUser = () => {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const setStoredUser = (user) => {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredUser = () => {
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY);
};
