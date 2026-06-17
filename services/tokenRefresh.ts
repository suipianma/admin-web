import axios from "axios";
import { API_BASE } from "@/config/api";
import { clearAuth, getRefreshToken, setToken } from "@/utils/auth";

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function flushQueue(token: string | null, err?: Error) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(err || new Error("登录已过期，请重新登录"));
  });
  pendingQueue = [];
}

// 用 refreshToken 换取新 accessToken，并发场景只发一次请求
export async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingQueue.push({
        resolve: (token) => resolve(token),
        reject,
      });
    });
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  isRefreshing = true;
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    const body = res.data;
    const data = body && typeof body === "object" && "data" in body ? body.data : body;
    const accessToken = data?.accessToken as string | undefined;

    if (!accessToken) {
      throw new Error("刷新 token 失败");
    }

    setToken(accessToken);
    flushQueue(accessToken);
    return accessToken;
  } catch (err) {
    const error = err instanceof Error ? err : new Error("刷新 token 失败");
    flushQueue(null, error);
    return null;
  } finally {
    isRefreshing = false;
  }
}

export function handleAuthFailure() {
  clearAuth();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}
