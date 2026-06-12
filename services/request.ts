import axios, { type InternalAxiosRequestConfig } from "axios";
import {
  API_BASE,
  DEFAULT_TIMEOUT_MS,
  USER_ID_HEADER,
} from "@/config/api";
import { getToken, getUserInfo, isAccessTokenExpired } from "@/utils/auth";
import {
  ApiError,
  createApiErrorFromBody,
  createTimeoutError,
} from "@/utils/apiError";
import { handleAuthFailure, refreshAccessToken } from "@/services/tokenRefresh";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const request = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
});

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register")
  );
}

function getCurrentUserId(): number | null {
  return getUserInfo()?.userId ?? null;
}

request.interceptors.request.use(async (config) => {
  let token = getToken();
  const userId = getCurrentUserId();

  if (token && isAccessTokenExpired() && !isAuthEndpoint(config.url)) {
    const newToken = await refreshAccessToken();
    token = newToken || token;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (userId) {
    config.headers[USER_ID_HEADER] = String(userId);
  }

  return config;
});

request.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && "code" in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const config = error.config as RetryConfig | undefined;
    if (error.code === "ECONNABORTED") {
      return Promise.reject(createTimeoutError());
    }

    const apiError = createApiErrorFromBody(
      error.response?.data,
      error.message || "请求失败",
      status
    );

    if (
      status === 401 &&
      config &&
      !config._retry &&
      !isAuthEndpoint(config.url)
    ) {
      config._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return request(config);
      }

      handleAuthFailure();
      return Promise.reject(apiError);
    }

    if (status === 401) {
      handleAuthFailure();
    }

    return Promise.reject(apiError);
  }
);

export default request;
export { ApiError };
