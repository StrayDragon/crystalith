import type { QAMessage, Source } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import type { AsyncStatus } from '../../../../shared/types';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { normalizeSource } from '../../shared/utils';
import type { SourceSeamContext } from './sourceSeamContext';
import { useExtractors } from './useExtractors';
import { useSourceCitationHighlight } from './useSourceCitationHighlight';
import { useSourceSearchQueue } from './useSourceSearchQueue';
import { useSourceTags } from './useSourceTags';
import { useSourceUploads } from './useSourceUploads';

type QaMessage = QAMessage;

export type { DedupConfirmRequest, SourceUploadItem } from './useSourceUploads';
export type { SearchQueueItem, SearchQueueItemStatus } from './useSourceSearchQueue';

export type SourceSortBy = 'date' | 'name' | 'size' | 'type';
export type SourceSortOrder = 'asc' | 'desc';

/**
 * Sources domain composition root (W6 five-seam split). Owns the sources
 * list (query + SWR) and list-level mutations; tags / extractors / uploads /
 * search queue / citation highlight live in their own seam hooks.
 */
export function useSources() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const sources = useWorkspaceStore((s) => s.sources);
  const loadingSources = useWorkspaceStore((s) => s.loading.sources);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const [removeState, setRemoveState] = useState<AsyncStatus>('idle');
  const [batchReembedState, setBatchReembedState] = useState<AsyncStatus>('idle');
  const [sortBy, setSortBy] = useState<SourceSortBy>('date');
  const [sortOrder, setSortOrder] = useState<SourceSortOrder>('desc');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    setRemoveState('idle');
    setBatchReembedState('idle');
    setTagFilter('');
  }, [activeNotebookId]);

  const sourceListQuery = useMemo(
    () => ({
      sortBy,
      sortOrder,
      tag: tagFilter.trim() || undefined,
      offset: 0,
      limit: 200,
    }),
    [sortBy, sortOrder, tagFilter],
  );

  const { data, error, isLoading, mutate } = useSWR<Source[], Error>(
    activeNotebookId && isConnected
      ? [
          'workspace/sources',
          activeNotebookId,
          sourceListQuery.sortBy,
          sourceListQuery.sortOrder,
          sourceListQuery.tag ?? '',
        ]
      : null,
    (): Promise<Source[]> =>
      api.v2
        .notebooks({ nid: activeNotebookId! })
        .sources.get({ query: sourceListQuery })
        .then((r) => {
          if (r.error) throw new Error(parseServerError(r.error).message);
          return r.data?.items ?? [];
        }),
    // Toast lives in SWR onError (deduped per request) — an effect toast here
    // re-fired on every background revalidate failure (W5).
    { revalidateOnFocus: false, onError: () => toast.error('来源加载失败，请检查后端状态。') },
  );

  useEffect(() => {
    store.getState().setLoading('sources', isLoading);
  }, [isLoading, store]);

  useEffect(() => {
    if (!activeNotebookId) {
      store.getState().setSources([]);
      return;
    }
    if (!isConnected) {
      store.getState().setSources([]);
      return;
    }
    if (error) {
      store.getState().setError('sources', '来源加载失败，请检查后端状态。');
      return;
    }
    if (data) {
      const s = store.getState();
      s.setError('sources', '');
      s.setSources(data.map(normalizeSource));
    }
  }, [data, error, isConnected, activeNotebookId, store]);

  const retrySources = useCallback(async () => {
    store.getState().setError('sources', '');
    await mutate();
  }, [mutate, store]);

  const removeSources = useCallback(
    async (sourceIds: number[]) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      if (sourceIds.length === 0) {
        return false;
      }
      setRemoveState('loading');
      try {
        const { error: delBatchErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.batch.delete.post({ sourceIds });
        if (delBatchErr) throw new Error(parseServerError(delBatchErr).message);
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const removeSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      setRemoveState('loading');
      try {
        const { error: delErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources({ sid: sourceId })
          .delete();
        if (delErr) throw new Error(parseServerError(delErr).message);
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const handleBatchReembedSources = useCallback(
    async (sourceIds: number[]) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持重新嵌入。');
        return false;
      }
      if (!activeNotebookId) {
        toast.warning('请先创建笔记本后再重试。');
        return false;
      }
      if (!sourceIds.length) return false;

      setBatchReembedState('loading');
      try {
        const { data: result, error: breErr } = await api.v2
          .notebooks({ nid: activeNotebookId })
          .sources.batch['re-embed'].post({ sourceIds });
        if (breErr) throw new Error(parseServerError(breErr).message);
        await mutate();
        if ((result?.failedCount ?? 0) > 0) {
          toast.warning(`部分来源重新嵌入失败（${result?.failedCount} 个）。`);
        } else {
          toast.success(`已重新嵌入 ${result?.reembeddedCount ?? 0} 个来源`);
        }
        return (result?.failedCount ?? 0) === 0;
      } catch {
        toast.error('批量重新嵌入失败，请稍后重试。');
        return false;
      } finally {
        setBatchReembedState('idle');
      }
    },
    [isConnected, activeNotebookId, mutate],
  );

  const handleConvertOutputToSource = useCallback(
    async (outputId: number) => {
      if (!activeNotebookId) return;
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持此功能。');
        return;
      }
      try {
        const notebook = api.v2.notebooks({ nid: activeNotebookId });
        const output = notebook.outputs({ id: outputId });
        const { data: result, error: coErr } = await output['convert-to-source'].post();
        if (coErr) throw new Error(parseServerError(coErr).message);
        await mutate();
        toast.success(`已转换为来源：${result?.filename}（${result?.chunkCount} 个分块）`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '转换失败';
        toast.error(`转换失败：${message}`);
      }
    },
    [activeNotebookId, isConnected, mutate],
  );

  const handleConvertSourceQAToSource = useCallback(
    async (sourceId: number, messages: QaMessage[]) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const notebook = api.v2.notebooks({ nid: activeNotebookId });
      const source = notebook.sources({ sid: sourceId });
      const { data: result, error: csErr } = await source['qa-to-source'].post({ messages });
      if (csErr) throw new Error(parseServerError(csErr).message);
      await mutate();
      return result;
    },
    [isConnected, activeNotebookId, mutate],
  );

  const handleReembedSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.error('未连接到后端服务，无法重新嵌入。');
        return;
      }
      if (!activeNotebookId) {
        toast.error('请先创建笔记本。');
        return;
      }
      try {
        const notebook = api.v2.notebooks({ nid: activeNotebookId });
        const source = notebook.sources({ sid: sourceId });
        const { error: reErr } = await source['re-embed'].post();
        if (reErr) throw new Error(parseServerError(reErr).message);
        toast.success('已重新嵌入来源');
        await mutate();
      } catch (error) {
        const message = error instanceof Error ? error.message : '重新嵌入失败';
        toast.error(message);
      }
    },
    [isConnected, mutate, activeNotebookId],
  );

  const seamContext: SourceSeamContext = { activeNotebookId, isConnected, mutate };
  const highlight = useSourceCitationHighlight();
  const tags = useSourceTags(seamContext, { tagFilter, setTagFilter });
  const uploads = useSourceUploads(seamContext);
  const search = useSourceSearchQueue(seamContext);
  const extractors = useExtractors(seamContext);

  return {
    sources,
    isConnected,
    isLoading: loadingSources,
    retrySources,
    removeSources,
    removeSource,
    removeState,
    convertOutputToSource: handleConvertOutputToSource,
    convertSourceQAToSource: handleConvertSourceQAToSource,
    reembedSource: handleReembedSource,
    batchReembedSources: handleBatchReembedSources,
    batchReembedState,
    sortBy,
    sortOrder,
    tagFilter,
    setSortBy,
    setSortOrder,
    setTagFilter,
    ...highlight,
    ...tags,
    ...uploads,
    ...search,
    ...extractors,
  };
}
