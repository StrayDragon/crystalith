import { useCallback, useEffect, useState } from 'react';

import type { GenerationPreference, GenerationPreferenceSetting } from '../types';

export const GENERATION_PREFERENCE_STORAGE_KEY = 'crystalith_generation_preference';
const GENERATION_PREFERENCE_EVENT = 'crystalith:generation_preference';

function normalizeGenerationPreference(value: string | null): GenerationPreferenceSetting {
  if (value === 'quality' || value === 'speed') {
    return value;
  }
  return 'default';
}

export function toApiGenerationPreference(
  preference: GenerationPreferenceSetting,
): GenerationPreference | undefined {
  if (preference === 'quality' || preference === 'speed') {
    return preference;
  }
  return undefined;
}

export function readInitialGenerationPreference(): GenerationPreferenceSetting {
  if (typeof window === 'undefined') {
    return 'default';
  }
  return normalizeGenerationPreference(window.localStorage.getItem(GENERATION_PREFERENCE_STORAGE_KEY));
}

export function readInitialGenerationPreferenceForApi(): GenerationPreference | undefined {
  return toApiGenerationPreference(readInitialGenerationPreference());
}

export function useGenerationPreference() {
  const [preference, setPreferenceState] = useState<GenerationPreferenceSetting>(
    () => readInitialGenerationPreference(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refresh = () => {
      setPreferenceState(readInitialGenerationPreference());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GENERATION_PREFERENCE_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener(GENERATION_PREFERENCE_EVENT, refresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(GENERATION_PREFERENCE_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setPreference = useCallback((nextPreference: GenerationPreferenceSetting) => {
    setPreferenceState(nextPreference);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextPreference === 'default') {
      window.localStorage.removeItem(GENERATION_PREFERENCE_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(GENERATION_PREFERENCE_EVENT, { detail: nextPreference }));
      return;
    }

    window.localStorage.setItem(GENERATION_PREFERENCE_STORAGE_KEY, nextPreference);
    window.dispatchEvent(new CustomEvent(GENERATION_PREFERENCE_EVENT, { detail: nextPreference }));
  }, []);

  return { preference, setPreference };
}
