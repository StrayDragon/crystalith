/**
 * Drive studio slide outline/markdown generation via GET SSE (c70).
 * Server runs generation inside the stream and emits progress/toolcall/done/error.
 */
import { streamRequest, type SseEvent } from '../../../../../api/stream';

export type SlidesGenerateStage = 'outline' | 'markdown';

export function slidesStageStreamPath(
  notebookId: number,
  slideId: number,
  stage: SlidesGenerateStage,
): string {
  return stage === 'outline'
    ? `/v2/notebooks/${notebookId}/studio/slides/${slideId}/outline/stream`
    : `/v2/notebooks/${notebookId}/studio/slides/${slideId}/markdown/stream`;
}

function eventMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  if (typeof record.delta === 'string' && record.delta.trim()) return record.delta.trim();
  if (typeof record.tool === 'string' && record.tool.trim()) return `调用 ${record.tool}`;
  return '';
}

/**
 * Subscribe to GET .../outline|markdown/stream until done/error/busy.
 * Throws on error/busy; resolves on done (or clean end without error).
 */
export async function consumeSlidesStageStream(
  notebookId: number,
  slideId: number,
  stage: SlidesGenerateStage,
  options?: {
    signal?: AbortSignal;
    onEvent?: (event: SseEvent) => void;
  },
): Promise<void> {
  const path = slidesStageStreamPath(notebookId, slideId, stage);
  let sawDone = false;
  let lastError: string | null = null;

  for await (const event of streamRequest(path, { signal: options?.signal })) {
    options?.onEvent?.(event);

    if (event.event === 'busy') {
      const msg = eventMessage(event.data) || '演示正在生成中，请稍后重试。';
      throw new Error(msg);
    }
    if (event.event === 'error') {
      lastError = eventMessage(event.data) || '生成失败，请稍后重试。';
      throw new Error(lastError);
    }
    if (event.event === 'done') {
      sawDone = true;
      break;
    }
  }

  if (!sawDone && lastError) {
    throw new Error(lastError);
  }
  if (!sawDone) {
    // Stream ended without done — caller may still refresh draft to verify.
  }
}
