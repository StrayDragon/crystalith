import { useCallback, useEffect, useRef, useState } from 'react';

export const THEME_STORAGE_KEY = 'crystalith_theme';
const THEME_TRANSITION_CLASS = 'theme-transition';
const THEME_TRANSITION_DURATION = 220;

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

function getMatchMedia(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(prefers-color-scheme: dark)');
}

function resolveSystemTheme(): ResolvedTheme {
  return getMatchMedia()?.matches ? 'dark' : 'light';
}

function normalizeThemeMode(value: string | null): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? resolveSystemTheme() : mode;
}

function applyTheme(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = mode;
}

function persistTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

function readInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }
  return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => readInitialThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readInitialThemeMode()),
  );
  const transitionTimerRef = useRef<number | null>(null);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.add(THEME_TRANSITION_CLASS);
      if (transitionTimerRef.current != null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove(THEME_TRANSITION_CLASS);
        transitionTimerRef.current = null;
      }, THEME_TRANSITION_DURATION);
    }

    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(theme, resolved);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = getMatchMedia();
    if (!mediaQuery) {
      return;
    }

    const handleSystemThemeChange = () => {
      const nextResolved = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyTheme('system', nextResolved);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current != null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  return {
    theme,
    setTheme,
    resolvedTheme,
  };
}
