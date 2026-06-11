import request from "./request";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export function login(username: string, password: string) {
  return request.post<LoginResult>("/auth/login", { username, password });
}

export function register(username: string, password: string) {
  return request.post("/auth/register", { username, password });
}

export function refreshToken(refreshToken: string) {
  return request.post<{ accessToken: string }>("/auth/refresh", { refreshToken });
}

export function logout(userId: number) {
  return request.post("/auth/logout", { userId });
}
