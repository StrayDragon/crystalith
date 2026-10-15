// c131 T6 — search-index rebuild + status polling for the sources panel.
//
// Polls GET /v2/notebooks/:nid/search-index (1s while rebuilding, 5s idle) and
// exposes startRebuild (POST .../rebuild → 202 handle / 409 while running).
import type { SearchIndexStatus } from '@crystalith/shared';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import type { IndexControlProps } from './components/IndexRebuildControl';

export interface SearchIndexRebuildApi {
  indexStatus: SearchIndexStatus | null;
  statusError: string | null;
  control: IndexControlProps | null;
  startRebuild: () => Promise<void>;
}

export function useSearchIndexRebuild(
  notebookId: number | null | undefined,
): SearchIndexRebuildApi {
  const [indexStatus, setStatus] = useState<SearchIndexStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refreshNow = useCallback(async () => {
    if (!notebookId) return;
    try {
      const { data, error } = await api.v2.notebooks({ nid: notebookId })['search-index'].get();
      if (error) throw new Error(parseServerError(error).message);
      setStatus(data);
      setStatusError(null);
    } catch (error) {
      setStatusError(parseServerError(error).message);
    }
  }, [notebookId]);

  const rebuilding = indexStatus?.state === 'rebuilding';
  useEffect(() => {
    if (!notebookId) return;
    void refreshNow();
    const timer = setInterval(() => void refreshNow(), rebuilding ? 1_000 : 5_000);
    return () => {
      clearInterval(timer);
    };
  }, [notebookId, refreshNow, rebuilding]);

  const startRebuild = useCallback(async () => {
    if (!notebookId) return;
    setStarting(true);
    try {
      const { error } = await api.v2
        .notebooks({ nid: notebookId })
        // eslint-disable-next-line no-unexpected-multiline
        ['search-index'].rebuild.post({});
      if (error) throw new Error(parseServerError(error).message);
      await refreshNow();
      toast.success('索引重建已启动');
    } catch (error) {
      const message = parseServerError(error).message;
      setStatusError(message);
      toast.error(`索引重建启动失败：${message}`);
    } finally {
      setStarting(false);
    }
  }, [notebookId, refreshNow]);

  const control: IndexControlProps | null =
    indexStatus === null
      ? null
      : {
          state: indexStatus.state,
          progress: indexStatus.progress ?? { total: 0, done: 0, failed: 0 },
          starting,
          onStart: startRebuild,
        };

  return { indexStatus, statusError, control, startRebuild };
}
