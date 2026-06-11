"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, hasRole } from "@/utils/auth";

// 角色权限守卫：先校验登录，再校验角色
export function useRole(requiredRoles: string | string[]) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const roleKey = Array.isArray(requiredRoles)
    ? requiredRoles.join(",")
    : requiredRoles;

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    setAuthorized(hasRole(requiredRoles));
    setReady(true);
  }, [router, roleKey]);

  return { ready, authorized };
}
