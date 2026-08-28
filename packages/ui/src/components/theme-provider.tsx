"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../lib/cn";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "nexora-theme";

function applyPreference(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
}

/**
 * Drives light/dark/system theming via a `data-theme` attribute on <html>.
 * "system" removes the attribute entirely so the CSS `@media
 * (prefers-color-scheme)` block (not JS) decides — meaning it tracks OS
 * theme changes live, with no reload. Preference (not resolved theme) is
 * persisted to localStorage so a toggle survives reloads.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const initial = stored ?? "system";
    setPreferenceState(initial);
    applyPreference(initial);
  }, []);

  const setPreference = React.useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    applyPreference(pref);
    window.localStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value = React.useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() must be used within a <ThemeProvider>");
  return ctx;
}

const CYCLE: ThemePreference[] = ["system", "light", "dark"];
const ICONS: Record<ThemePreference, React.ElementType> = { system: Monitor, light: Sun, dark: Moon };
const LABELS: Record<ThemePreference, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const Icon = ICONS[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length]!)}
      aria-label={`${LABELS[preference]} — click to change`}
      title={LABELS[preference]}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/60 text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:text-foreground active:scale-95",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
