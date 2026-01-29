import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Button,
  Typography,
  IconButton,
  Chip,
  Checkbox,
  Spinner,
} from '@material-tailwind/react';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  Add as AddIcon,
  Science as ScienceIcon,
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInFull as OpenInFullIcon,
  CloseFullscreen as CloseFullscreenIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { ResearchSessionResponse, ResearchStepResponse } from '../../../../api/client';
import type { SSEEvent } from './useResearch';
import { toast } from '../../../../shared/toast';
import ResearchExportDialog from './ResearchExportDialog';
import { useLayer } from '../../../../shared/layer';
import { copyToClipboard } from '../../../../shared/clipboard';

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

function ThinkingBlock({ item, isLatest, isCollapsed, onToggle, onTypewriterComplete }: ThinkingBlockProps) {
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
  };

  const style = typeStyles[item.type] || { bg: 'bg-gray-50', border: 'border-gray-200' };

  // Collapsed view - show first line (which includes emoji from backend)
  if (isCollapsed && !isLatest) {
    return (
      <button
        onClick={onToggle}
        className={`w-full text-left text-sm p-2 rounded-lg border ${style.bg} ${style.border} hover:brightness-95 transition-all flex items-center gap-2 group`}
      >
        <span className="text-gray-600 truncate flex-1 text-xs">
          {item.message.split('\n')[0].slice(0, 50)}...
        </span>
        <KeyboardArrowDownIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className={`text-sm p-3 rounded-lg border ${style.bg} ${style.border} transition-all ${!isLatest ? 'cursor-pointer hover:brightness-95' : ''}`}
         onClick={!isLatest ? onToggle : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
          {isLatest ? (
            <TypewriterText
              text={item.message}
              speed={20}
              onComplete={onTypewriterComplete}
            />
          ) : (
            item.message
          )}
        </p>
        {/* Display search queries if present */}
        {item.queries && item.queries.length > 0 && (
          <div className="mt-2 space-y-1">
            {item.queries.map((query, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs bg-white/50 rounded px-2 py-1.5 border border-gray-200/50">
                <SearchIcon className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600">{query}</span>
              </div>
            ))}
          </div>
        )}
        {item.iteration && (
          <p className="text-xs text-gray-400 mt-1">第 {item.iteration} 轮</p>
        )}
      </div>
    </div>
  );
}

interface ResearchDetailPanelProps {
  session: ResearchSessionResponse;
  sseEvents: SSEEvent[];
  onClose: () => void;
  onApprove: (feedback?: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onFinish: () => Promise<void>;
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
  onStart,
  isFullscreen = true, // Default to fullscreen
  onToggleFullscreen,
  onAddSourceFromUrl,
}: ResearchDetailPanelProps) {
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  // Track which thinking blocks are collapsed (all except latest)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(new Set());
  // Track if latest typewriter is complete
  const [latestTypewriterComplete, setLatestTypewriterComplete] = useState(false);
  // Ref for auto-scroll
  const thinkingScrollRef = useRef<HTMLDivElement>(null);
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Extract latest search progress from SSE events
  const searchProgress = useMemo(() => {
    const progressEvents = sseEvents.filter(e => e.type === 'search_progress');
    if (progressEvents.length === 0) return null;
    const latest = progressEvents[progressEvents.length - 1];
    if (latest.type === 'search_progress') {
      return latest.data;
    }
    return null;
  }, [sseEvents]);

  // Extract latest analysis info from SSE events
  const analysisProgress = useMemo(() => {
    const analysisEvents = sseEvents.filter(e => e.type === 'analysis');
    if (analysisEvents.length === 0) return null;
    const latest = analysisEvents[analysisEvents.length - 1];
    if (latest.type === 'analysis') {
      return latest.data;
    }
    return null;
  }, [sseEvents]);
  // Show results dialog
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  // Selected results for export
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  // Adding sources state
  const [isAddingSources, setIsAddingSources] = useState(false);

  // Get latest plan from SSE events or steps
  const latestPlanEvent = [...sseEvents].reverse().find((e) => e.type === 'plan_ready');
  const latestPlanFromSteps = useMemo(() => {
    if (!session.steps || session.steps.length === 0) return null;
    const planStep = [...session.steps]
      .reverse()
      .find((step) => step.type === 'plan' && step.output_data);
    if (!planStep || !planStep.output_data) return null;
    const plan = planStep.output_data as {
      queries?: Array<{ query: string; engine: string; priority: number; reason: string }>;
      reasoning?: string;
    };
    if (!Array.isArray(plan.queries)) return null;
    return {
      queries: plan.queries,
      reasoning: typeof plan.reasoning === 'string' ? plan.reasoning : '',
    };
  }, [session.steps]);
  const latestPlan = latestPlanEvent?.type === 'plan_ready' ? latestPlanEvent.data.plan : latestPlanFromSteps;

  // Get queries from plan
  const queries = latestPlan?.queries || [];

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
    const hasSteps = session.steps && session.steps.length > 0;

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
      const stepsByIteration: Record<number, typeof session.steps> = {};
      session.steps.forEach((step) => {
        if (!stepsByIteration[step.iteration]) {
          stepsByIteration[step.iteration] = [];
        }
        stepsByIteration[step.iteration].push(step);
      });

      // Process each iteration
      Object.entries(stepsByIteration).forEach(([iterStr, steps]) => {
        const iteration = parseInt(iterStr, 10);

        steps.forEach((step) => {
          if (step.type === 'plan' && step.output_data) {
            // Plan step
            const reasoning = step.output_data.reasoning as string | undefined;
            const queries = step.output_data.queries as Array<{ query: string }> | undefined;

            if (reasoning) {
              timeline.push({
                type: 'reasoning',
                message: `💭 ${reasoning}`,
                timestamp: timestampCounter++,
                iteration,
              });
            }
            if (queries) {
              timeline.push({
                type: 'plan_generated',
                message: `📋 已生成 ${queries.length} 个搜索查询`,
                timestamp: timestampCounter++,
                iteration,
                queries: queries.map((q) => q.query),
              });
            }
          } else if (step.type === 'search' && step.output_data) {
            // Search step
            const resultCount = step.output_data.result_count as number | undefined;
            const newResults = step.output_data.new_results as number | undefined;

            timeline.push({
              type: 'search_complete',
              message: `🔎 搜索完成，获取 ${resultCount || 0} 条结果，新增 ${newResults || 0} 条`,
              timestamp: timestampCounter++,
              iteration,
            });
          } else if (step.type === 'analyze' && step.output_data) {
            // Analyze step
            const coverage = step.output_data.coverage as number | undefined;
            const summary = step.output_data.summary as string | undefined;
            const needMore = step.output_data.need_more_search as boolean | undefined;

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

            if (needMore && iteration < session.max_iterations) {
              timeline.push({
                type: 'decision',
                message: '🔄 需要更多搜索，准备下一轮...',
                timestamp: timestampCounter++,
                iteration,
              });
            }
          } else if (step.type === 'summary' && step.output_data) {
            // Summary step
            const reportLength = step.output_data.report_length as number | undefined;

            timeline.push({
              type: 'report_complete',
              message: `📝 报告生成完成，共 ${reportLength || 0} 字`,
              timestamp: timestampCounter++,
              iteration,
            });
          }
        });

        // Add iteration completion marker
        if (iteration < session.max_iterations || session.status === 'completed') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseEvents.length, session.steps, session.topic, session.max_iterations, session.status]);

  // Auto-collapse previous blocks when new thinking arrives
  useEffect(() => {
    if (thinkingTimeline.length > 1) {
      // Collapse all blocks except the latest
      const newCollapsed = new Set<number>();
      for (let i = 0; i < thinkingTimeline.length - 1; i++) {
        newCollapsed.add(i);
      }
      setCollapsedBlocks(newCollapsed);
      setLatestTypewriterComplete(false);
    }
  }, [thinkingTimeline.length]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [thinkingTimeline.length, latestTypewriterComplete]);

  const toggleBlockCollapse = useCallback((index: number) => {
    setCollapsedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleTypewriterComplete = useCallback(() => {
    setLatestTypewriterComplete(true);
  }, []);

  // Initialize selected queries
  useEffect(() => {
    if (queries.length > 0 && selectedQueries.size === 0) {
      setSelectedQueries(new Set(queries.map((_, i) => i)));
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

  // Status helpers
  const isWaiting = session.status === 'waiting_user';
  const isCompleted = session.status === 'completed';
  const isPlanning = session.status === 'planning';
  const isSearching = session.status === 'searching';
  const isAnalyzing = session.status === 'analyzing';
  const statusColors = STATUS_COLORS[session.status] || STATUS_COLORS.planning;

  // Get completed steps for this session
  const completedSteps = session.steps || [];

  // Group steps by iteration
  const stepsByIteration = completedSteps.reduce(
    (acc, step) => {
      if (!acc[step.iteration]) acc[step.iteration] = [];
      acc[step.iteration].push(step);
      return acc;
    },
    {} as Record<number, ResearchStepResponse[]>
  );

  const completedIterations = Object.keys(stepsByIteration).length;
  const totalResults = session.aggregated_results?.length || 0;

  // For completed sessions, use the actual completed iterations from steps
  // This handles cases where current_iteration wasn't properly updated in the database
  const displayIteration = isCompleted && completedIterations > 0
    ? completedIterations
    : session.current_iteration;

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
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {session.topic}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors.bg} ${statusColors.text}`}>
                {STATUS_LABELS[session.status]}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                第 {session.current_iteration}/{session.max_iterations} 轮
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
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                {showThinking ? '收起' : '展开'}
              </button>
            </div>
            {showThinking && (
              <div
                ref={thinkingScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth"
              >
                {thinkingTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <AutoAwesomeIcon className="w-8 h-8 mb-2 animate-pulse opacity-50" />
                    <span className="text-sm">等待思考内容...</span>
                  </div>
                ) : (
                  <>
                    {thinkingTimeline.map((item, index) => {
                      const isLatest = index === thinkingTimeline.length - 1;
                      const isCollapsed = collapsedBlocks.has(index);

                      return (
                        <ThinkingBlock
                          key={index}
                          item={item}
                          isLatest={isLatest}
                          isCollapsed={isCollapsed}
                          onToggle={() => toggleBlockCollapse(index)}
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
                    } ${(isSearching || isAnalyzing) ? 'animate-pulse' : ''}`}
                    style={{
                      width: `${isCompleted ? 100 : Math.round(((displayIteration - 1) / session.max_iterations) * 100 + (100 / session.max_iterations / 2))}%`
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                第 {displayIteration}/{session.max_iterations} 轮
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Planning State - Show Start Button */}
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
                    onClick={handleStart}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? <Spinner className="h-4 w-4" /> : <PlayIcon className="w-4 h-4" />}
                    开始研究
                  </Button>
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
                      <>已获取 <span className="font-medium text-purple-600">{searchProgress.result_count}</span> 条结果，新增 <span className="font-medium text-purple-600">{searchProgress.new_results}</span> 条</>
                    ) : isAnalyzing && analysisProgress ? (
                      <>覆盖度 <span className="font-medium text-purple-600">{Math.round(analysisProgress.coverage * 100)}%</span></>
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
                        setSelectedQueries(new Set(queries.map((_, i) => i)));
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedQueries.size === queries.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {queries.map((query, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedQueries.has(index) ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedQueries.has(index)}
                        onChange={() => toggleQuery(index)}
                        crossOrigin={undefined}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{query.query}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {query.engine} · {query.priority === 1 ? '高优先级' : query.priority === 2 ? '中优先级' : '低优先级'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons - Clear Visual Hierarchy */}
              <div className="flex flex-col gap-2">
                <Button
                  fullWidth
                  color="blue"
                  onClick={handleApprove}
                  disabled={isProcessing || selectedQueries.size === 0}
                  className="flex items-center justify-center gap-2 py-2.5"
                >
                  {isProcessing ? <Spinner className="h-4 w-4" /> : <SearchIcon className="w-4 h-4" />}
                  执行选中的 {selectedQueries.size} 个搜索
                </Button>
                <div className="flex gap-2">
                  <Button
                    fullWidth
                    variant="outlined"
                    color="gray"
                    onClick={handleSkip}
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
                    onClick={handleFinish}
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
          {isCompleted && session.final_report && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AssignmentIcon className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-gray-900">研究报告</h3>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-100 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                  {session.final_report}
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
                    if (session.final_report) {
                      void copyToClipboard(session.final_report).then((success) => {
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

      {/* Results Dialog */}
      {showResultsDialog && session.aggregated_results && (
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
        <ResearchExportDialog
          session={session}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}

// Extracted Results Dialog component to use hooks
interface ResultsDialogContentProps {
  session: ResearchSessionResponse;
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

  const handleCopyLinks = () => {
    const selectedUrls = Array.from(selectedResults).map(
      (i) => session.aggregated_results![i].url
    );
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
      const selectedUrls = Array.from(selectedResults).map(
        (i) => session.aggregated_results![i].url
      );
      let successCount = 0;
      for (const url of selectedUrls) {
        try {
          await onAddSourceFromUrl(url);
          successCount++;
        } catch (err) {
          console.error('Failed to add source:', url, err);
        }
      }
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
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={modalStyle}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">搜索结果</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              共 {session.aggregated_results!.length} 条结果，已选 {selectedResults.size} 条
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedResults.size === session.aggregated_results!.length) {
                  setSelectedResults(new Set());
                } else {
                  setSelectedResults(new Set(session.aggregated_results!.map((_, i) => i)));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1"
            >
              {selectedResults.size === session.aggregated_results!.length ? '取消全选' : '全选'}
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
          {session.aggregated_results!.map((result, index) => (
            <label
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedResults.has(index)
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Checkbox
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
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline line-clamp-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {result.title || '未知标题'}
                </a>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {result.snippet || '无摘要'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{result.source || 'web'}</span>
                  {result.iteration && (
                    <span className="text-xs text-gray-400">· 第 {result.iteration} 轮</span>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Dialog Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-500">
            选中的链接可以添加为来源
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outlined"
              color="gray"
              onClick={onClose}
            >
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
                onClick={handleAddSources}
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
