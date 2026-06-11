import axios, { type InternalAxiosRequestConfig } from "axios";
import { getToken, isAccessTokenExpired } from "@/utils/auth";
import { handleAuthFailure, refreshAccessToken } from "@/services/tokenRefresh";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const request = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 10000,
});

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  return url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/register");
}

// 请求前：accessToken 快过期时静默刷新
request.interceptors.request.use(async (config) => {
  let token = getToken();

  if (token && isAccessTokenExpired() && !isAuthEndpoint(config.url)) {
    const newToken = await refreshAccessToken();
    token = newToken || token;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：解包后端统一格式 { data, message, code }
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
    const message =
      error.response?.data?.message || error.message || "请求失败";
    const config = error.config as RetryConfig | undefined;

    // 401：尝试 refresh 后重试原请求，refresh 失败再跳登录
    if (status === 401 && config && !config._retry && !isAuthEndpoint(config.url)) {
      config._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return request(config);
      }

      handleAuthFailure();
      return Promise.reject(new Error(message));
    }

    if (status === 401) {
      handleAuthFailure();
    }

    return Promise.reject(new Error(message));
  }
);

export default request;
