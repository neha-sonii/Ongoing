import axios from "axios";

const devBaseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseURL = import.meta.env.DEV ? devBaseURL : "/api";

export default axios.create({
  baseURL,
});
