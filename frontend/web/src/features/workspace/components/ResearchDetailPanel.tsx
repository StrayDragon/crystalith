import { memo, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Typography,
  IconButton,
  Chip,
  Progress,
  Card,
  CardBody,
  Checkbox,
  Tooltip,
  Spinner,
} from '@material-tailwind/react';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  Add as AddIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { ResearchSessionResponse, ResearchStepResponse } from '../../../api/client';
import type { SSEEvent } from '../hooks/useResearch';

interface ResearchDetailPanelProps {
  session: ResearchSessionResponse;
  sseEvents: SSEEvent[];
  onClose: () => void;
  onApprove: (feedback?: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onFinish: () => Promise<void>;
  onStart: () => Promise<void>;
}

// Progress steps
const STEPS = ['规划', '搜索', '分析', '规划', '完成'] as const;

function ResearchDetailPanel({
  session,
  sseEvents,
  onClose,
  onApprove,
  onSkip,
  onFinish,
  onStart,
}: ResearchDetailPanelProps) {
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Get latest plan from SSE events or steps
  const latestPlanEvent = [...sseEvents].reverse().find((e) => e.type === 'plan_ready');
  const latestPlan = latestPlanEvent?.type === 'plan_ready' ? latestPlanEvent.data.plan : null;

  // Get queries from plan
  const queries = latestPlan?.queries || [];

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

  const selectAll = useCallback(() => {
    setSelectedQueries(new Set(queries.map((_, i) => i)));
  }, [queries]);

  const clearAll = useCallback(() => {
    setSelectedQueries(new Set());
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

  // Calculate progress
  const progress = Math.round((session.current_iteration / session.max_iterations) * 100);
  const isWaiting = session.status === 'waiting_user';
  const isCompleted = session.status === 'completed';
  const isPlanning = session.status === 'planning';

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

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <IconButton variant="text" color="gray" onClick={onClose}>
              <ArrowBackIcon />
            </IconButton>
            <div>
              <Typography variant="h6" className="text-gray-900">
                深度研究：{session.topic}
              </Typography>
              <Typography variant="small" className="text-gray-500">
                第 {session.current_iteration}/{session.max_iterations} 轮
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <Button
                size="sm"
                variant="outlined"
                color="gray"
                className="flex items-center gap-1"
                disabled={isProcessing}
              >
                <PauseIcon style={{ fontSize: 16 }} />
                暂停
              </Button>
            )}
            <IconButton variant="text" color="gray" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Progress Bar */}
          <Card className="border border-gray-200">
            <CardBody className="py-4">
              <Typography variant="small" className="text-gray-600 mb-2">
                研究进度
              </Typography>
              <Progress value={progress} color="blue" className="h-2" />
              <div className="flex justify-between mt-2">
                {Array.from({ length: session.max_iterations }).map((_, i) => (
                  <div
                    key={i}
                    className={`text-xs ${i < session.current_iteration ? 'text-blue-600' : 'text-gray-400'}`}
                  >
                    第 {i + 1} 轮
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Planning State - Show Start Button */}
          {isPlanning && (
            <Card className="border border-blue-200 bg-blue-50">
              <CardBody>
                <Typography variant="h6" className="text-blue-800 mb-2">
                  准备开始研究
                </Typography>
                <Typography variant="small" className="text-blue-700 mb-4">
                  点击下方按钮开始深度研究，系统将自动规划搜索策略并执行多轮搜索。
                </Typography>
                <Button color="blue" onClick={handleStart} disabled={isProcessing}>
                  {isProcessing ? <Spinner className="h-4 w-4" /> : <PlayIcon style={{ fontSize: 18 }} />}
                  <span className="ml-2">开始研究</span>
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Current Action: Waiting for Approval */}
          {isWaiting && latestPlan && (
            <Card className="border border-amber-200 bg-amber-50/50">
              <CardBody>
                <Typography variant="h6" className="text-amber-800 mb-3">
                  等待确认搜索计划
                </Typography>

                {/* Agent Reasoning */}
                <Card className="border border-gray-200 mb-4">
                  <CardBody className="py-3">
                    <Typography variant="small" className="text-gray-600 mb-2">
                      Agent 推理
                    </Typography>
                    <Typography className="text-gray-800">{latestPlan.reasoning}</Typography>
                    <div className="flex items-center gap-2 mt-3">
                      <Tooltip content="这个推理很有帮助">
                        <IconButton size="sm" variant="text" color="green">
                          <ThumbUpIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="这个推理不太准确">
                        <IconButton size="sm" variant="text" color="red">
                          <ThumbDownIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content="重新生成推理">
                        <IconButton size="sm" variant="text" color="blue">
                          <RefreshIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </CardBody>
                </Card>

                {/* Search Queries */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Typography variant="small" className="text-gray-600">
                      建议的搜索查询
                    </Typography>
                    <div className="flex gap-2">
                      <Button size="sm" variant="text" onClick={selectAll}>
                        全选
                      </Button>
                      <Button size="sm" variant="text" onClick={clearAll}>
                        清空
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {queries.map((query, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedQueries.has(index)
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                        onClick={() => toggleQuery(index)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleQuery(index)}
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={selectedQueries.has(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedQueries.has(index)}
                            onChange={() => toggleQuery(index)}
                            crossOrigin={undefined}
                          />
                          <div className="flex-1">
                            <Typography className="font-medium text-gray-900">
                              {index + 1}. {query.query}
                            </Typography>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>来源: {query.engine}</span>
                              <span>·</span>
                              <span>优先级: {query.priority === 1 ? '高' : query.priority === 2 ? '中' : '低'}</span>
                            </div>
                            {query.reason && (
                              <Typography variant="small" className="text-gray-600 mt-1">
                                {query.reason}
                              </Typography>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button size="sm" variant="outlined" className="mt-3 flex items-center gap-1">
                    <AddIcon style={{ fontSize: 16 }} />
                    添加查询
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button
                    color="blue"
                    onClick={handleApprove}
                    disabled={isProcessing || selectedQueries.size === 0}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? <Spinner className="h-4 w-4" /> : <CheckIcon style={{ fontSize: 18 }} />}
                    开始搜索
                  </Button>
                  <Button
                    variant="outlined"
                    color="gray"
                    onClick={handleSkip}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <SkipIcon style={{ fontSize: 18 }} />
                    跳过本轮
                  </Button>
                  <Button
                    variant="outlined"
                    color="amber"
                    onClick={handleFinish}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <StopIcon style={{ fontSize: 18 }} />
                    结束并生成报告
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Completed Iterations */}
          {Object.keys(stepsByIteration).length > 0 && (
            <div>
              <Typography variant="small" className="text-gray-600 mb-2">
                已完成的轮次
              </Typography>
              <div className="space-y-2">
                {Object.entries(stepsByIteration).map(([iteration, steps]) => (
                  <Card key={iteration} className="border border-gray-200">
                    <CardBody className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Typography className="font-medium text-gray-900">
                            第 {iteration} 轮 · 已完成
                          </Typography>
                          <Typography variant="small" className="text-gray-500">
                            {steps.length} 个步骤
                          </Typography>
                        </div>
                        <Chip value="完成" color="green" size="sm" />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Final Report */}
          {isCompleted && session.final_report && (
            <Card className="border border-green-200 bg-green-50/50">
              <CardBody>
                <Typography variant="h6" className="text-green-800 mb-3">
                  研究报告
                </Typography>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-4 rounded-lg border">
                    {session.final_report}
                  </pre>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                  <Button color="blue">导出到来源</Button>
                  <Button variant="outlined" color="gray">
                    导出选项
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Footer - Quick Stats */}
        {!isPlanning && (
          <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              已收集:{' '}
              <span className="font-medium text-gray-900">
                {session.aggregated_results?.length || 0} 条结果
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outlined" color="gray">
                预览结果
              </Button>
              {isCompleted && (
                <Button size="sm" color="blue">
                  导出到来源
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ResearchDetailPanel);
