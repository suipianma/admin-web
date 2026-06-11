"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRefreshToken, getToken, isAccessTokenExpired } from "@/utils/auth";
import { refreshAccessToken } from "@/services/tokenRefresh";

// 页面级鉴权：无有效登录态时跳转登录，有 refreshToken 则尝试静默续期
export function useAuth() {
  const router = useRouter();

  useEffect(() => {
    async function ensureAuth() {
      const token = getToken();
      const refreshToken = getRefreshToken();

      if (!token && !refreshToken) {
        router.replace("/login");
        return;
      }

      if ((!token || isAccessTokenExpired()) && refreshToken) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          router.replace("/login");
        }
        return;
      }

      if (!token) {
        router.replace("/login");
      }
    }

    ensureAuth();
  }, [router]);
}
