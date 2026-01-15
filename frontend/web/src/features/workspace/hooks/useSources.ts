import { useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';

import { listSources, uploadSource } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { ApiSource } from '../types';
import { normalizeSource } from '../utils';

export function useSources() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isDemo = state.connectionState === 'demo';
  const demoSources = useMemo<ApiSource[]>(
    () => [
      {
        id: 1,
        filename: '需求说明.md',
        mime_type: 'text/markdown',
        status: 'READY',
        chunk_count: 12,
      },
      {
        id: 2,
        filename: '竞品对比.txt',
        mime_type: 'text/plain',
        status: 'READY',
        chunk_count: 8,
      },
      {
        id: 3,
        filename: '访谈纪要.md',
        mime_type: 'text/markdown',
        status: 'PROCESSING',
        chunk_count: 0,
      },
    ],
    [],
  );
  const demoNormalized = useMemo(
    () => demoSources.map(normalizeSource),
    [demoSources],
  );

  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && !isDemo
      ? ['workspace/sources', state.activeNotebookId]
      : null,
    () => listSources(state.activeNotebookId ?? 0),
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
    if (isDemo) {
      dispatch({ type: 'SET_SOURCES', payload: demoNormalized });
      return;
    }
    if (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'sources', value: '来源加载失败，请检查后端状态。' },
      });
      return;
    }
    if (data) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'sources', value: '' } });
      dispatch({ type: 'SET_SOURCES', payload: data.map(normalizeSource) });
    }
  }, [data, demoNormalized, dispatch, error, isDemo, state.activeNotebookId]);

  useEffect(() => {
    dispatch({ type: 'SET_HOVERED_CITATION', payload: null });
  }, [dispatch, state.citations]);

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
      if (!file || isDemo || !state.activeNotebookId) return;
      dispatch({ type: 'SET_UPLOAD_STATE', payload: 'loading' });
      dispatch({ type: 'SET_ERROR', payload: { key: 'sources', value: '' } });
      try {
        await uploadSource(state.activeNotebookId, file);
        await mutate();
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'sources', value: '上传失败，请检查文件格式或后端状态。' },
        });
      } finally {
        dispatch({ type: 'SET_UPLOAD_STATE', payload: 'idle' });
      }
    },
    [dispatch, isDemo, mutate, state.activeNotebookId],
  );

  const retrySources = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'sources', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

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

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (error) {
      // noop
    }
  }, [state.citations, state.selectedCitationIds]);

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
    error: state.errors.sources,
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
    isDemo,
  };
}
