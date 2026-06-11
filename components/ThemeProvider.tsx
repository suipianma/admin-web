"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { ConfigProvider, theme as antdTheme } from "antd";
import {
  applyThemePreference,
  getInitialTheme,
  getResolvedFromDocument,
  getSystemTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/utils/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用");
  }
  return ctx;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    typeof window !== "undefined" ? getInitialTheme() : "system"
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    typeof window !== "undefined" ? getSystemTheme() : "light"
  );
  const preferenceRef = useRef(preference);

  const resolvedTheme = useMemo(
    () => resolveTheme(preference, systemTheme),
    [preference, systemTheme]
  );

  useEffect(() => {
    preferenceRef.current = preference;
  }, [preference]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      // 先同步改 DOM，再强制同帧更新 React，避免 antd 与页面样式不同步
      applyThemePreference(next, systemTheme);
      flushSync(() => {
        setPreference(next);
      });
    },
    [systemTheme]
  );

  // 首屏：与内联脚本已设置的 data-theme 对齐，仅同步 antd 算法
  useEffect(() => {
    const docResolved = getResolvedFromDocument();
    const computed = resolveTheme(preference, systemTheme);
    if (docResolved !== computed) {
      applyThemePreference(preference, systemTheme, {
        persist: false,
        disableTransition: true,
      });
    }
  }, []);

  // 跟随系统时，系统主题变化需立即同步 DOM
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextSystem = event.matches ? "dark" : "light";

      if (preferenceRef.current === "system") {
        applyThemePreference("system", nextSystem, { persist: false });
        flushSync(() => {
          setSystemTheme(nextSystem);
        });
        return;
      }

      setSystemTheme(nextSystem);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setTheme }}>
      <ConfigProvider
        theme={{
          cssVar: true,
          algorithm:
            resolvedTheme === "dark"
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#3b82f6",
            borderRadius: 8,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
