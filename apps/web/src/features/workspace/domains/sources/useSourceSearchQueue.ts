import type { SourceSearchResult } from '@crystalith/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import type { AsyncStatus } from '../../../../shared/types';
import type { SourceSeamContext } from './sourceSeamContext';

/** 搜索队列项状态 */
export type SearchQueueItemStatus = 'loading' | 'success' | 'error';

/** 搜索队列项 */
export interface SearchQueueItem {
  id: string;
  query: string;
  engine: string;
  mode: string;
  status: SearchQueueItemStatus;
  results: SourceSearchResult[];
  notice: string;
  createdAt: number;
}

const MAX_SEARCH_QUEUE_ITEMS = 20;

/** Web search queue seam (W6): fast-search queue + lifecycle. */
export function useSourceSearchQueue(ctx: SourceSeamContext) {
  const { activeNotebookId, isConnected } = ctx;
  const [searchState, setSearchState] = useState<AsyncStatus>('idle');
  const [searchQueue, setSearchQueue] = useState<SearchQueueItem[]>([]);
  const searchIdRef = useRef(0);

  useEffect(() => {
    setSearchState('idle');
    setSearchQueue([]);
  }, [activeNotebookId]);

  const handleSearch = useCallback(
    async ({ query, engine, mode: _mode }: { query: string; engine: string; mode: string }) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂无法搜索。');
        return;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后搜索。');
        return;
      }
      const trimmed = query.trim();
      if (!trimmed) {
        toast.warning('请输入搜索关键词。');
        return;
      }

      // sources.search mode is web-search channel metadata only (always Fast).
      const mode = 'Fast Research';

      searchIdRef.current += 1;
      const searchId = `search-${searchIdRef.current}-${Date.now()}`;

      const newQueueItem: SearchQueueItem = {
        id: searchId,
        query: trimmed,
        engine,
        mode,
        status: 'loading',
        results: [],
        notice: '正在查询网络搜索引擎…',
        createdAt: Date.now(),
      };
      setSearchQueue((prev) => {
        const next = [...prev, newQueueItem];
        return next.length > MAX_SEARCH_QUEUE_ITEMS ? next.slice(-MAX_SEARCH_QUEUE_ITEMS) : next;
      });

      setSearchState('loading');

      try {
        const { data: response, error: srErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.search.post({ query: trimmed, engine, mode });
        if (srErr) throw new Error(parseServerError(srErr).message);
        const results = response?.results ?? [];

        // c65: engine failure is a distinct error state, never "no hits".
        if (response?.status === 'service_error') {
          const serviceErrorNotice = response.message || '搜索服务暂时不可用，请稍后重试。';
          setSearchQueue((prev) =>
            prev.map((item) =>
              item.id === searchId
                ? { ...item, status: 'error', results: [], notice: serviceErrorNotice }
                : item,
            ),
          );
          return;
        }

        let notice = '';
        if (response?.message) {
          notice = response.message;
        } else if (results.length === 0) {
          notice = '没有找到匹配结果。';
        } else {
          notice = `已找到 ${results.length} 条结果。`;
        }

        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId ? { ...item, status: 'success', results, notice } : item,
          ),
        );
      } catch {
        const errorNotice = '搜索失败，请稍后重试。';
        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId ? { ...item, status: 'error', notice: errorNotice } : item,
          ),
        );
      } finally {
        setSearchState('idle');
      }
    },
    [isConnected, activeNotebookId],
  );

  const removeSearchQueueItem = useCallback((queueItemId: string) => {
    setSearchQueue((prev) => prev.filter((item) => item.id !== queueItemId));
  }, []);

  /** Re-run a failed queue item with its original query (c65 error-state retry). */
  const retrySearchQueueItem = useCallback(
    (queueItem: SearchQueueItem) => {
      setSearchQueue((prev) => prev.filter((item) => item.id !== queueItem.id));
      void handleSearch({ query: queueItem.query, engine: queueItem.engine, mode: queueItem.mode });
    },
    [handleSearch],
  );

  const removeResultsFromQueue = useCallback((urls: string[]) => {
    const urlSet = new Set(urls);
    setSearchQueue((prev) =>
      prev
        .map((item) => ({
          ...item,
          results: item.results.filter((r) => !urlSet.has(r.url)),
        }))
        .filter((item) => item.results.length > 0 || item.status === 'loading'),
    );
  }, []);

  return {
    searchState,
    searchQueue,
    handleSearch,
    removeSearchQueueItem,
    retrySearchQueueItem,
    removeResultsFromQueue,
  };
}
