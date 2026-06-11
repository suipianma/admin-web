"use client";

import { useEffect, useState } from "react";
import { getUserInfo, type TokenPayload } from "@/utils/auth";

// 客户端挂载后再读取 localStorage，避免 hydration 不一致
export function useUserInfo() {
  const [userInfo, setUserInfo] = useState<TokenPayload | null>(null);

  useEffect(() => {
    setUserInfo(getUserInfo());
  }, []);

  return userInfo;
}
