import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { AsyncStatus } from '../../../../shared/types';
import { toast } from '../../../../shared/toast';
import { copyToClipboard } from '../../../../shared/clipboard';
import {
  createSourceFromUrlV1NotebooksNotebookIdSourcesFromUrlPost as addSourceFromUrl,
  convertOutputToSourceV1NotebooksNotebookIdOutputsOutputIdConvertToSourcePost as convertOutputToSource,
  convertSourceQaToSourceV1NotebooksNotebookIdSourcesSourceIdQaConvertToSourcePost as convertSourceQAToSource,
  deleteSourceV1NotebooksNotebookIdSourcesSourceIdDelete as deleteSource,
  batchDeleteSourcesV1NotebooksNotebookIdSourcesDelete as deleteSources,
  listExtractorsV1NotebooksNotebookIdSourcesExtractorsGet as listExtractors,
  listSourcesV1NotebooksNotebookIdSourcesGet as listSources,
  searchSourcesV1NotebooksNotebookIdSourcesSearchPost as searchSources,
  uploadSourceV1NotebooksNotebookIdSourcesPost as uploadSource,
  reembedSourceV1NotebooksNotebookIdSourcesSourceIdReEmbedPost as reembedSource,
  type QaMessage,
} from '../../../../api/generated';
import type {
  ExtractorInfoResponse as ExtractorInfo,
  ExtractorsListResponse,
  ExtractorType,
  SourceFromUrlMode,
} from '../../../../api/generated';
import { useWorkspaceDispatch, useWorkspaceState } from '../../app/WorkspaceContext';
import type { ApiSource, ApiSourceSearchResult } from '../../shared/types';
import { normalizeSource } from '../../shared/utils';

/** 搜索队列项状态 */
export type SearchQueueItemStatus = 'loading' | 'success' | 'error';

/** 搜索队列项 */
export interface SearchQueueItem {
  id: string;
  query: string;
  engine: string;
  mode: string;
  status: SearchQueueItemStatus;
  results: ApiSourceSearchResult[];
  notice: string;
  createdAt: number;
}

export function useSources() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isConnected = state.connectionState === 'live';
  const [searchState, setSearchState] = useState<AsyncStatus>('idle');
  const [removeState, setRemoveState] = useState<AsyncStatus>('idle');
  const [searchNotice, setSearchNotice] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSourceSearchResult[]>([]);
  // 搜索队列状态
  const [searchQueue, setSearchQueue] = useState<SearchQueueItem[]>([]);
  const searchIdRef = useRef(0);
  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && isConnected
      ? ['workspace/sources', state.activeNotebookId]
      : null,
    () => listSources({ path: { notebook_id: state.activeNotebookId ?? 0 } }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'sources', value: isLoading } });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_SOURCES', payload: [] });
      return;
    }
    if (!isConnected) {
      dispatch({ type: 'SET_SOURCES', payload: [] });
      return;
    }
    if (error) {
      toast.error('来源加载失败，请检查后端状态。');
      return;
    }
    if (data) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'sources', value: '' } });
      dispatch({ type: 'SET_SOURCES', payload: data.map(normalizeSource) });
    }
  }, [data, dispatch, error, isConnected, state.activeNotebookId]);

  useEffect(() => {
    dispatch({ type: 'SET_HOVERED_CITATION', payload: null });
  }, [dispatch, state.citations]);

  useEffect(() => {
    setSearchState('idle');
    setSearchNotice('');
    setSearchResults([]);
    setRemoveState('idle');
    setSearchQueue([]);
  }, [state.activeNotebookId]);

  useEffect(() => {
    if (state.jumpToCitationChunkId == null) return undefined;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'SET_JUMP_TO_CITATION', payload: null });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dispatch, state.jumpToCitationChunkId]);

  useEffect(() => {
    const nextSelected: Record<string, boolean> = {};
    for (const citation of state.citations) {
      if (state.autoSelectCitations) {
        nextSelected[citation.id] = true;
      } else if (state.selectedCitationIds[citation.id]) {
        nextSelected[citation.id] = true;
      }
    }
    const currentKeys = Object.keys(state.selectedCitationIds);
    const nextKeys = Object.keys(nextSelected);
    const isSame =
      currentKeys.length === nextKeys.length &&
      nextKeys.every((key) => state.selectedCitationIds[key] === nextSelected[key]);
    if (!isSame) {
      dispatch({ type: 'SET_SELECTED_CITATIONS', payload: nextSelected });
    }
  }, [dispatch, state.autoSelectCitations, state.citations, state.selectedCitationIds]);

  const selectedChunkIds = useMemo(
    () =>
      state.citations
        .filter((citation) => state.selectedCitationIds[citation.id])
        .map((citation) => citation.chunkId ?? Number(citation.id))
        .filter((value): value is number => Number.isFinite(value) && value > 0),
    [state.citations, state.selectedCitationIds],
  );

  const selectedCount = useMemo(
    () =>
      state.citations.reduce(
        (count, citation) => count + (state.selectedCitationIds[citation.id] ? 1 : 0),
        0,
      ),
    [state.citations, state.selectedCitationIds],
  );

  const toggleCitation = useCallback(
    (citationId: string) => {
      const wasSelected = Boolean(state.selectedCitationIds[citationId]);
      if (state.autoSelectCitations && wasSelected) {
        dispatch({ type: 'SET_AUTO_SELECT_CITATIONS', payload: false });
      }
      dispatch({
        type: 'SET_SELECTED_CITATIONS',
        payload: {
          ...state.selectedCitationIds,
          [citationId]: !wasSelected,
        },
      });
    },
    [dispatch, state.autoSelectCitations, state.selectedCitationIds],
  );

  const selectAllCitations = useCallback(() => {
    const nextSelection: Record<string, boolean> = {};
    for (const citation of state.citations) {
      nextSelection[citation.id] = true;
    }
    dispatch({ type: 'SET_AUTO_SELECT_CITATIONS', payload: true });
    dispatch({ type: 'SET_SELECTED_CITATIONS', payload: nextSelection });
  }, [dispatch, state.citations]);

  const clearCitationSelection = useCallback(() => {
    dispatch({ type: 'SET_AUTO_SELECT_CITATIONS', payload: false });
    dispatch({ type: 'SET_SELECTED_CITATIONS', payload: {} });
  }, [dispatch]);

  const toggleAutoSelect = useCallback(() => {
    const next = !state.autoSelectCitations;
    dispatch({ type: 'SET_AUTO_SELECT_CITATIONS', payload: next });
    if (!next) {
      dispatch({ type: 'SET_SELECTED_CITATIONS', payload: {} });
      return;
    }
    const selection: Record<string, boolean> = {};
    for (const citation of state.citations) {
      selection[citation.id] = true;
    }
    dispatch({ type: 'SET_SELECTED_CITATIONS', payload: selection });
  }, [dispatch, state.autoSelectCitations, state.citations]);

  const setHoveredCitationChunkId = useCallback(
    (chunkId: number | null) => {
      dispatch({ type: 'SET_HOVERED_CITATION', payload: chunkId });
    },
    [dispatch],
  );

  const setHoveredMessageChunkIds = useCallback(
    (chunkIds: number[] | null) => {
      const normalized =
        chunkIds?.filter((chunkId) => Number.isFinite(chunkId)) ?? [];
      dispatch({ type: 'SET_HOVERED_MESSAGE_CHUNKS', payload: normalized });
    },
    [dispatch],
  );

  const setJumpToCitationChunkId = useCallback(
    (chunkId: number | null) => {
      dispatch({ type: 'SET_JUMP_TO_CITATION', payload: chunkId });
    },
    [dispatch],
  );

  const highlightedChunkIds = useMemo(() => {
    const highlighted = new Set<number>();
    if (state.hoveredCitationChunkId != null) {
      highlighted.add(state.hoveredCitationChunkId);
    }
    if (state.jumpToCitationChunkId != null) {
      highlighted.add(state.jumpToCitationChunkId);
    }
    for (const chunkId of state.hoveredMessageChunkIds) {
      if (Number.isFinite(chunkId)) {
        highlighted.add(chunkId);
      }
    }
    return highlighted;
  }, [
    state.hoveredCitationChunkId,
    state.jumpToCitationChunkId,
    state.hoveredMessageChunkIds,
  ]);

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file || !state.activeNotebookId || !isConnected) {
        if (!isConnected) {
          toast.error('未连接到后端服务，无法上传来源。');
        }
        return;
      }
      dispatch({ type: 'SET_UPLOAD_STATE', payload: 'loading' });
      try {
        await uploadSource({
          path: { notebook_id: state.activeNotebookId },
          body: { file },
        });
        await mutate();
        toast.success('来源上传成功');
      } catch (error) {
        toast.error('上传失败，请检查文件格式或后端状态。');
      } finally {
        dispatch({ type: 'SET_UPLOAD_STATE', payload: 'idle' });
      }
    },
    [dispatch, isConnected, mutate, state.activeNotebookId],
  );

  const retrySources = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'sources', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

  const handleSearch = useCallback(
    async ({ query, engine, mode }: { query: string; engine: string; mode: string }) => {
      if (!isConnected) {
        setSearchNotice('未连接到后端服务，暂无法搜索。');
        setSearchResults([]);
        return;
      }
      if (!state.activeNotebookId) {
        setSearchNotice('请先创建笔记本后搜索。');
        setSearchResults([]);
        return;
      }
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchNotice('请输入搜索关键词。');
        setSearchResults([]);
        return;
      }

      // 生成唯一的搜索 ID
      searchIdRef.current += 1;
      const searchId = `search-${searchIdRef.current}-${Date.now()}`;

      // 立即创建 loading 状态的队列项
      const newQueueItem: SearchQueueItem = {
        id: searchId,
        query: trimmed,
        engine,
        mode,
        status: 'loading',
        results: [],
        notice: '',
        createdAt: Date.now(),
      };
      setSearchQueue((prev) => [...prev, newQueueItem]);

      // 同时更新旧的状态以保持向后兼容
      setSearchState('loading');
      setSearchNotice('');

      try {
        const response = await searchSources({
          path: { notebook_id: state.activeNotebookId },
          body: { query: trimmed, engine, mode },
        });
        const results = response.results ?? [];
        let notice = '';
        if (response.message) {
          notice = response.message;
        } else if (results.length === 0) {
          notice = '没有找到匹配结果。';
        } else {
          notice = `已找到 ${results.length} 条结果。`;
        }

        // 更新队列项状态
        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId
              ? { ...item, status: 'success', results, notice }
              : item,
          ),
        );

        // 同时更新旧的状态
        setSearchResults(results);
        setSearchNotice(notice);
      } catch (error) {
        const errorNotice = '搜索失败，请稍后重试。';
        // 更新队列项状态为错误
        setSearchQueue((prev) =>
          prev.map((item) =>
            item.id === searchId
              ? { ...item, status: 'error', notice: errorNotice }
              : item,
          ),
        );
        setSearchNotice(errorNotice);
        setSearchResults([]);
      } finally {
        setSearchState('idle');
      }
    },
    [isConnected, state.activeNotebookId],
  );

  // 移除单个搜索队列项
  const removeSearchQueueItem = useCallback((queueItemId: string) => {
    setSearchQueue((prev) => prev.filter((item) => item.id !== queueItemId));
  }, []);

  // 从搜索队列项中移除已添加的结果
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

  const removeSources = useCallback(
    async (sourceIds: number[]) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!state.activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      if (sourceIds.length === 0) {
        return false;
      }
      setRemoveState('loading');
      try {
        await deleteSources({
          path: { notebook_id: state.activeNotebookId },
          body: { source_ids: sourceIds },
        });
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch (error) {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, state.activeNotebookId],
  );

  const removeSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持删除来源。');
        return false;
      }
      if (!state.activeNotebookId) {
        toast.warning('请先创建笔记本后再删除来源。');
        return false;
      }
      setRemoveState('loading');
      try {
        await deleteSource({
          path: { notebook_id: state.activeNotebookId, source_id: sourceId },
        });
        await mutate();
        toast.success('来源删除成功');
        return true;
      } catch (error) {
        toast.error('删除失败，请稍后重试。');
        return false;
      } finally {
        setRemoveState('idle');
      }
    },
    [isConnected, mutate, state.activeNotebookId],
  );

  const copySelectedCitations = useCallback(async () => {
    const selected = state.citations.filter(
      (citation) => state.selectedCitationIds[citation.id],
    );
    if (selected.length === 0) return;
    const text = selected
      .map((citation) => {
        const pageLabel = citation.pageNumber
          ? `第 ${citation.pageNumber} 页`
          : '页码未知';
        return `- ${citation.sourceTitle} (${pageLabel} · #${citation.chunkIndex}) ${citation.snippet}`;
      })
      .join('\n');

    await copyToClipboard(text);
  }, [state.citations, state.selectedCitationIds]);

  const handleConvertOutputToSource = useCallback(
    async (outputId: number) => {
      if (!state.activeNotebookId) return;
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持此功能。');
        return;
      }
      try {
        const result = await convertOutputToSource({
          path: { notebook_id: state.activeNotebookId, output_id: outputId },
        });
        // Refresh sources list to show the new source
        await mutate();
        toast.success(`已转换为来源：${result.filename}（${result.chunk_count} 个分块）`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '转换失败';
        toast.error(`转换失败：${message}`);
      }
    },
    [state.activeNotebookId, isConnected, mutate],
  );

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setSearchNotice('');
  }, []);

  const handleAddSourceFromUrl = useCallback(
    async (
      url: string,
      mode: SourceFromUrlMode,
      options?: { title?: string; snippet?: string; extractor?: ExtractorType },
    ) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!state.activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const result = await addSourceFromUrl({
        path: { notebook_id: state.activeNotebookId },
        body: {
          url,
          mode,
          title: options?.title,
          snippet: options?.snippet,
          extractor: options?.extractor,
        },
      });
      await mutate();
      return result;
    },
    [isConnected, state.activeNotebookId, mutate],
  );

  // Fetch available extractors
  const {
    data: extractorsData,
    isLoading: extractorsLoading,
  } = useSWR<ExtractorsListResponse>(
    state.activeNotebookId && isConnected
      ? ['workspace/extractors', state.activeNotebookId]
      : null,
    () => listExtractors({ path: { notebook_id: state.activeNotebookId ?? 0 } }),
    { revalidateOnFocus: false },
  );

  const extractors = useMemo<ExtractorInfo[]>(() => {
    return extractorsData?.extractors ?? [];
  }, [extractorsData]);

  const availableExtractors = useMemo<ExtractorInfo[]>(() => {
    return extractors.filter((e) => e.available);
  }, [extractors]);

  const defaultExtractor = useMemo<ExtractorType | null>(() => {
    return extractorsData?.default_extractor ?? null;
  }, [extractorsData]);

  // Convert source QA to source
  const handleConvertSourceQAToSource = useCallback(
    async (sourceId: number, messages: QaMessage[]) => {
      if (!isConnected) {
        throw new Error('未连接到后端服务，暂不支持此功能');
      }
      if (!state.activeNotebookId) {
        throw new Error('请先创建笔记本');
      }
      const result = await convertSourceQAToSource({
        path: { notebook_id: state.activeNotebookId, source_id: sourceId },
        body: { messages },
      });
      await mutate();
      return result;
    },
    [isConnected, state.activeNotebookId, mutate],
  );

  const handleReembedSource = useCallback(
    async (sourceId: number) => {
      if (!isConnected) {
        toast.error('未连接到后端服务，无法重新嵌入。');
        return;
      }
      if (!state.activeNotebookId) {
        toast.error('请先创建笔记本。');
        return;
      }
      try {
        await reembedSource({
          path: { notebook_id: state.activeNotebookId, source_id: sourceId },
        });
        toast.success('已重新嵌入来源');
        await mutate();
      } catch (error) {
        const message = error instanceof Error ? error.message : '重新嵌入失败';
        toast.error(message);
      }
    },
    [isConnected, mutate, state.activeNotebookId],
  );

  return {
    sources: state.sources,
    citations: state.citations,
    selectedCitationIds: state.selectedCitationIds,
    autoSelectCitations: state.autoSelectCitations,
    hoveredCitationChunkId: state.hoveredCitationChunkId,
    hoveredMessageChunkIds: state.hoveredMessageChunkIds,
    jumpToCitationChunkId: state.jumpToCitationChunkId,
    uploadState: state.uploadState,
    isLoading: state.loading.sources,
    selectedChunkIds,
    selectedCount,
    highlightedChunkIds,
    toggleCitation,
    selectAllCitations,
    clearCitationSelection,
    toggleAutoSelect,
    setHoveredCitationChunkId,
    setHoveredMessageChunkIds,
    setJumpToCitationChunkId,
    copySelectedCitations,
    handleUpload,
    retrySources,
    searchState,
    searchNotice,
    searchResults,
    handleSearch,
    removeSources,
    removeSource,
    removeState,
    convertOutputToSource: handleConvertOutputToSource,
    clearSearchResults,
    addSourceFromUrl: handleAddSourceFromUrl,
    isConnected,
    // 搜索队列相关
    searchQueue,
    removeSearchQueueItem,
    removeResultsFromQueue,
    // 提取器相关
    extractors,
    availableExtractors,
    defaultExtractor,
    extractorsLoading,
    // Source QA 转换
    convertSourceQAToSource: handleConvertSourceQAToSource,
    reembedSource: handleReembedSource,
  };
}
