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
} from '@mui/icons-material';
import type { ResearchSessionResponse, ResearchStepResponse } from '../../../api/client';
import type { SSEEvent } from '../hooks/useResearch';
import { toast } from '../../../shared/toast';

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
}: ResearchDetailPanelProps) {
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCompletedRounds, setShowCompletedRounds] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  // Track which thinking blocks are collapsed (all except latest)
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<number>>(new Set());
  // Track if latest typewriter is complete
  const [latestTypewriterComplete, setLatestTypewriterComplete] = useState(false);
  // Ref for auto-scroll
  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  // Get latest plan from SSE events or steps
  const latestPlanEvent = [...sseEvents].reverse().find((e) => e.type === 'plan_ready');
  const latestPlan = latestPlanEvent?.type === 'plan_ready' ? latestPlanEvent.data.plan : null;

  // Get queries from plan
  const queries = latestPlan?.queries || [];

  // Extract thinking/reasoning timeline from events - prioritize thinking events
  const thinkingTimeline = useMemo(() => {
    const timeline: Array<{
      type: string;
      message: string;
      timestamp: number;
      iteration?: number;
      queries?: string[];
    }> = [];

    sseEvents.forEach((event, index) => {
      // Prioritize thinking events from backend
      if (event.type === 'thinking') {
        timeline.push({
          type: event.data.type,
          message: event.data.message,
          timestamp: index,
          iteration: event.data.iteration,
          queries: event.data.queries, // Include search queries if present
        });
      }
    });

    return timeline;
  }, [sseEvents]);

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
          {/* Progress Steps - Visual Timeline */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              {Array.from({ length: session.max_iterations }).map((_, i) => {
                const iterNum = i + 1;
                const isActive = iterNum === session.current_iteration;
                const isDone = iterNum < session.current_iteration || isCompleted;

                return (
                  <div key={i} className="flex items-center flex-1">
                    {/* Step Circle */}
                    <div className={`
                      relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium
                      transition-all duration-200
                      ${isDone ? 'bg-blue-500 text-white' :
                        isActive ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-2' :
                        'bg-gray-100 text-gray-400'}
                    `}>
                      {isDone ? <CheckIcon className="w-4 h-4" /> : iterNum}
                      {isActive && (isSearching || isAnalyzing) && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    {/* Connector Line */}
                    {i < session.max_iterations - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded-full ${
                        isDone ? 'bg-blue-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                );
              })}
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
                <div>
                  <h3 className="font-medium text-gray-900">
                    {isSearching ? '正在执行搜索...' : '正在分析结果...'}
                  </h3>
                  <p className="text-sm text-gray-500">请稍候，这可能需要几秒钟</p>
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

          {/* Completed Iterations - Collapsible */}
          {completedIterations > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCompletedRounds(!showCompletedRounds)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  已完成 {completedIterations} 轮研究
                </span>
                {showCompletedRounds ? (
                  <ExpandLessIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <ExpandMoreIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {showCompletedRounds && (
                <div className="divide-y divide-gray-100">
                  {Object.entries(stepsByIteration).map(([iteration, steps]) => (
                    <div key={iteration} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900">第 {iteration} 轮</span>
                        <span className="text-xs text-gray-400">{steps.length} 个步骤</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  onClick={() => toast.info('导出功能开发中')}
                >
                  导出到来源
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  color="gray"
                  className="flex-1"
                  onClick={() => {
                    if (session.final_report) {
                      navigator.clipboard.writeText(session.final_report);
                      toast.success('报告已复制到剪贴板');
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
            onClick={() => toast.info('结果详情功能开发中')}
          >
            查看所有结果
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ResearchDetailPanel);
