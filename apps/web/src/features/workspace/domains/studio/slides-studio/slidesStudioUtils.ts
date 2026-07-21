import { buildSlidevPreviewUrl } from '@crystalith-slidev';
import type { StudioSlide } from '@crystalith/shared';

import { t } from '../../../../../shared/i18n';
import type {
  PreviewDescriptor,
  SlideDraft,
  SlideOutlineItem,
  WorkspaceToolsDiagnostics,
} from '../../../shared/types';
import { normalizeGenerationConfig } from '../utils/slides';

export function resolveOptionId(
  value: string | null | undefined,
  options: Array<{ id: string; isDefault?: boolean }>,
): string {
  if (value && options.some((option) => option.id === value)) return value;
  const fallback = options.find((option) => option.isDefault)?.id ?? options[0]?.id ?? '';
  return fallback;
}

export function normalizeDraft(raw: StudioSlide): SlideDraft {
  const outline: SlideDraft['outline'] = raw.outline
    ? {
        title: raw.outline.title ?? '',
        slides: (raw.outline.slides ?? []).map((slide) => {
          const bullets: string[] = Array.isArray(slide.bullets) ? slide.bullets : [];
          return {
            title: slide.title ?? '',
            bullets,
          };
        }),
      }
    : null;
  return {
    id: Number(raw.id),
    notebookId: Number(raw.notebookId ?? 0),
    outputId: raw.outputId ?? null,
    title: raw.title ?? null,
    prompt: raw.prompt ?? null,
    engine: typeof raw.engine === 'string' ? raw.engine : '',
    chunkIds: raw.chunkIds ?? null,
    sourceIds: raw.sourceIds ?? null,
    outline,
    markdown: raw.markdown ?? null,
    generationConfig: normalizeGenerationConfig(raw.generationConfig),
    stage: raw.stage ?? 'input',
    status: raw.status ?? 'idle',
    errorMessage: raw.errorMessage ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

export function outlineTitleFromDraft(draft: SlideDraft | null) {
  return draft?.outline?.title || draft?.title || '演示';
}

export function outlineItemsFromDraft(draft: SlideDraft | null): SlideOutlineItem[] {
  return draft?.outline?.slides?.length ? draft.outline.slides : [];
}

export function resolveErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof record.status === 'number') return record.status;
  if (typeof record.response?.status === 'number') return record.response.status;
  return undefined;
}

export function appendRefreshToken(url: string, refreshKey: number): string {
  try {
    const resolved = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );
    resolved.searchParams.set('__refresh', String(refreshKey));
    return resolved.toString();
  } catch {
    return url;
  }
}

export function buildSlidesPreviewUrl(
  preview: PreviewDescriptor | null | undefined,
  refreshKey: number,
): string {
  if (!preview || preview.kind !== 'external_url') return '';
  if (preview.url) {
    return appendRefreshToken(preview.url, refreshKey);
  }
  if (preview.service === 'slidev') {
    return buildSlidevPreviewUrl(refreshKey);
  }
  return '';
}

/**
 * Slidev full-restarts when preview markdown/frontmatter changes; the Vite
 * `/slidev` proxy returns 500 until listen() returns. Poll before mounting
 * the iframe so the dialog does not flash the browser "refused / 500" page.
 */
export async function waitForSlidevPreviewReady(
  previewUrl: string,
  options?: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<boolean> {
  if (!previewUrl) return false;
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const intervalMs = options?.intervalMs ?? 250;
  const signal = options?.signal;
  const probe = previewUrl.includes('://')
    ? previewUrl
    : new URL(
        previewUrl,
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
      ).pathname;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    try {
      const res = await fetch(probe, {
        method: 'GET',
        cache: 'no-store',
        signal,
        headers: { Accept: 'text/html' },
      });
      if (res.ok) return true;
    } catch {
      // Connection refused / abort while Slidev restarts.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  return false;
}

export function resolvePreviewProviderLabel(
  preview: PreviewDescriptor | null | undefined,
  engine: string | null | undefined,
): string {
  if (preview?.service?.trim()) return preview.service.trim();
  if (engine?.trim()) return engine.trim();
  return 'slides';
}

export function resolveSlidesRecoveryHint(
  toolsDiagnostics: WorkspaceToolsDiagnostics | null | undefined,
): string {
  return (
    toolsDiagnostics?.slides?.hint ??
    toolsDiagnostics?.slides?.message ??
    toolsDiagnostics?.official?.['slides-slidev']?.hint ??
    ''
  );
}

export interface StatusMessage {
  tone: 'blue' | 'red' | 'gray';
  message: string;
}

export function resolveStatusMessage(params: {
  isGenerating: boolean;
  queueStatus: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
  draftStatus: string | undefined;
}): StatusMessage | null {
  const { isGenerating, queueStatus, draftStatus } = params;
  if (isGenerating) {
    return { tone: 'blue', message: '正在生成中，请稍候...' };
  }
  if (queueStatus === 'queued') {
    return { tone: 'gray', message: t('studio.slides.queue.pending') };
  }
  if (queueStatus === 'running') {
    return { tone: 'blue', message: '正在生成中，请稍候...' };
  }
  if (queueStatus === 'error') {
    return { tone: 'red', message: '生成失败，请稍后重试。' };
  }
  if (draftStatus === 'running') {
    return { tone: 'blue', message: '正在生成中，请稍候...' };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Progress/toolcall message shown in the studio events list during SSE generation. */
export function formatSlidesStageProgressMessage(event: { event: string; data: unknown }): string {
  const data = isRecord(event.data) ? event.data : {};
  return (
    (typeof data.message === 'string' && data.message) ||
    (typeof data.delta === 'string' && data.delta) ||
    (typeof data.tool === 'string' && `调用 ${data.tool}`) ||
    (event.event === 'toolcall' ? '工具调用' : '生成中...')
  );
}
