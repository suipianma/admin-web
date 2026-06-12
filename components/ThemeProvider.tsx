"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import {
  applyThemePreference,
  getInitialTheme,
  getSystemTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/utils/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用");
  }
  return ctx;
}

// 与服务端首屏保持一致，避免 hydration 时读取 localStorage
const SSR_THEME_PREFERENCE: ThemePreference = "system";
const SSR_SYSTEM_THEME: ResolvedTheme = "light";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preference, setPreference] =
    useState<ThemePreference>(SSR_THEME_PREFERENCE);
  const [systemTheme, setSystemTheme] =
    useState<ResolvedTheme>(SSR_SYSTEM_THEME);
  const [ready, setReady] = useState(false);
  const preferenceRef = useRef(preference);

  const resolvedTheme = useMemo(
    () => resolveTheme(preference, systemTheme),
    [preference, systemTheme]
  );

  useEffect(() => {
    preferenceRef.current = preference;
  }, [preference]);

  // 挂载后同步本地偏好，useLayoutEffect 在绘制前执行，减少图标/antd 闪动
  useLayoutEffect(() => {
    const stored = getInitialTheme();
    const system = getSystemTheme();

    preferenceRef.current = stored;
    setPreference(stored);
    setSystemTheme(system);
    setReady(true);
  }, []);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      applyThemePreference(next, systemTheme);
      flushSync(() => {
        setPreference(next);
      });
    },
    [systemTheme]
  );

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
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, setTheme, ready }}
    >
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
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
