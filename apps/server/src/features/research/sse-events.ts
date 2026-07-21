// Research SSE event derivation — extracted from router.ts (Wave F follow-up).
//
// Named `event:` lines + JSON `type` payloads for GET /v2/research/:id/stream.
import type { researchSteps } from '../../db/schema.ts';

export function deriveNamedEvent(step: typeof researchSteps.$inferSelect): {
  event: string;
  data: Record<string, unknown>;
} {
  // Keep `type` in the data payload for backward compatibility with
  // frontend parsers that read type from the JSON body (not event: line).
  const base = { iteration: step.iteration, data: step.outputData };
  switch (step.type) {
    case 'plan':
      return { event: 'plan_ready', data: { ...base, type: 'plan_ready' } };
    case 'user_input':
      return { event: 'waiting', data: { ...base, type: 'approval_request' } };
    case 'search':
      return { event: 'search_progress', data: { ...base, type: 'search_progress' } };
    case 'search_result':
      // P0-2: per-result event (v1 on_search_result, graph.py:497-498).
      // outputData carries {title,url,snippet,source,iteration,relevanceScore}
      // matching shared ResearchSearchResultSchema.
      return {
        event: 'search_result',
        data: { ...base, type: 'search_result', result: step.outputData },
      };
    case 'analyze':
      return { event: 'analysis', data: { ...base, type: 'analysis' } };
    case 'summary':
      return { event: 'report', data: { ...base, type: 'report' } };
    default:
      // c49: rich thinking — carry the step's output as a message so frontends
      // can show reasoning/insight text instead of an empty thinking event
      // (v1 api.py:1102-1186 emits per-step thinking with message text).
      return {
        event: 'thinking',
        data: {
          iteration: step.iteration,
          type: 'thinking',
          stepType: step.type,
          message: thinkingMessageForStep(step),
          data: step.outputData,
        },
      };
  }
}

/**
 * c49: derive a human-readable thinking message from a step (v1 api.py:1102-1186
 * emits rich thinking per step). Pulls summary/reasoning/insight/decision from
 * outputData when present, falls back to a type-based label.
 */
export function thinkingMessageForStep(
  step: Pick<typeof researchSteps.$inferSelect, 'type' | 'outputData'>,
): string {
  const out = step.outputData;
  if (out) {
    for (const key of ['summary', 'reasoning', 'insight', 'decision', 'message'] as const) {
      const v = out[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return step.type || '思考中';
}

/**
 * c49: localized status messages (v1 api.py:1044-1050 status_messages map).
 * Surface a human-readable description of each status transition.
 */
export function statusMessage(status: string): string {
  switch (status) {
    case 'planning':
      return '正在规划搜索策略';
    case 'waiting_user':
      return '等待用户审批搜索计划';
    case 'searching':
      return '正在执行搜索';
    case 'analyzing':
      return '正在分析结果并生成报告';
    case 'completed':
      return '研究完成';
    case 'cancelled':
      return '研究已取消';
    default:
      return status;
  }
}

/** @deprecated Prefer importing `thinkingMessageForStep` directly. */
export function __testThinkingMessageForStep(
  step: Pick<typeof researchSteps.$inferSelect, 'type' | 'outputData'>,
): string {
  return thinkingMessageForStep(step);
}

/** @deprecated Prefer importing `statusMessage` directly. */
export function __testStatusMessage(status: string): string {
  return statusMessage(status);
}
