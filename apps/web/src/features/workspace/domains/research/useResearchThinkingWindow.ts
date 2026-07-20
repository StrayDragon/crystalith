import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ThinkingTimelineItem } from './thinkingTimeline';

const maxVisibleThinking = 80;
const maxExpandedThinking = 500;
const maxThinkingRenderCount = 300;
const renderBatchSize = 40;

export function useResearchThinkingWindow(thinkingTimeline: ThinkingTimelineItem[]) {
  const [showThinking, setShowThinking] = useState(true);
  const [showAllThinking, setShowAllThinking] = useState(false);
  const [showAllConfirmOpen, setShowAllConfirmOpen] = useState(false);
  const [visibleThinkingCount, setVisibleThinkingCount] = useState(maxVisibleThinking);
  const [thinkingWindowStart, setThinkingWindowStart] = useState(0);
  // Track which thinking blocks are collapsed (all except latest)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(new Set());
  // Track if latest typewriter is complete
  const [latestTypewriterComplete, setLatestTypewriterComplete] = useState(false);
  // Ref for auto-scroll
  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  const thinkingWindow = useMemo(() => {
    const total = thinkingTimeline.length;
    const expandedCap = total > maxExpandedThinking ? maxExpandedThinking : total;
    const desiredVisibleCount = showAllThinking
      ? Math.min(visibleThinkingCount, expandedCap)
      : Math.min(visibleThinkingCount, total);
    const isVirtualized = total > maxThinkingRenderCount;
    const renderLimit = isVirtualized
      ? Math.min(maxThinkingRenderCount, desiredVisibleCount)
      : desiredVisibleCount;
    const minStart = showAllThinking
      ? Math.max(0, total - expandedCap)
      : Math.max(0, total - desiredVisibleCount);
    const maxStart = Math.max(0, total - renderLimit);
    const clampedStart = Math.min(Math.max(thinkingWindowStart, minStart), maxStart);
    const endIndex = Math.min(total, clampedStart + renderLimit);

    return {
      total,
      expandedCap,
      desiredVisibleCount,
      renderLimit,
      minStart,
      maxStart,
      start: clampedStart,
      end: endIndex,
      isVirtualized,
    };
  }, [thinkingTimeline.length, showAllThinking, visibleThinkingCount, thinkingWindowStart]);

  const visibleThinking = useMemo(() => {
    return {
      items: thinkingTimeline.slice(thinkingWindow.start, thinkingWindow.end),
      offset: thinkingWindow.start,
    };
  }, [thinkingTimeline, thinkingWindow.start, thinkingWindow.end]);

  const hiddenThinkingCount = showAllThinking
    ? 0
    : Math.max(0, thinkingWindow.total - visibleThinking.items.length);
  const isExpandingThinking = showAllThinking && visibleThinkingCount < thinkingWindow.expandedCap;
  const loadMoreCap = Math.min(thinkingWindow.total, maxThinkingRenderCount);

  // Progressive rendering when showing all thinking entries (prevents long render spikes)
  useEffect(() => {
    if (!showAllThinking) {
      setVisibleThinkingCount((prev) => Math.min(prev, maxVisibleThinking));
      return;
    }
    if (visibleThinkingCount >= thinkingWindow.expandedCap) return;

    let cancelled = false;
    let handle: number | null = null;
    const expand = () => {
      if (cancelled) return;
      setVisibleThinkingCount((prev) =>
        Math.min(prev + renderBatchSize, thinkingWindow.expandedCap),
      );
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const supportsIdleCallback = typeof idleWindow.requestIdleCallback === 'function';

    if (supportsIdleCallback) {
      handle = idleWindow.requestIdleCallback(expand, { timeout: 200 });
    } else {
      handle = window.setTimeout(expand, 50);
    }

    return () => {
      cancelled = true;
      if (handle !== null) {
        if (supportsIdleCallback && typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(handle);
          return;
        }
        window.clearTimeout(handle);
      }
    };
  }, [showAllThinking, thinkingWindow.expandedCap, visibleThinkingCount]);

  useEffect(() => {
    if (showAllThinking && visibleThinkingCount > thinkingWindow.expandedCap) {
      setVisibleThinkingCount(thinkingWindow.expandedCap);
    }
  }, [showAllThinking, visibleThinkingCount, thinkingWindow.expandedCap]);

  useEffect(() => {
    setThinkingWindowStart((prev) => {
      const base = showAllThinking ? prev : thinkingWindow.maxStart;
      const clamped = Math.min(Math.max(base, thinkingWindow.minStart), thinkingWindow.maxStart);
      return clamped;
    });
  }, [showAllThinking, thinkingWindow.minStart, thinkingWindow.maxStart]);

  // Auto-collapse previous blocks when new thinking arrives
  useEffect(() => {
    if (thinkingTimeline.length > 1) {
      // Collapse all blocks except the latest (within current display window)
      const newCollapsed = new Set<number>();
      const startIndex = thinkingWindow.start;
      for (let i = startIndex; i < thinkingTimeline.length - 1; i++) {
        newCollapsed.add(i);
      }
      setCollapsedBlocks(newCollapsed);
      setLatestTypewriterComplete(false);
    }
  }, [thinkingTimeline.length, thinkingWindow.start]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [thinkingTimeline.length, latestTypewriterComplete]);
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [showAllThinking]);

  const toggleBlockCollapse = useCallback((index: number) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleToggleShowAll = useCallback(() => {
    if (!showAllThinking) {
      if (thinkingWindow.total > maxExpandedThinking) {
        setShowAllConfirmOpen(true);
        return;
      }
      setShowAllThinking(true);
      return;
    }
    setShowAllThinking(false);
  }, [showAllThinking, thinkingWindow.total]);

  const handleConfirmShowAll = useCallback(() => {
    setShowAllConfirmOpen(false);
    setShowAllThinking(true);
  }, []);

  const handleCancelShowAll = useCallback(() => {
    setShowAllConfirmOpen(false);
  }, []);

  const shiftThinkingWindow = useCallback(
    (delta: number) => {
      setThinkingWindowStart((prev) => {
        const next = prev + delta;
        return Math.min(Math.max(next, thinkingWindow.minStart), thinkingWindow.maxStart);
      });
    },
    [thinkingWindow.minStart, thinkingWindow.maxStart],
  );

  const jumpToLatestThinking = useCallback(() => {
    setThinkingWindowStart(thinkingWindow.maxStart);
  }, [thinkingWindow.maxStart]);

  const handleTypewriterComplete = useCallback(() => {
    setLatestTypewriterComplete(true);
  }, []);

  return {
    showThinking,
    setShowThinking,
    showAllThinking,
    showAllConfirmOpen,
    visibleThinkingCount,
    setVisibleThinkingCount,
    collapsedBlocks,
    thinkingScrollRef,
    thinkingWindow,
    visibleThinking,
    hiddenThinkingCount,
    isExpandingThinking,
    loadMoreCap,
    maxVisibleThinking,
    maxExpandedThinking,
    renderBatchSize,
    handleToggleShowAll,
    handleConfirmShowAll,
    handleCancelShowAll,
    shiftThinkingWindow,
    jumpToLatestThinking,
    toggleBlockCollapse,
    handleTypewriterComplete,
  };
}

export type ResearchThinkingWindow = ReturnType<typeof useResearchThinkingWindow>;
