import axios from "axios";

const devBaseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseURL = import.meta.env.DEV ? devBaseURL : "/api";

const getUserId = () => {
  try {
    const existing = localStorage.getItem("ongoing_user_id");
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("ongoing_user_id", generated);
    return generated;
  } catch (err) {
    return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const api = axios.create({
  baseURL,
});

api.defaults.headers.common["x-user-id"] = getUserId();

export default api;
