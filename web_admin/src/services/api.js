import axios from "axios";
import { clearSession, getCurrentCompanyId, getToken } from "../utils/auth";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "/api";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const companyId = getCurrentCompanyId();
  if (companyId) {
    config.headers["X-Company-Id"] = String(companyId);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
    }

    return Promise.reject(error);
  }
);
