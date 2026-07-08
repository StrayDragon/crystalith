import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import { renderHook } from '../../../../test-utils/renderHook';
import { useMediaQuery } from './useMediaQuery';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function createMatchMediaController(query: string, initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaListener>();

  const mediaQueryList: MediaQueryList = {
    media: query,
    matches,
    onchange: null,
    addListener: (listener: MatchMediaListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: MatchMediaListener) => {
      listeners.delete(listener);
    },
    addEventListener: (_type: 'change', listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.add(listener as MatchMediaListener);
      }
    },
    removeEventListener: (_type: 'change', listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.delete(listener as MatchMediaListener);
      }
    },
    dispatchEvent: () => true,
  } as MediaQueryList;

  const setMatches = (next: boolean) => {
    matches = next;
    Object.defineProperty(mediaQueryList, 'matches', {
      configurable: true,
      get: () => matches,
    });
    const event = { matches: next, media: mediaQueryList.media } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };

  Object.defineProperty(mediaQueryList, 'matches', {
    configurable: true,
    get: () => matches,
  });

  return {
    mediaQueryList,
    setMatches,
  };
}

const QUERY = '(min-width: 768px)';
let mediaController = createMatchMediaController(QUERY, false);

beforeEach(() => {
  mediaController = createMatchMediaController(QUERY, false);
  // Mock reason: deterministically control media query state in jsdom.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      if (query === QUERY) {
        return mediaController.mediaQueryList;
      }
      return createMatchMediaController(query, false).mediaQueryList;
    },
  });
});

test('returns defaultState when matchMedia is unavailable', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: undefined,
  });

  const { result } = renderHook(() => useMediaQuery(QUERY, { defaultState: true }));

  await waitFor(() => {
    expect(result.current).toBe(true);
  });
});

test('returns initial media query match state and reacts to changes', async () => {
  const { result } = renderHook(() => useMediaQuery(QUERY));

  await waitFor(() => {
    expect(result.current).toBe(false);
  });

  act(() => {
    mediaController.setMatches(true);
  });

  await waitFor(() => {
    expect(result.current).toBe(true);
  });
});
