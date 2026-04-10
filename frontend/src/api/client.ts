import axios from "axios";
import { useAuthStore } from "../store/auth";
import { getApiBaseUrl } from "../lib/apiBase";

export const api = axios.create({
  baseURL: getApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
