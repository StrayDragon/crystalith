import { useEffect, useState } from 'react';

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(query);
}

export function useMediaQuery(query: string, options?: { defaultState?: boolean }) {
  const defaultState = options?.defaultState ?? false;
  const [matches, setMatches] = useState(() => getMediaQueryList(query)?.matches ?? defaultState);

  useEffect(() => {
    const mediaQueryList = getMediaQueryList(query);
    if (!mediaQueryList) {
      setMatches(defaultState);
      return;
    }

    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handler);
      return () => {
        mediaQueryList.removeEventListener('change', handler);
      };
    }

    // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList legacy fallback (no addEventListener)
    mediaQueryList.addListener(handler);
    return () => {
      // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList legacy fallback (no removeEventListener)
      mediaQueryList.removeListener(handler);
    };
  }, [defaultState, query]);

  return matches;
}
