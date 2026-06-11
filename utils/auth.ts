export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  exp?: number;
  iat?: number;
}

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function getUserInfo(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;
  return parseToken(token);
}

// accessToken 是否已过期（可提前 buffer 秒刷新，避免请求中途失效）
export function isAccessTokenExpired(bufferSeconds = 60): boolean {
  const token = getToken();
  if (!token) return true;

  const payload = parseToken(token);
  if (!payload?.exp) return false;

  return Date.now() >= payload.exp * 1000 - bufferSeconds * 1000;
}

// 判断当前用户是否拥有指定角色
export function hasRole(requiredRoles: string | string[]): boolean {
  const user = getUserInfo();
  if (!user) return false;

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(user.role);
}
