import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { renderHook } from "../../../../test-utils/renderHook";
import { THEME_STORAGE_KEY, useTheme } from "./useTheme";

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function createMatchMediaController(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaListener>();

  const mediaQueryList: MediaQueryList = {
    media: "(prefers-color-scheme: dark)",
    matches,
    onchange: null,
    addListener: (listener: MatchMediaListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: MatchMediaListener) => {
      listeners.delete(listener);
    },
    addEventListener: (_type: "change", listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") {
        listeners.add(listener as MatchMediaListener);
      }
    },
    removeEventListener: (_type: "change", listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") {
        listeners.delete(listener as MatchMediaListener);
      }
    },
    dispatchEvent: () => true,
  } as MediaQueryList;

  const setMatches = (next: boolean) => {
    matches = next;
    Object.defineProperty(mediaQueryList, "matches", {
      configurable: true,
      get: () => matches,
    });
    const event = { matches: next, media: mediaQueryList.media } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };

  Object.defineProperty(mediaQueryList, "matches", {
    configurable: true,
    get: () => matches,
  });

  return {
    mediaQueryList,
    setMatches,
  };
}

let mediaController = createMatchMediaController(false);

beforeEach(() => {
  mediaController = createMatchMediaController(false);
  // Mock reason: control system theme change events deterministically in jsdom.
  vi.spyOn(window, "matchMedia").mockImplementation(() => mediaController.mediaQueryList);
  window.localStorage.clear();
  document.documentElement.className = "h-full";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
});

test("loads dark mode from localStorage and applies class", async () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

  const { result } = renderHook(() => useTheme());

  await waitFor(() => {
    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark");
});

test("setTheme persists preference and updates resolved theme", async () => {
  const { result } = renderHook(() => useTheme());

  act(() => {
    result.current.setTheme("dark");
  });

  await waitFor(() => {
    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("system mode reacts to prefers-color-scheme changes", async () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "system");

  const { result } = renderHook(() => useTheme());

  await waitFor(() => {
    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("light");
  });

  act(() => {
    mediaController.setMatches(true);
  });

  await waitFor(() => {
    expect(result.current.resolvedTheme).toBe("dark");
  });

  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
