import axios, { type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "../stores/auth";
import type { ApiError } from "../types/api";

const baseURL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_BASE_URL || "https://greenhouse-be.alieexe.my.id";

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<void> | null = null;

const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableConfig | undefined;
    const url = originalRequest?.url ?? "";

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      NO_REFRESH_PATHS.some((path) => url.startsWith(path))
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${baseURL}/auth/refresh`, undefined, {
          withCredentials: true,
        })
        .then(() => {})
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      await refreshPromise;
      return http(originalRequest);
    } catch (refreshError) {
      useAuthStore().clearSession();

      if (url !== "/auth/check") {
        redirectToLogin();
      }

      return Promise.reject(refreshError);
    }
  },
);

export function getApiError(err: unknown): string {
  if (err && typeof err === "object") {
    const error = err as {
      response?: { data?: Partial<ApiError> };
      message?: unknown;
    };
    const message = error.response?.data?.message;

    if (typeof message === "string" && message) {
      return message;
    }

    if (typeof error.message === "string" && error.message) {
      return error.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export default http;
