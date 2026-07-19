import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '../../../../../shared/i18n';
import { toast } from '../../../../../shared/toast';
import {
  SEARCH_ENGINE_WEB,
  type Research,
  type SearchEngine,
  type SearchMode,
} from './sources-panel-types';
import { normalizeSearchMode } from './sources-panel-utils';

export function useSourcesPanelSearchMode({
  isConnected,
  notebookId,
  research,
  onSearch,
}: {
  isConnected: boolean;
  notebookId?: number;
  research: Research;
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const engine: SearchEngine = SEARCH_ENGINE_WEB;
  const [mode, setMode] = useState<SearchMode>(() => {
    if (typeof window !== 'undefined') {
      return normalizeSearchMode(localStorage.getItem('crystalith_search_mode'));
    }
    return 'Fast Research';
  });

  useEffect(() => {
    localStorage.setItem('crystalith_search_mode', mode);
  }, [mode]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fastSearchDebounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fastSearchDebounceTimerRef.current != null) {
        window.clearTimeout(fastSearchDebounceTimerRef.current);
      }
    };
  }, []);

  const isDeepResearchMode = mode === 'Deep Research';
  const searchPlaceholder = isDeepResearchMode
    ? t('sources.search.placeholder.deep')
    : t('sources.search.placeholder');
  const searchModeToggleLabel = isDeepResearchMode
    ? t('sources.search.toggle.to_fast')
    : t('sources.search.toggle.to_deep');

  const handleSearch = async () => {
    if (mode === 'Deep Research') {
      if (!isConnected) {
        toast.error(t('sources.research.backend_disconnected'));
        return;
      }
      if (!notebookId) {
        toast.error(t('sources.research.require_notebook'));
        return;
      }
      if (!searchQuery.trim()) {
        toast.error(t('sources.research.require_topic'));
        return;
      }

      if (research.isLoading) {
        toast.error(t('sources.research.busy'));
        return;
      }

      const hasActiveResearch = research.sessions.some((s) =>
        ['planning', 'searching', 'analyzing', 'waiting_user'].includes(s.status),
      );
      if (hasActiveResearch) {
        toast.error(t('sources.research.active_exists'));
        return;
      }

      try {
        const session = await research.createSession(searchQuery.trim());
        if (session) {
          await research.startResearch(session.id);
          setSearchQuery('');
          toast.success(t('sources.research.started'));
        }
      } catch {
        toast.error(t('sources.research.create_failed'));
      }
      return;
    }

    if (fastSearchDebounceTimerRef.current != null) {
      window.clearTimeout(fastSearchDebounceTimerRef.current);
    }
    fastSearchDebounceTimerRef.current = window.setTimeout(() => {
      onSearch({ query: searchQuery, engine, mode });
    }, 300);
  };

  const handleToggleSearchMode = useCallback(() => {
    setMode((prev) => (prev === 'Deep Research' ? 'Fast Research' : 'Deep Research'));
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    isDeepResearchMode,
    searchPlaceholder,
    searchModeToggleLabel,
    searchInputRef,
    handleSearch,
    handleToggleSearchMode,
  };
}
