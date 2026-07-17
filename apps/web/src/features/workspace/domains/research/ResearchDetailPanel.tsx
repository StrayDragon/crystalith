import { Button, Checkbox, Spinner } from '@material-tailwind/react';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  Science as ScienceIcon,
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  OpenInFull as OpenInFullIcon,
  CloseFullscreen as CloseFullscreenIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Download as DownloadIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { copyToClipboard } from '../../../../shared/clipboard';
import { useLayer } from '../../../../shared/layer';
import { toast } from '../../../../shared/toast';
import ResearchExportDialog from './ResearchExportDialog';
import type { ResearchSessionDetail, SSEEvent } from './useResearch';

type ResearchStepResponse = {
  type: string;
  outputData?: Record<string, unknown> | null;
  iteration: number;
};

function stepOutputData(step: ResearchStepResponse): Record<string, unknown> | null | undefined {
  return step.outputData ?? null;
}

// Typewriter component for streaming text effect
interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

function TypewriterText({ text, speed = 30, onComplete }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;

    setDisplayedText('');
    setIsComplete(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse">▊</span>}
    </span>
  );
}

// Collapsible thinking block
interface ThinkingBlockProps {
  item: {
    type: string;
    message: string;
    timestamp: number;
    iteration?: number;
    queries?: string[];
  };
  isLatest: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onTypewriterComplete: () => void;
}

const THINKING_BLOCK_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '120px 80px',
};

function ThinkingBlock({
  item,
  isLatest,
  isCollapsed,
  onToggle,
  onTypewriterComplete,
}: ThinkingBlockProps) {
  // Style based on type - no icon needed since backend message already includes emoji
  const typeStyles: Record<string, { bg: string; border: string }> = {
    start: { bg: 'bg-blue-50', border: 'border-blue-200' },
    planning: { bg: 'bg-blue-50', border: 'border-blue-200' },
    reasoning: { bg: 'bg-purple-50', border: 'border-purple-200' },
    plan_generated: { bg: 'bg-indigo-50', border: 'border-indigo-200' },
    searching: { bg: 'bg-cyan-50', border: 'border-cyan-200' },
    search_complete: { bg: 'bg-teal-50', border: 'border-teal-200' },
    search_result: { bg: 'bg-teal-50', border: 'border-teal-200' },
    analyzing: { bg: 'bg-amber-50', border: 'border-amber-200' },
    analysis_complete: { bg: 'bg-orange-50', border: 'border-orange-200' },
    insight: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
    decision: { bg: 'bg-rose-50', border: 'border-rose-200' },
    new_iteration: { bg: 'bg-violet-50', border: 'border-violet-200' },
    generating_report: { bg: 'bg-green-50', border: 'border-green-200' },
    report_complete: { bg: 'bg-emerald-50', border: 'border-emerald-200' },
    waiting_user: { bg: 'bg-gray-50', border: 'border-gray-200' },
    completed: { bg: 'bg-green-50', border: 'border-green-200' },
    connection: { bg: 'bg-gray-50', border: 'border-gray-200' },
  };

  const style = typeStyles[item.type] || { bg: 'bg-gray-50', border: 'border-gray-200' };

  // Collapsed view - show first line (which includes emoji from backend)
  if (isCollapsed && !isLatest) {
    return (
      <button
        onClick={onToggle}
        className={`w-full text-left text-sm p-2 rounded-lg border ${style.bg} ${style.border} hover:brightness-95 transition-all flex items-center gap-2 group`}
        style={THINKING_BLOCK_VISIBILITY_STYLE}
      >
        <span className="text-gray-600 truncate flex-1 text-xs">
          {item.message.split('\n')[0].slice(0, 50)}...
        </span>
        <KeyboardArrowDownIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
      </button>
    );
  }

  const content = (
    <div className="flex-1 min-w-0">
      <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
        {isLatest ? (
          <TypewriterText text={item.message} speed={20} onComplete={onTypewriterComplete} />
        ) : (
          item.message
        )}
      </p>
      {/* Display search queries if present */}
      {item.queries && item.queries.length > 0 && (
        <div className="mt-2 space-y-1">
          {(() => {
            const queryCounts = new Map<string, number>();
            return item.queries.map((query) => {
              const ordinal = queryCounts.get(query) ?? 0;
              queryCounts.set(query, ordinal + 1);
              const queryKey = `${query}:${ordinal}`;
              return (
                <div
                  key={queryKey}
                  className="flex items-start gap-2 text-xs bg-white/50 rounded px-2 py-1.5 border border-gray-200/50"
                >
                  <SearchIcon className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{query}</span>
                </div>
              );
            });
          })()}
        </div>
      )}
      {item.iteration && <p className="text-xs text-gray-400 mt-1">第 {item.iteration} 轮</p>}
    </div>
  );

  if (!isLatest) {
    return (
      <button
        type="button"
        className={`w-full text-left text-sm p-3 rounded-lg border ${style.bg} ${style.border} transition-all cursor-pointer hover:brightness-95`}
        style={THINKING_BLOCK_VISIBILITY_STYLE}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`text-sm p-3 rounded-lg border ${style.bg} ${style.border} transition-all`}
      style={THINKING_BLOCK_VISIBILITY_STYLE}
    >
      {content}
    </div>
  );
}

interface ResearchDetailPanelProps {
  session: ResearchSessionDetail;
  sseEvents: SSEEvent[];
  onClose: () => void;
  onApprove: (feedback?: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onFinish: () => Promise<void>;
  onCancel: () => Promise<void>;
  onResume: () => Promise<void>;
  onRetry: () => Promise<void>;
  onStart: () => Promise<void>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onAddSourceFromUrl?: (url: string) => Promise<void>;
}

// Status badge colors
const STATUS_COLORS = {
  planning: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  searching: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  analyzing: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  waiting_user: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
};

const STATUS_LABELS = {
  planning: '规划中',
  searching: '搜索中',
  analyzing: '分析中',
  waiting_user: '待确认',
  completed: '已完成',
  cancelled: '已取消',
};

function ResearchDetailPanel({
  session,
  sseEvents,
  onClose,
  onApprove,
  onSkip,
  onFinish,
  onCancel,
  onResume,
  onRetry,
  onStart,
  // Default to fullscreen
  isFullscreen = true,
  onToggleFullscreen,
  onAddSourceFromUrl,
}: ResearchDetailPanelProps) {
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showAllThinking, setShowAllThinking] = useState(false);
  const [showAllConfirmOpen, setShowAllConfirmOpen] = useState(false);
  const maxVisibleThinking = 80;
  const maxExpandedThinking = 500;
  const maxThinkingRenderCount = 300;
  const renderBatchSize = 40;
  const [visibleThinkingCount, setVisibleThinkingCount] = useState(maxVisibleThinking);
  const [thinkingWindowStart, setThinkingWindowStart] = useState(0);
  // Track which thinking blocks are collapsed (all except latest)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(new Set());
  // Track if latest typewriter is complete
  const [latestTypewriterComplete, setLatestTypewriterComplete] = useState(false);
  // Ref for auto-scroll
  const thinkingScrollRef = useRef<HTMLDivElement>(null);
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { style: confirmModalStyle } = useLayer('modal', 1);

  // Extract latest search progress from SSE events
  const searchProgress = useMemo(() => {
    const progressEvents = sseEvents.filter((e) => e.type === 'search_progress');
    if (progressEvents.length === 0) return null;
    const latest = progressEvents.at(-1);
    if (latest?.type === 'search_progress') {
      return latest.data.data;
    }
    return null;
  }, [sseEvents]);

  // Extract latest analysis info from SSE events
  const analysisProgress = useMemo(() => {
    const analysisEvents = sseEvents.filter((e) => e.type === 'analysis');
    if (analysisEvents.length === 0) return null;
    const latest = analysisEvents.at(-1);
    if (latest?.type === 'analysis') {
      const payload = latest.data.data;
      return {
        ...payload,
        coverage: payload.coverageEstimate ?? 0,
      };
    }
    return null;
  }, [sseEvents]);
  const latestErrorEvent = useMemo(() => {
    const errorEvents = sseEvents.filter(
      (event): event is Extract<SSEEvent, { type: 'error' }> => event.type === 'error',
    );
    if (errorEvents.length === 0) return null;
    return errorEvents.at(-1);
  }, [sseEvents]);
  // Show results dialog
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  // Selected results for export
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  // Adding sources state
  const [isAddingSources, setIsAddingSources] = useState(false);

  // Get latest plan from SSE events or steps
  const latestPlanEvent = [...sseEvents].toReversed().find((e) => e.type === 'plan_ready');
  const latestPlanFromSteps = useMemo(() => {
    if (!session.steps || session.steps.length === 0) return null;
    const planStep = [...session.steps]
      .toReversed()
      .find((step) => step.type === 'plan' && stepOutputData(step));
    const planData = planStep ? stepOutputData(planStep) : null;
    if (!planStep || !planData) return null;
    const plan = planData as {
      queries?: Array<{ query: string; engine: string; priority: number; reason: string }>;
      reasoning?: string;
    };
    if (!Array.isArray(plan.queries)) return null;
    return {
      queries: plan.queries,
      reasoning: typeof plan.reasoning === 'string' ? plan.reasoning : '',
    };
  }, [session.steps]);
  const latestPlan =
    latestPlanEvent?.type === 'plan_ready' ? latestPlanEvent.data.data : latestPlanFromSteps;

  // Get queries from plan
  const queries = useMemo(() => latestPlan?.queries ?? [], [latestPlan]);

  // Extract thinking/reasoning timeline from events or reconstruct from steps
  const thinkingTimeline = useMemo(() => {
    const timeline: Array<{
      type: string;
      message: string;
      timestamp: number;
      iteration?: number;
      queries?: string[];
    }> = [];

    // For completed sessions, always reconstruct from steps for full history
    // For active sessions, use SSE events for real-time updates
    const isCompletedSession = session.status === 'completed';
    const steps = session.steps ?? [];
    const hasSteps = steps.length > 0;

    if (!isCompletedSession && sseEvents.length > 0) {
      // Real-time mode: use SSE events
      sseEvents.forEach((event, index) => {
        if (event.type === 'thinking') {
          timeline.push({
            type: event.data.type,
            message: event.data.message,
            timestamp: index,
            iteration: event.data.iteration,
            queries: event.data.queries,
          });
        }
        if (event.type === 'connection') {
          timeline.push({
            type: 'connection',
            message: `🔌 ${event.data.message}`,
            timestamp: index,
          });
        }
      });
    } else if (hasSteps) {
      // Reconstruct thinking timeline from saved steps (history mode)
      let timestampCounter = 0;

      // Add start message
      timeline.push({
        type: 'start',
        message: `🚀 开始深度研究「${session.topic}」`,
        timestamp: timestampCounter++,
        iteration: 1,
      });

      // Group steps by iteration
      const stepsByIteration: Record<number, ResearchStepResponse[]> = {};
      steps.forEach((step) => {
        if (!stepsByIteration[step.iteration]) {
          stepsByIteration[step.iteration] = [];
        }
        stepsByIteration[step.iteration].push(step);
      });

      // Process each iteration
      Object.entries(stepsByIteration).forEach(([iterStr, iterationSteps]) => {
        const iteration = Number(iterStr);

        iterationSteps.forEach((step) => {
          const output = stepOutputData(step);
          if (step.type === 'plan' && output) {
            // Plan step
            const reasoning = output.reasoning as string | undefined;
            const queryItems = output.queries as Array<{ query: string }> | undefined;

            if (reasoning) {
              timeline.push({
                type: 'reasoning',
                message: `💭 ${reasoning}`,
                timestamp: timestampCounter++,
                iteration,
              });
            }
            if (queryItems) {
              timeline.push({
                type: 'plan_generated',
                message: `📋 已生成 ${queryItems.length} 个搜索查询`,
                timestamp: timestampCounter++,
                iteration,
                queries: queryItems.map((q) => q.query),
              });
            }
          } else if (step.type === 'search' && output) {
            // Search step
            const resultCount = output.resultCount as number | undefined;
            const newResults = output.newResults as number | undefined;

            timeline.push({
              type: 'search_complete',
              message: `🔎 搜索完成，获取 ${resultCount || 0} 条结果，新增 ${newResults || 0} 条`,
              timestamp: timestampCounter++,
              iteration,
            });
          } else if (step.type === 'analyze' && output) {
            // Analyze step
            const coverage =
              (output.coverageEstimate as number | undefined) ??
              (output.coverage as number | undefined);
            const summary = output.summary as string | undefined;
            const needMore = output.needMore as boolean | undefined;

            timeline.push({
              type: 'analysis_complete',
              message: `📈 分析完成，覆盖度 ${Math.round((coverage || 0) * 100)}%`,
              timestamp: timestampCounter++,
              iteration,
            });

            if (summary) {
              timeline.push({
                type: 'insight',
                message: `💡 ${summary.slice(0, 150)}${summary.length > 150 ? '...' : ''}`,
                timestamp: timestampCounter++,
                iteration,
              });
            }

            if (needMore && iteration < session.maxIterations) {
              timeline.push({
                type: 'decision',
                message: '🔄 需要更多搜索，准备下一轮...',
                timestamp: timestampCounter++,
                iteration,
              });
            }
          } else if (step.type === 'summary' && output) {
            // Summary step
            const reportLength = output.reportLength as number | undefined;

            timeline.push({
              type: 'report_complete',
              message: `📝 报告生成完成，共 ${reportLength || 0} 字`,
              timestamp: timestampCounter++,
              iteration,
            });
          }
        });

        // Add iteration completion marker
        if (iteration < session.maxIterations || session.status === 'completed') {
          timeline.push({
            type: 'completed',
            message: `✅ 已完成第 ${iteration} 轮研究`,
            timestamp: timestampCounter++,
            iteration,
          });
        }
      });
    }

    return timeline;
  }, [sseEvents, session.steps, session.topic, session.maxIterations, session.status]);
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
  }, [
    thinkingTimeline.length,
    showAllThinking,
    visibleThinkingCount,
    thinkingWindowStart,
    maxExpandedThinking,
    maxThinkingRenderCount,
  ]);

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
      handle = idleWindow.requestIdleCallback!(expand, { timeout: 200 });
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
  }, [
    showAllThinking,
    thinkingWindow.expandedCap,
    visibleThinkingCount,
    maxVisibleThinking,
    renderBatchSize,
  ]);

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
  }, [showAllThinking, thinkingWindow.total, maxExpandedThinking]);

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

  // Initialize selected queries
  useEffect(() => {
    if (queries.length > 0 && selectedQueries.size === 0) {
      setSelectedQueries(new Set(queries.map((_: { query: string }, i: number) => i)));
    }
  }, [queries, selectedQueries.size]);

  const toggleQuery = useCallback((index: number) => {
    setSelectedQueries((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleApprove = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onApprove();
    } finally {
      setIsProcessing(false);
    }
  }, [onApprove]);

  const handleSkip = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onSkip();
    } finally {
      setIsProcessing(false);
    }
  }, [onSkip]);

  const handleFinish = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onFinish();
    } finally {
      setIsProcessing(false);
    }
  }, [onFinish]);

  const handleStart = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onStart();
    } finally {
      setIsProcessing(false);
    }
  }, [onStart]);

  const handleCancel = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onCancel();
    } finally {
      setIsProcessing(false);
    }
  }, [onCancel]);

  const handleResume = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onResume();
    } finally {
      setIsProcessing(false);
    }
  }, [onResume]);

  const handleRetry = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onRetry();
    } finally {
      setIsProcessing(false);
    }
  }, [onRetry]);

  // Status helpers
  const isWaiting = session.status === 'waiting_user';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const isSearching = session.status === 'searching';
  const isAnalyzing = session.status === 'analyzing';
  // 只有当状态是 planning 且没有任何 steps 时才显示"开始研究"按钮
  // 如果有 steps，说明研究已经开始过，即使状态是 planning 也不应该显示
  const hasSteps = session.steps && session.steps.length > 0;
  const isPlanning = session.status === 'planning' && !hasSteps;
  const statusKey = (
    session.status in STATUS_COLORS ? session.status : 'planning'
  ) as keyof typeof STATUS_COLORS;
  const statusColors = STATUS_COLORS[statusKey];

  // Get completed steps for this session
  const completedSteps = session.steps || [];

  // Group steps by iteration
  const stepsByIteration = completedSteps.reduce(
    (acc, step) => {
      if (!acc[step.iteration]) acc[step.iteration] = [];
      acc[step.iteration].push(step);
      return acc;
    },
    {} as Record<number, ResearchStepResponse[]>,
  );

  const completedIterations = Object.keys(stepsByIteration).length;
  const totalResults = session.aggregatedResults?.length || 0;

  // For completed sessions, use the actual completed iterations from steps
  // This handles cases where current_iteration wasn't properly updated in the database
  const displayIteration =
    isCompleted && completedIterations > 0 ? completedIterations : session.currentIteration;

  return (
    <div className={`flex flex-col ${isFullscreen ? 'h-[90vh]' : 'h-[600px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="返回"
          >
            <ArrowBackIcon className="w-5 h-5 text-gray-500" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate">{session.topic}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors.bg} ${statusColors.text}`}
              >
                {STATUS_LABELS[statusKey]}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                第 {session.currentIteration}/{session.maxIterations} 轮
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={isFullscreen ? '缩小' : '全屏'}
            >
              {isFullscreen ? (
                <CloseFullscreenIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <OpenInFullIcon className="w-5 h-5 text-gray-400" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content Area - Two Column Layout in Fullscreen */}
      <div className={`flex-1 overflow-hidden flex ${isFullscreen ? 'flex-row' : 'flex-col'}`}>
        {/* Thinking Timeline Panel - Left Side in Fullscreen */}
        {isFullscreen && (
          <div className="w-80 border-r border-gray-100 flex flex-col flex-shrink-0 bg-gray-50/30">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <PsychologyIcon className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">思考过程</span>
                {thinkingTimeline.length > 0 && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                    {thinkingTimeline.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {thinkingTimeline.length > maxVisibleThinking && showThinking && (
                  <button
                    onClick={handleToggleShowAll}
                    className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    {showAllThinking ? '仅显示最新' : '显示全部'}
                  </button>
                )}
                <button
                  onClick={() => setShowThinking(!showThinking)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  {showThinking ? '收起' : '展开'}
                </button>
              </div>
            </div>
            {showThinking && (
              <div
                ref={thinkingScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth"
              >
                {showAllThinking && thinkingWindow.total > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
                    <span>
                      已展示 {thinkingWindow.start + 1}-{thinkingWindow.end} /{' '}
                      {thinkingWindow.total} 条
                    </span>
                    <div className="flex items-center gap-1">
                      {thinkingWindow.start > thinkingWindow.minStart && (
                        <button
                          onClick={() => shiftThinkingWindow(-renderBatchSize)}
                          className="text-[11px] text-purple-600 hover:text-purple-700"
                        >
                          更早
                        </button>
                      )}
                      {thinkingWindow.start < thinkingWindow.maxStart && (
                        <button
                          onClick={jumpToLatestThinking}
                          className="text-[11px] text-purple-600 hover:text-purple-700"
                        >
                          最新
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {!showAllThinking && hiddenThinkingCount > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
                    <span>已隐藏 {hiddenThinkingCount} 条较早记录</span>
                    <button
                      onClick={() =>
                        setVisibleThinkingCount((prev) =>
                          Math.min(prev + maxVisibleThinking, loadMoreCap),
                        )
                      }
                      className="text-[11px] text-purple-600 hover:text-purple-700"
                    >
                      加载更多
                    </button>
                  </div>
                )}
                {showAllThinking && isExpandingThinking && (
                  <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
                    <span>
                      正在展开 {Math.min(visibleThinkingCount, thinkingWindow.expandedCap)}/
                      {thinkingWindow.expandedCap} 条记录
                    </span>
                    <span className="text-purple-600">...</span>
                  </div>
                )}
                {thinkingTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <AutoAwesomeIcon className="w-8 h-8 mb-2 animate-pulse opacity-50" />
                    <span className="text-sm">等待思考内容...</span>
                  </div>
                ) : (
                  <>
                    {visibleThinking.items.map((item, index) => {
                      const globalIndex = index + visibleThinking.offset;
                      const isLatest = globalIndex === thinkingTimeline.length - 1;
                      const isCollapsed = collapsedBlocks.has(globalIndex);

                      return (
                        <ThinkingBlock
                          key={globalIndex}
                          item={item}
                          isLatest={isLatest}
                          isCollapsed={isCollapsed}
                          onToggle={() => toggleBlockCollapse(globalIndex)}
                          onTypewriterComplete={handleTypewriterComplete}
                        />
                      );
                    })}
                  </>
                )}
                {/* Auto-scroll indicator when processing and typewriter not yet showing */}
                {(isSearching || isAnalyzing || isPlanning) && thinkingTimeline.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-purple-500 bg-purple-50 p-3 rounded-lg border border-purple-100 animate-pulse">
                    <AutoAwesomeIcon className="w-4 h-4 animate-spin" />
                    <span>正在思考中...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Content - Right Side */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Progress Bar - Compact Style */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-green-500' : 'bg-blue-500'
                    } ${isSearching || isAnalyzing ? 'animate-pulse' : ''}`}
                    style={{
                      width: `${isCompleted ? 100 : Math.round(((displayIteration - 1) / session.maxIterations) * 100 + 100 / session.maxIterations / 2)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                第 {displayIteration}/{session.maxIterations} 轮
              </span>
            </div>
            {latestErrorEvent && !isCompleted && !isCancelled && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                <WarningIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{latestErrorEvent.data.message}</span>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            {/* Planning State - Show Start Button (only when no steps exist) */}
            {isPlanning && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ScienceIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">准备开始深度研究</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      系统将自动生成搜索策略，执行多轮搜索并分析结果。
                    </p>
                    <Button
                      size="sm"
                      color="blue"
                      onClick={(..._args) => {
                        void handleStart();
                      }}
                      disabled={isProcessing}
                      className="flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <PlayIcon className="w-4 h-4" />
                      )}
                      开始研究
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Interrupted State - Research has steps but status is planning (connection lost) */}
            {session.status === 'planning' && hasSteps && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <ScienceIcon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">研究已中断</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      此研究因连接中断而暂停。您可以基于已收集的数据重新生成报告，或停止并归档此研究。
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="blue"
                        onClick={() => {
                          void handleFinish();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <AssignmentIcon className="w-4 h-4" />
                        )}
                        重新生成
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        color="gray"
                        onClick={() => {
                          void handleCancel();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <StopIcon className="w-4 h-4" />
                        )}
                        停止并归档
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cancelled State */}
            {isCancelled && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <StopIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">研究已取消</h3>
                    <p className="text-sm text-gray-600">
                      此研究已被取消。您可以在左侧查看已完成的步骤记录。
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        color="blue"
                        onClick={() => {
                          void handleResume();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <PlayIcon className="w-4 h-4" />
                        )}
                        继续研究
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        color="gray"
                        onClick={() => {
                          void handleRetry();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <AutoAwesomeIcon className="w-4 h-4" />
                        )}
                        重新开始
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Searching/Analyzing State */}
            {(isSearching || isAnalyzing) && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    {isSearching ? (
                      <SearchIcon className="w-4 h-4 text-purple-600 animate-pulse" />
                    ) : (
                      <AnalyticsIcon className="w-4 h-4 text-purple-600 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {isSearching ? '正在执行搜索...' : '正在分析结果...'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {isSearching && searchProgress ? (
                        <>
                          已获取{' '}
                          <span className="font-medium text-purple-600">
                            {searchProgress.resultCount}
                          </span>{' '}
                          条结果，新增{' '}
                          <span className="font-medium text-purple-600">
                            {searchProgress.newResults}
                          </span>{' '}
                          条
                        </>
                      ) : isAnalyzing && analysisProgress ? (
                        <>
                          覆盖度{' '}
                          <span className="font-medium text-purple-600">
                            {Math.round(analysisProgress.coverage * 100)}%
                          </span>
                        </>
                      ) : (
                        '请稍候，这可能需要几秒钟'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting State - Simplified Query Selection */}
            {isWaiting && latestPlan && (
              <div className="space-y-4">
                {/* Reasoning Card */}
                {latestPlan.reasoning && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1 font-medium">AI 分析</p>
                    <p className="text-sm text-gray-800">{latestPlan.reasoning}</p>
                  </div>
                )}

                {/* Query Selection */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      搜索查询 ({selectedQueries.size}/{queries.length} 已选)
                    </span>
                    <button
                      onClick={() => {
                        if (selectedQueries.size === queries.length) {
                          setSelectedQueries(new Set());
                        } else {
                          setSelectedQueries(
                            new Set(queries.map((_: { query: string }, i: number) => i)),
                          );
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedQueries.size === queries.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(() => {
                      const keyCounts = new Map<string, number>();
                      return queries.map(
                        (
                          query: {
                            query: string;
                            engine: string;
                            priority: number;
                            reason: string;
                          },
                          index: number,
                        ) => {
                          const checkboxId = `research-query-${index}`;
                          const baseKey = `${query.engine}:${query.priority}:${query.query}`;
                          const ordinal = keyCounts.get(baseKey) ?? 0;
                          keyCounts.set(baseKey, ordinal + 1);
                          const queryKey = `${baseKey}:${ordinal}`;
                          return (
                            <label
                              key={queryKey}
                              htmlFor={checkboxId}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                                selectedQueries.has(index) ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={selectedQueries.has(index)}
                                onChange={() => toggleQuery(index)}
                                crossOrigin={undefined}
                                className="w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">{query.query}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {query.engine} ·{' '}
                                  {query.priority === 1
                                    ? '高优先级'
                                    : query.priority === 2
                                      ? '中优先级'
                                      : '低优先级'}
                                </p>
                              </div>
                            </label>
                          );
                        },
                      );
                    })()}
                  </div>
                </div>

                {/* Action Buttons - Clear Visual Hierarchy */}
                <div className="flex flex-col gap-2">
                  <Button
                    fullWidth
                    color="blue"
                    onClick={() => {
                      void handleApprove();
                    }}
                    disabled={isProcessing || selectedQueries.size === 0}
                    className="flex items-center justify-center gap-2 py-2.5"
                  >
                    {isProcessing ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <SearchIcon className="w-4 h-4" />
                    )}
                    执行选中的 {selectedQueries.size} 个搜索
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      fullWidth
                      variant="outlined"
                      color="gray"
                      onClick={() => {
                        void handleSkip();
                      }}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 py-2"
                    >
                      <SkipIcon className="w-4 h-4" />
                      跳过本轮
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="amber"
                      onClick={() => {
                        void handleFinish();
                      }}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 py-2"
                    >
                      <StopIcon className="w-4 h-4" />
                      结束研究
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Final Report */}
            {isCompleted && session.finalReport && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AssignmentIcon className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">研究报告</h3>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {session.finalReport}
                  </pre>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    color="blue"
                    className="flex-1"
                    onClick={() => setShowExportDialog(true)}
                  >
                    <DownloadIcon className="w-4 h-4 mr-1" />
                    导出成果
                  </Button>
                  <Button
                    size="sm"
                    variant="outlined"
                    color="gray"
                    className="flex-1"
                    onClick={() => {
                      if (session.finalReport) {
                        void copyToClipboard(session.finalReport).then((success) => {
                          if (success) {
                            toast.success('报告已复制到剪贴板');
                          } else {
                            toast.error('复制失败，请稍后重试');
                          }
                        });
                      }
                    }}
                  >
                    复制报告
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            <span className="font-medium text-gray-900">{totalResults}</span> 条结果
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            <span className="font-medium text-gray-900">{completedIterations}</span> 轮完成
          </span>
        </div>
        {totalResults > 0 && (
          <button
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => {
              setShowResultsDialog(true);
              setSelectedResults(new Set());
            }}
          >
            查看所有结果
          </button>
        )}
      </div>

      {showAllConfirmOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 relative"
          style={confirmModalStyle}
          role="dialog"
          aria-modal="true"
          aria-label="展开全部思考记录确认"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default"
            onClick={handleCancelShowAll}
            aria-label="关闭对话框"
          />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">展开全部思考记录？</h3>
              <button
                onClick={handleCancelShowAll}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-600 space-y-2">
              <p>思考记录已超过 {maxExpandedThinking} 条，全部展开可能影响性能。</p>
              <p>默认仅展示最近 {maxExpandedThinking} 条，是否继续？</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <Button variant="text" size="sm" color="gray" onClick={handleCancelShowAll}>
                取消
              </Button>
              <Button size="sm" color="blue" onClick={handleConfirmShowAll}>
                继续展开
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Dialog */}
      {showResultsDialog && session.aggregatedResults && (
        <ResultsDialogContent
          session={session}
          selectedResults={selectedResults}
          setSelectedResults={setSelectedResults}
          onClose={() => setShowResultsDialog(false)}
          onAddSourceFromUrl={onAddSourceFromUrl}
          isAddingSources={isAddingSources}
          setIsAddingSources={setIsAddingSources}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ResearchExportDialog session={session} onClose={() => setShowExportDialog(false)} />
      )}
    </div>
  );
}

// Extracted Results Dialog component to use hooks
interface ResultsDialogContentProps {
  session: ResearchSessionDetail;
  selectedResults: Set<number>;
  setSelectedResults: React.Dispatch<React.SetStateAction<Set<number>>>;
  onClose: () => void;
  onAddSourceFromUrl?: (url: string) => Promise<void>;
  isAddingSources: boolean;
  setIsAddingSources: React.Dispatch<React.SetStateAction<boolean>>;
}

function ResultsDialogContent({
  session,
  selectedResults,
  setSelectedResults,
  onClose,
  onAddSourceFromUrl,
  isAddingSources,
  setIsAddingSources,
}: ResultsDialogContentProps) {
  const { style: modalStyle } = useLayer('modal');
  const aggregatedResults = session.aggregatedResults ?? [];

  const handleCopyLinks = () => {
    const selectedUrls = Array.from(selectedResults)
      .map((i) => aggregatedResults[i]?.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);
    void copyToClipboard(selectedUrls.join('\n')).then((success) => {
      if (success) {
        toast.success(`已复制 ${selectedUrls.length} 个链接`);
      } else {
        toast.error('复制失败，请稍后重试');
      }
    });
  };

  const handleAddSources = async () => {
    if (!onAddSourceFromUrl) return;
    setIsAddingSources(true);
    try {
      const selectedUrls = Array.from(selectedResults)
        .map((i) => aggregatedResults[i]?.url)
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
      const results = await Promise.allSettled(selectedUrls.map((url) => onAddSourceFromUrl(url)));
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error('Failed to add source:', selectedUrls[index], result.reason);
        }
      });
      if (successCount > 0) {
        toast.success(`已添加 ${successCount} 个来源`);
      }
      if (successCount < selectedUrls.length) {
        toast.error(`${selectedUrls.length - successCount} 个来源添加失败`);
      }
      onClose();
    } finally {
      setIsAddingSources(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 relative"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="搜索结果"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        onClick={onClose}
        aria-label="关闭对话框"
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col relative z-10">
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">搜索结果</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              共 {aggregatedResults.length} 条结果，已选 {selectedResults.size} 条
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedResults.size === aggregatedResults.length) {
                  setSelectedResults(new Set());
                } else {
                  setSelectedResults(new Set(aggregatedResults.map((_, i) => i)));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1"
            >
              {selectedResults.size === aggregatedResults.length ? '取消全选' : '全选'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(() => {
            const keyCounts = new Map<string, number>();
            return aggregatedResults.map((result, index) => {
              const url = typeof result.url === 'string' ? result.url : '';
              const title = typeof result.title === 'string' ? result.title : null;
              const snippet = typeof result.snippet === 'string' ? result.snippet : null;
              const source = typeof result.source === 'string' ? result.source : null;
              const iteration = typeof result.iteration === 'number' ? result.iteration : null;
              const baseKey = `${url}:${title ?? ''}:${source ?? ''}:${iteration ?? ''}`;
              const ordinal = keyCounts.get(baseKey) ?? 0;
              keyCounts.set(baseKey, ordinal + 1);
              const resultKey = `${baseKey}:${ordinal}`;
              const checkboxId = `research-result-${index}`;
              return (
                <label
                  key={resultKey}
                  htmlFor={checkboxId}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedResults.has(index)
                      ? 'border-blue-300 bg-blue-50/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selectedResults.has(index)}
                    onChange={() => {
                      setSelectedResults((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) {
                          next.delete(index);
                        } else {
                          next.add(index);
                        }
                        return next;
                      });
                    }}
                    crossOrigin={undefined}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline line-clamp-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {title || '未知标题'}
                    </a>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {snippet || '无摘要'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{source || 'web'}</span>
                      {iteration != null && (
                        <span className="text-xs text-gray-400">· 第 {iteration} 轮</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            });
          })()}
        </div>

        {/* Dialog Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-500">选中的链接可以添加为来源</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outlined" color="gray" onClick={onClose}>
              取消
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color="blue"
              disabled={selectedResults.size === 0}
              onClick={handleCopyLinks}
            >
              复制链接
            </Button>
            {onAddSourceFromUrl && (
              <Button
                size="sm"
                color="blue"
                disabled={selectedResults.size === 0 || isAddingSources}
                onClick={() => {
                  void handleAddSources();
                }}
              >
                {isAddingSources ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1" />
                    添加中...
                  </>
                ) : (
                  `添加 ${selectedResults.size} 个来源`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ResearchDetailPanel);
