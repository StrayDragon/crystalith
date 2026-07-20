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
  AutoAwesome as AutoAwesomeIcon,
  Download as DownloadIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { copyToClipboard } from '../../../../shared/clipboard';
import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import { toast } from '../../../../shared/toast';
import { ResultsDialogContent } from './components/ResearchResultsDialog';
import { ResearchThinkingPanel } from './components/ResearchThinkingPanel';
import ResearchExportDialog from './ResearchExportDialog';
import {
  buildThinkingTimeline,
  stepOutputData,
  type ResearchStepResponse,
} from './thinkingTimeline';
import type { ResearchSessionDetail, ResearchStatus, SSEEvent } from './useResearch';
import { useResearchThinkingWindow } from './useResearchThinkingWindow';

export type ResearchPlanConfirmPayload = {
  queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
  reasoning: string;
  allSelected: boolean;
};

interface ResearchDetailPanelProps {
  session: ResearchSessionDetail;
  sseEvents: SSEEvent[];
  onClose: () => void;
  /** HITL: all selected → approve; subset → modify with filtered plan. */
  onApprove: (payload: ResearchPlanConfirmPayload) => Promise<void>;
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
} as const satisfies Record<ResearchStatus, { bg: string; text: string; border: string }>;

const STATUS_LABELS = {
  planning: '规划中',
  searching: '搜索中',
  analyzing: '分析中',
  waiting_user: '待确认',
  completed: '已完成',
  cancelled: '已取消',
} as const satisfies Record<ResearchStatus, string>;

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
      return latest.data.data ?? null;
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
  const thinkingTimeline = useMemo(
    () =>
      buildThinkingTimeline({
        sseEvents,
        steps: session.steps ?? [],
        topic: session.topic,
        maxIterations: session.maxIterations,
        status: session.status,
      }),
    [sseEvents, session.steps, session.topic, session.maxIterations, session.status],
  );
  const thinkingWindowState = useResearchThinkingWindow(thinkingTimeline);

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
    const selected = queries.filter((_, i) => selectedQueries.has(i));
    if (selected.length === 0) return;
    setIsProcessing(true);
    try {
      await onApprove({
        queries: selected,
        reasoning: typeof latestPlan?.reasoning === 'string' ? latestPlan.reasoning : '',
        allSelected: selected.length === queries.length,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onApprove, queries, selectedQueries, latestPlan]);

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
  const statusKey: ResearchStatus = session.status in STATUS_COLORS ? session.status : 'planning';
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
          <ResearchThinkingPanel
            {...thinkingWindowState}
            timelineLength={thinkingTimeline.length}
            isSearching={isSearching}
            isAnalyzing={isAnalyzing}
            isPlanning={isPlanning}
          />
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
                            {Math.round((analysisProgress.coverageEstimate ?? 0) * 100)}%
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
                              {...tid(`${TestIds.researchQueryCheckbox}-${index}`)}
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
                    {...tid(TestIds.researchApprovePlan)}
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

      {thinkingWindowState.showAllConfirmOpen && (
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
            onClick={thinkingWindowState.handleCancelShowAll}
            aria-label="关闭对话框"
          />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">展开全部思考记录？</h3>
              <button
                onClick={thinkingWindowState.handleCancelShowAll}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-600 space-y-2">
              <p>
                思考记录已超过 {thinkingWindowState.maxExpandedThinking} 条，全部展开可能影响性能。
              </p>
              <p>默认仅展示最近 {thinkingWindowState.maxExpandedThinking} 条，是否继续？</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <Button
                variant="text"
                size="sm"
                color="gray"
                onClick={thinkingWindowState.handleCancelShowAll}
              >
                取消
              </Button>
              <Button size="sm" color="blue" onClick={thinkingWindowState.handleConfirmShowAll}>
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

export default memo(ResearchDetailPanel);
