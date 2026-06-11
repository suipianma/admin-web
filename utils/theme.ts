export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_KEY = "theme";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme = getSystemTheme()
): ResolvedTheme {
  if (preference === "system") return systemTheme;
  return preference;
}

export function getStoredTheme(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(THEME_KEY);
  return value === "dark" || value === "light" || value === "system"
    ? value
    : null;
}

export function setStoredTheme(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
}

export function getResolvedFromDocument(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function markThemeSwitching() {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  window.setTimeout(() => {
    root.classList.remove("theme-switching");
  }, 0);
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

// 同步写入 DOM，避免等 useEffect 才切换导致闪屏
export function applyThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
  options?: { persist?: boolean; disableTransition?: boolean }
) {
  const resolved = resolveTheme(preference, systemTheme);

  if (options?.disableTransition !== false) {
    markThemeSwitching();
  }

  applyResolvedTheme(resolved);

  if (options?.persist !== false) {
    setStoredTheme(preference);
  }

  return resolved;
}

export function getInitialTheme(): ThemePreference {
  return getStoredTheme() ?? "system";
}
