import type { SSEEvent } from './useResearch';

export type ThinkingTimelineItem = {
  type: string;
  message: string;
  timestamp: number;
  iteration?: number;
  queries?: string[];
};

export type ResearchStepResponse = {
  type: string;
  outputData?: Record<string, unknown> | null;
  iteration: number;
};

export function stepOutputData(
  step: ResearchStepResponse,
): Record<string, unknown> | null | undefined {
  return step.outputData ?? null;
}

export function buildThinkingTimeline(args: {
  sseEvents: SSEEvent[];
  steps: ResearchStepResponse[];
  topic: string;
  maxIterations: number;
  status: string;
}): ThinkingTimelineItem[] {
  const { sseEvents, steps, topic, maxIterations, status } = args;
  const timeline: ThinkingTimelineItem[] = [];

  // For completed sessions, always reconstruct from steps for full history
  // For active sessions, use SSE events for real-time updates
  const isCompletedSession = status === 'completed';
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
      message: `🚀 开始深度研究「${topic}」`,
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
          const coverage = output.coverageEstimate as number | undefined;
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

          if (needMore && iteration < maxIterations) {
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
      if (iteration < maxIterations || status === 'completed') {
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
}
