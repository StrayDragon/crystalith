// c132 T7 — knowledge-base (global) search for the top-bar panel.
//
// Debounced input-driven search over POST /v2/search (Eden). Scope toggle
// lives here (all / active notebook); grouping of results by notebook is
// derived for the panel. Jump handling stays in the panel's props.
import type { SearchResponse } from '@crystalith/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';

export type KbScopeMode = 'all' | 'notebook';

export interface KbSearchGroup {
  notebookId: number;
  title: string;
  items: SearchResponse['results'];
}

export interface KnowledgeSearchApi {
  query: string;
  setQuery: (v: string) => void;
  scopeMode: KbScopeMode;
  setScopeMode: (m: KbScopeMode) => void;
  /** idle = nothing searched yet; loading = request in flight. */
  status: 'idle' | 'loading' | 'done' | 'error';
  result: SearchResponse | null;
  error: string | null;
  groups: KbSearchGroup[];
}

const DEBOUNCE_MS = 300;

interface RunSetters {
  setLoading: () => void;
  setData: (data: SearchResponse) => void;
  fail: (message: string) => void;
}

/** One debounced search run; `isStale` drops superseded responses. */
// fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖，结构拆分到此为止（拆分准则：不为拆而拆）
async function runKbSearch(
  query: string,
  scope: { kind: 'notebook'; notebookId: number } | undefined,
  isStale: () => boolean,
  { setLoading, setData, fail }: RunSetters,
): Promise<void> {
  setLoading();
  try {
    const { data, error: rpcError } = await api.v2.search.post({
      query,
      ...(scope ? { scope } : {}),
    });
    if (isStale()) return;
    if (rpcError) throw new Error(parseServerError(rpcError).message);
    setData(data);
  } catch (error) {
    if (isStale()) return;
    fail(error instanceof Error ? error.message : String(error));
  }
}

/** Group results by notebook; facet hit counts drive the group order. */
function groupByNotebook(result: SearchResponse | null): KbSearchGroup[] {
  if (!result) return [];
  const byNotebook = new Map<number, KbSearchGroup>();
  for (const item of result.results) {
    const g = byNotebook.get(item.notebookId) ?? {
      notebookId: item.notebookId,
      title: item.notebookTitle,
      items: [],
    };
    g.items.push(item);
    byNotebook.set(item.notebookId, g);
  }
  const order = new Map(result.facets.notebooks.map((f) => [f.notebookId, f.count]));
  return [...byNotebook.values()].toSorted(
    (a, b) => (order.get(b.notebookId) ?? 0) - (order.get(a.notebookId) ?? 0),
  );
}

export function useKnowledgeSearch(activeNotebookId: number | null): KnowledgeSearchApi {
  const [query, setQuery] = useState('');
  const [scopeMode, setScopeMode] = useState<KbScopeMode>('all');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) {
      seqRef.current++;
      setStatus('idle');
      setResult(null);
      setError(null);
      return;
    }
    const seq = ++seqRef.current;
    const isStale = () => seq !== seqRef.current;
    const scope =
      scopeMode === 'notebook' && activeNotebookId !== null
        ? { kind: 'notebook' as const, notebookId: activeNotebookId }
        : undefined;
    const timer = window.setTimeout(() => {
      void runKbSearch(trimmed, scope, isStale, {
        setLoading: () => {
          setStatus('loading');
        },
        setData: (data) => {
          setResult(data);
          setStatus('done');
          setError(null);
        },
        fail: (message) => {
          setStatus('error');
          setError(message);
        },
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [trimmed, scopeMode, activeNotebookId]);

  const groups = useMemo(() => groupByNotebook(result), [result]);

  return {
    query,
    setQuery,
    scopeMode,
    setScopeMode,
    status,
    result,
    error,
    groups,
  };
}
