import type { ResearchCreateBody, ResearchRun, ResearchRunsPage } from '@crystalith/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { isTerminalResearchStatus } from './researchCreateGate';
import { surfaceResearchError } from './researchErrors';

const POLL_MS = 4000;

export interface UseResearchRunsOptions {
  notebookId: number | undefined;
  enabled: boolean;
  isConnected: boolean;
}

export function useResearchRuns({ notebookId, enabled, isConnected }: UseResearchRunsOptions) {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!notebookId || !isConnected) {
      if (mountedRef.current) {
        setRuns([]);
        setError('');
      }
      return;
    }
    setIsLoading(true);
    try {
      const { data, error: getErr } = await api.v2
        .notebooks({ nid: notebookId })
        .research.get({ query: { offset: 0, limit: 50 } });
      if (!mountedRef.current) return;
      if (getErr) {
        setError(parseServerError(getErr).message);
        return;
      }
      const page = data as ResearchRunsPage | null;
      setRuns(page?.items ?? []);
      setError('');
    } catch (error) {
      if (mountedRef.current) setError(parseServerError(error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [notebookId, isConnected]);

  useEffect(() => {
    if (!enabled || !notebookId || !isConnected) {
      setRuns([]);
      return;
    }
    void refresh();
  }, [enabled, notebookId, isConnected, refresh]);

  const hasNonTerminal = runs.some((r) => !isTerminalResearchStatus(r.status));

  useEffect(() => {
    if (!enabled || !notebookId || !isConnected || !hasNonTerminal) return;
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, notebookId, isConnected, hasNonTerminal, refresh]);

  const createRun = useCallback(
    async (body: ResearchCreateBody): Promise<ResearchRun | null> => {
      if (!notebookId || !isConnected) return null;
      setCreating(true);
      setError('');
      try {
        const { data, error: postErr } = await api.v2.notebooks({ nid: notebookId }).research.post({
          topic: body.topic,
          useNotebookSources: body.useNotebookSources,
          allowWeb: body.allowWeb,
          sourceIds: body.sourceIds,
          depth: body.depth,
        });
        if (postErr) {
          setError(surfaceResearchError(postErr));
          return null;
        }
        const run = data as ResearchRun | null;
        await refresh();
        return run;
      } catch (error) {
        setError(surfaceResearchError(error));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [notebookId, isConnected, refresh],
  );

  return {
    runs,
    isLoading,
    error,
    creating,
    refresh,
    createRun,
    setError,
  };
}
