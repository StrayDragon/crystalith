import { useCallback, useEffect, useMemo } from 'react';

import { useWorkspaceStore } from '../../shared/state/workspaceStore';

/** Citation hover / jump-to highlight state (W6 seam; store-owned). */
export function useSourceCitationHighlight() {
  const citations = useWorkspaceStore((s) => s.citations);
  const hoveredCitationChunkId = useWorkspaceStore((s) => s.hoveredCitationChunkId);
  const hoveredMessageChunkIds = useWorkspaceStore((s) => s.hoveredMessageChunkIds);
  const jumpToCitationChunkId = useWorkspaceStore((s) => s.jumpToCitationChunkId);
  const store = useWorkspaceStore;

  useEffect(() => {
    store.getState().setHoveredCitation(null);
  }, [citations, store]);

  useEffect(() => {
    if (jumpToCitationChunkId === null) return undefined;
    const timer = window.setTimeout(() => {
      store.getState().setJumpToCitation(null);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [jumpToCitationChunkId, store]);

  const setHoveredCitationChunkId = useCallback(
    (chunkId: number | null) => {
      store.getState().setHoveredCitation(chunkId);
    },
    [store],
  );

  const setHoveredMessageChunkIds = useCallback(
    (chunkIds: number[] | null) => {
      const normalized = chunkIds?.filter((chunkId) => Number.isFinite(chunkId)) ?? [];
      store.getState().setHoveredMessageChunks(normalized);
    },
    [store],
  );

  const setJumpToCitationChunkId = useCallback(
    (chunkId: number | null) => {
      store.getState().setJumpToCitation(chunkId);
    },
    [store],
  );

  const highlightedChunkIds = useMemo(() => {
    const highlighted = new Set<number>();
    if (hoveredCitationChunkId !== null) {
      highlighted.add(hoveredCitationChunkId);
    }
    if (jumpToCitationChunkId !== null) {
      highlighted.add(jumpToCitationChunkId);
    }
    for (const chunkId of hoveredMessageChunkIds) {
      if (Number.isFinite(chunkId)) {
        highlighted.add(chunkId);
      }
    }
    return highlighted;
  }, [hoveredCitationChunkId, jumpToCitationChunkId, hoveredMessageChunkIds]);

  return {
    citations,
    hoveredCitationChunkId,
    hoveredMessageChunkIds,
    jumpToCitationChunkId,
    setHoveredCitationChunkId,
    setHoveredMessageChunkIds,
    setJumpToCitationChunkId,
    highlightedChunkIds,
  };
}
