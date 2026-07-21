import type { Output as WireOutput } from '@crystalith/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { edenFetchOptions } from '../../../../api/edenFetchOptions';
import { parseServerError } from '../../../../api/parseServerError';
import { consumeSlidesStageStream } from '../../domains/studio/slides-studio/consumeSlidesStageStream';
import { useWorkspaceStore } from '../state/workspaceStore';
import type {
  GenerationPreference,
  OutputItem,
  OutputTypeId,
  SlideGenerationConfig,
} from '../types';
import { createId, formatTimestamp, mergeOutputListWithCache, normalizeOutput } from '../utils';
import { readInitialGenerationPreferenceForApi } from './useGenerationPreference';

function isWireOutput(value: unknown): value is WireOutput {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'number' &&
    typeof (value as { notebookId?: unknown }).notebookId === 'number' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}
type OutputQueueStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';
type SlidesStreamStage = 'outline' | 'markdown';

type SlidesDraftSnapshot = {
  stage?: string | null;
  status?: string | null;
  outputId?: number | null;
  errorMessage?: string | null;
  markdown?: string | null;
  outline?: { slides?: unknown[] } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSlidesDraftSnapshot(value: unknown): SlidesDraftSnapshot | null {
  if (!isRecord(value)) return null;
  const outlineRaw = value.outline;
  const outline = isRecord(outlineRaw)
    ? { slides: Array.isArray(outlineRaw.slides) ? outlineRaw.slides : undefined }
    : null;
  return {
    stage: typeof value.stage === 'string' ? value.stage : value.stage === null ? null : undefined,
    status:
      typeof value.status === 'string' ? value.status : value.status === null ? null : undefined,
    outputId:
      typeof value.outputId === 'number'
        ? value.outputId
        : value.outputId === null
          ? null
          : undefined,
    errorMessage:
      typeof value.errorMessage === 'string'
        ? value.errorMessage
        : value.errorMessage === null
          ? null
          : undefined,
    markdown:
      typeof value.markdown === 'string'
        ? value.markdown
        : value.markdown === null
          ? null
          : undefined,
    outline,
  };
}

const SLIDES_GENERATE_TIMEOUT_MS = 600_000;
// 10 min per stage — LLM outline often exceeds the old 3 min cap.

export interface OutputQueueJob {
  id: string;
  type: OutputTypeId;
  prompt: string;
  sourceIds: number[];
  status: OutputQueueStatus;
  createdAt: string;
  createdAtLabel: string;
  notebookId: number | null;
  modelId?: string;
  preference?: GenerationPreference;
  draftId?: number | null;
  title?: string;
  generationConfig?: SlideGenerationConfig | null;
}

interface UseOutputQueueOptions {
  isConnected: boolean;
  hasPendingRefineJobs: () => boolean;
  onQueueReset: () => void;
  onQueueTotal: () => void;
  onQueueDone: () => void;
  markJobCompleted: (jobId: string) => void;
}

function normalizeSlideGenerationConfig(config?: SlideGenerationConfig | null) {
  if (!config) return undefined;
  const preference = config.preference ?? undefined;
  return {
    ...(preference ? { preference } : {}),
    quantity: config.quantity ?? undefined,
    audience: config.audience ?? undefined,
    structure: config.structure ?? undefined,
    tone: config.tone ?? undefined,
    language: config.language ?? undefined,
    density: config.density ?? undefined,
    themePreset: config.themePreset ?? undefined,
    frontmatter: config.frontmatter ?? undefined,
  };
}

function hasSlidesStageCompleted(stage: SlidesStreamStage, draft: SlidesDraftSnapshot): boolean {
  if (draft.status !== 'idle') return false;
  if (stage === 'outline') {
    return draft.stage === 'outline' || draft.stage === 'markdown';
  }
  return draft.stage === 'markdown' && (draft.outputId != null || Boolean(draft.markdown?.trim()));
}

/** Generate outline/markdown via GET SSE streams (c70). */
async function runSlidesGenerate(
  slideId: number,
  stage: SlidesStreamStage,
  notebookId: number,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const signal = options?.signal;
  if (signal?.aborted) {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  const timeout = AbortSignal.timeout(SLIDES_GENERATE_TIMEOUT_MS);
  const combined = signal != null ? AbortSignal.any([signal, timeout]) : timeout;

  await consumeSlidesStageStream(notebookId, slideId, stage, { signal: combined });

  // Confirm stage settled after SSE done.
  const { data: draft, error: draftErr } = await api.v2
    .notebooks({ nid: notebookId })
    .studio.slides({ id: slideId })
    .get();
  if (draftErr)
    throw new Error(
      typeof draftErr === 'string' ? draftErr : typeof draftErr === 'string' ? draftErr : '',
    );
  const snapshot = toSlidesDraftSnapshot(draft);
  if (!snapshot) {
    throw new Error('生成未完成，请稍后重试。');
  }
  if (snapshot.status === 'error') {
    throw new Error(snapshot.errorMessage?.trim() || '生成失败，请稍后重试。');
  }
  if (!hasSlidesStageCompleted(stage, snapshot)) {
    throw new Error('生成未完成，请稍后重试。');
  }
}

export function useOutputQueue({
  isConnected,
  hasPendingRefineJobs,
  onQueueReset,
  onQueueTotal,
  onQueueDone,
  markJobCompleted,
}: UseOutputQueueOptions) {
  const store = useWorkspaceStore;
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const loadingOutputs = useWorkspaceStore((s) => s.loading.outputs);
  const errOutputs = useWorkspaceStore((s) => s.errors.outputs);

  const [outputQueueJobs, setOutputQueueJobs] = useState<OutputQueueJob[]>([]);
  const outputQueueRef = useRef<OutputQueueJob[]>(outputQueueJobs);
  const outputRunningRef = useRef(false);
  const runNextOutputJobRef = useRef<() => void>(() => {});
  const outputAbortControllersRef = useRef(new Map<string, AbortController>());

  const {
    data: outputsData,
    error: outputsError,
    isLoading: outputsLoading,
    mutate: mutateOutputs,
  } = useSWR(
    activeNotebookId && isConnected ? ['workspace/outputs', activeNotebookId] : null,
    async () => {
      const { data, error: fetchErr } = await api.v2
        .notebooks({ nid: activeNotebookId! })
        .outputs.get({
          query: { offset: 0, limit: 200 },
        });
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      return data?.items ?? [];
    },
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    store.getState().setLoading('outputs', outputsLoading);
  }, [outputsLoading, store]);

  useEffect(() => {
    if (outputsError) {
      store.getState().setError('outputs', '输出加载失败，请稍后重试。');
      return;
    }
    if (!outputsData) return;
    const s = store.getState();
    s.setOutputs(mergeOutputListWithCache(outputsData, s.outputs));
    s.setError('outputs', '');
  }, [outputsData, outputsError, store]);

  const updateOutputQueueJobs = useCallback(
    (updater: (jobs: OutputQueueJob[]) => OutputQueueJob[]) => {
      const next = updater(outputQueueRef.current);
      outputQueueRef.current = next;
      setOutputQueueJobs(next);
    },
    [],
  );

  const hasPendingJobs = useCallback(() => {
    const outputPending = outputQueueRef.current.some(
      (job) => job.status === 'queued' || job.status === 'running',
    );
    return hasPendingRefineJobs() || outputPending;
  }, [hasPendingRefineJobs]);

  useEffect(() => {
    outputQueueRef.current = outputQueueJobs;
    if (outputRunningRef.current) return;
    if (!outputQueueJobs.some((job) => job.status === 'queued')) return;
    runNextOutputJobRef.current();
  }, [outputQueueJobs]);

  useEffect(() => {
    outputAbortControllersRef.current.forEach((controller) => controller.abort());
    outputAbortControllersRef.current.clear();
    setOutputQueueJobs([]);
    outputQueueRef.current = [];
    outputRunningRef.current = false;
    onQueueReset();
  }, [onQueueReset, activeNotebookId]);

  const enqueueOutputJob = useCallback(
    ({
      type,
      prompt,
      sourceIds,
      modelId,
    }: {
      type: OutputTypeId;
      prompt: string;
      sourceIds: number[];
      modelId?: string;
    }) => {
      if (sourceIds.length === 0) {
        store.getState().setError('outputs', '请先选择来源。');
        return null;
      }
      const createdAt = new Date().toISOString();
      if (!hasPendingJobs()) {
        onQueueReset();
      }
      onQueueTotal();
      const preference = readInitialGenerationPreferenceForApi();
      const job: OutputQueueJob = {
        id: createId(),
        type,
        prompt,
        sourceIds,
        status: 'queued',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        notebookId: activeNotebookId,
        modelId,
        preference,
      };
      updateOutputQueueJobs((prev) => [job, ...prev]);
      return job;
    },
    [hasPendingJobs, onQueueReset, onQueueTotal, activeNotebookId, store, updateOutputQueueJobs],
  );

  const enqueueSlidesJob = useCallback(
    async ({
      title,
      prompt,
      sourceIds,
      generationConfig,
      modelId,
    }: {
      title: string;
      prompt: string;
      sourceIds: number[];
      generationConfig: SlideGenerationConfig;
      modelId?: string | null;
    }) => {
      if (!isConnected) {
        store.getState().setError('outputs', '未连接到后端服务。');
        return null;
      }
      if (!activeNotebookId) {
        store.getState().setError('outputs', '请先创建笔记本。');
        return null;
      }
      if (sourceIds.length === 0) {
        store.getState().setError('outputs', '请先选择来源。');
        return null;
      }

      const createdAt = new Date().toISOString();
      if (!hasPendingJobs()) {
        onQueueReset();
      }

      const payload = {
        title: title.trim() || undefined,
        prompt: prompt.trim() || undefined,
        sourceIds,
        generationConfig: normalizeSlideGenerationConfig(generationConfig),
      };
      const { data: created, error: createErr } = await api.v2
        .notebooks({ nid: activeNotebookId })
        .studio.slides.post(payload);
      if (createErr)
        throw new Error(
          typeof createErr === 'string'
            ? createErr
            : typeof createErr === 'string'
              ? createErr
              : '',
        );
      const draftId = created.id;

      onQueueTotal();
      const job: OutputQueueJob = {
        id: createId(),
        type: 'SLIDES',
        prompt,
        sourceIds,
        status: 'queued',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        notebookId: activeNotebookId,
        modelId: modelId ?? undefined,
        draftId,
        title,
        generationConfig,
      };
      updateOutputQueueJobs((prev) => [job, ...prev]);
      return job;
    },
    [
      hasPendingJobs,
      isConnected,
      onQueueReset,
      onQueueTotal,
      activeNotebookId,
      store,
      updateOutputQueueJobs,
    ],
  );

  const processOutputJob = useCallback(
    async (job: OutputQueueJob) => {
      const abortController = new AbortController();
      outputAbortControllersRef.current.set(job.id, abortController);

      const isCancelled = () => {
        const current = outputQueueRef.current.find((item) => item.id === job.id);
        return abortController.signal.aborted || current?.status === 'cancelled';
      };

      try {
        store.getState().setLoading('outputs', true);
        store.getState().setError('outputs', '');
        let normalized: OutputItem[] = [];

        if (!isConnected) {
          throw new Error('backend unavailable');
        }
        if (job.sourceIds.length === 0) {
          throw new Error('请先选择来源。');
        }
        if (isCancelled()) {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          throw abortError;
        }

        if (job.type === 'SLIDES') {
          if (job.notebookId && job.draftId) {
            try {
              await runSlidesGenerate(job.draftId, 'outline', job.notebookId, {
                signal: abortController.signal,
              });
            } catch (error) {
              // User cancel → rethrow as abort. Otherwise, if the server already
              // finished outline after a client timeout/disconnect, continue.
              if (isCancelled()) throw error;
              const { data: draftAfterOutline } = await api.v2
                .notebooks({ nid: job.notebookId })
                .studio.slides({ id: job.draftId })
                .get();
              const snap = toSlidesDraftSnapshot(draftAfterOutline);
              const outlineReady =
                snap != null &&
                (snap.stage === 'outline' ||
                  snap.stage === 'markdown' ||
                  (Array.isArray(snap.outline?.slides) && snap.outline.slides.length > 0));
              if (!outlineReady) throw error;
            }
            if (isCancelled()) {
              const abortError = new Error('aborted');
              abortError.name = 'AbortError';
              throw abortError;
            }
            await runSlidesGenerate(job.draftId, 'markdown', job.notebookId, {
              signal: abortController.signal,
            });
            if (!isCancelled()) {
              await mutateOutputs();
            }
          } else {
            throw new Error('missing slide draft');
          }
        } else if (job.notebookId) {
          const preference = job.preference;
          const body = {
            type: job.type,
            prompt: job.prompt || undefined,
            sourceIds: job.sourceIds.length ? job.sourceIds : undefined,
            modelId: job.modelId || undefined,
            ...(preference ? { preference } : {}),
          };
          const nbOutputs = api.v2.notebooks({ nid: job.notebookId }).outputs;
          const { data: response, error: createErr } = await nbOutputs.post(
            body,
            edenFetchOptions(abortController.signal),
          );
          if (createErr) throw new Error(parseServerError(createErr).message);
          // Server may have already persisted the row before the client abort
          // landed — delete it so a page refresh does not resurrect the job.
          if (isCancelled()) {
            const createdId = isWireOutput(response) ? response.id : undefined;
            if (typeof createdId === 'number') {
              try {
                await nbOutputs({ id: createdId }).delete();
              } catch {
                // Best-effort cleanup; UI already shows cancelled.
              }
            }
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            throw abortError;
          }
          if (!isWireOutput(response)) {
            throw new Error('output create returned unexpected payload');
          }
          normalized = [normalizeOutput(response)];
          const s = store.getState();
          s.setOutputs([...normalized, ...s.outputs]);
          await mutateOutputs();
        } else {
          throw new Error('missing notebook');
        }

        if (isCancelled()) {
          updateOutputQueueJobs((prev) =>
            prev.map((item) => (item.id === job.id ? { ...item, status: 'cancelled' } : item)),
          );
          const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
          if (stillTracked) {
            onQueueDone();
          }
          return;
        }

        updateOutputQueueJobs((prev) =>
          prev.map((item) => (item.id === job.id ? { ...item, status: 'done' } : item)),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        const isCurrentNotebook =
          job.notebookId != null && job.notebookId === store.getState().activeNotebookId;
        if ((normalized.length > 0 || job.type === 'SLIDES') && stillTracked && isCurrentNotebook) {
          markJobCompleted(job.id);
        }
        store.getState().setActivePanel('refine');
        if (stillTracked) {
          onQueueDone();
        }
      } catch (error) {
        // Only user cancel (explicit abort / cancelled status) → cancelled.
        // AbortSignal.timeout() also surfaces as AbortError — treat as error, not cancel.
        const cancelled = isCancelled();
        if (cancelled) {
          updateOutputQueueJobs((prev) =>
            prev.map((item) => (item.id === job.id ? { ...item, status: 'cancelled' } : item)),
          );
          const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
          if (stillTracked) {
            onQueueDone();
          }
          return;
        }

        let userFacingError = '输出生成失败，请稍后重试。';

        if (error instanceof Error) {
          const statusError = error as Error & { status?: number };

          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            userFacingError = '幻灯片生成超时或连接中断，请重试。';
          } else if (statusError.status === 503) {
            userFacingError = 'AI 服务配置错误，请联系管理员。';
          } else if (statusError.status === 404) {
            userFacingError = '笔记本已失效，请刷新页面。';
          } else if (statusError.status === 400) {
            userFacingError = '请求参数有误，请检查输入。';
          } else if (statusError.status === 500) {
            userFacingError = '服务器错误，请稍后重试。';
          } else if (
            error.message &&
            error.message.length < 100 &&
            !error.message.includes('fetch')
          ) {
            userFacingError = error.message;
          }
        }

        updateOutputQueueJobs((prev) =>
          prev.map((item) => (item.id === job.id ? { ...item, status: 'error' } : item)),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        store.getState().setError('outputs', userFacingError);
        if (stillTracked) {
          onQueueDone();
        }
      } finally {
        outputAbortControllersRef.current.delete(job.id);
        store.getState().setLoading('outputs', false);
        outputRunningRef.current = false;
        runNextOutputJobRef.current();
      }
    },
    [isConnected, markJobCompleted, mutateOutputs, onQueueDone, store, updateOutputQueueJobs],
  );

  const runNextOutputJob = useCallback(() => {
    if (outputRunningRef.current) return;
    const nextJob = outputQueueRef.current.find((job) => job.status === 'queued');
    if (!nextJob) return;
    outputRunningRef.current = true;
    updateOutputQueueJobs((prev) =>
      prev.map((job) => (job.id === nextJob.id ? { ...job, status: 'running' } : job)),
    );
    void processOutputJob(nextJob);
  }, [processOutputJob, updateOutputQueueJobs]);

  runNextOutputJobRef.current = runNextOutputJob;

  const cancelOutputJob = useCallback(
    (jobId: string) => {
      const target = outputQueueRef.current.find((item) => item.id === jobId);
      if (!target) return;
      if (target.status === 'done' || target.status === 'error' || target.status === 'cancelled') {
        return;
      }

      if (target.status === 'queued') {
        updateOutputQueueJobs((prev) =>
          prev.map((item) => (item.id === jobId ? { ...item, status: 'cancelled' } : item)),
        );
        onQueueDone();
        return;
      }

      outputAbortControllersRef.current.get(jobId)?.abort();
      updateOutputQueueJobs((prev) =>
        prev.map((item) => (item.id === jobId ? { ...item, status: 'cancelled' } : item)),
      );
    },
    [onQueueDone, updateOutputQueueJobs],
  );

  const retryOutputs = useCallback(async () => {
    store.getState().setError('outputs', '');
    await mutateOutputs();
  }, [mutateOutputs, store]);

  const retryOutputJob = useCallback(
    (jobId: string) => {
      const target = outputQueueRef.current.find((item) => item.id === jobId);
      if (!target || target.status !== 'error') return;

      onQueueTotal();
      updateOutputQueueJobs((prev) =>
        prev.map((item) => (item.id === jobId ? { ...item, status: 'queued' } : item)),
      );
      store.getState().setError('outputs', '');
      runNextOutputJobRef.current();
    },
    [onQueueTotal, store, updateOutputQueueJobs],
  );

  const deleteOutput = useCallback(
    async (outputId: number) => {
      const s = store.getState();
      if (!s.activeNotebookId) return;
      if (!isConnected) {
        s.setError('outputs', '未连接到后端服务，无法删除输出。');
        return;
      }

      s.setOutputs(s.outputs.filter((item) => item.id !== outputId));

      try {
        const { error: deleteErr } = await api.v2
          .notebooks({ nid: s.activeNotebookId })
          .outputs({ id: outputId })
          .delete();
        if (deleteErr)
          throw new Error(
            typeof deleteErr === 'string'
              ? deleteErr
              : typeof deleteErr === 'string'
                ? deleteErr
                : '',
          );
      } catch (error) {
        console.error('Failed to delete output:', error);
        await mutateOutputs();
      }
    },
    [isConnected, mutateOutputs, store],
  );

  const clearOutputs = useCallback(() => {
    store.getState().setOutputs([]);
  }, [store]);

  const fetchOutput = useCallback(
    async (outputId: number) => {
      const s = store.getState();
      if (!s.activeNotebookId || !isConnected) return null;
      const cached = s.outputs.find((item) => item.id === outputId);
      if (cached?.contentLoaded && cached.content != null) {
        return cached;
      }
      try {
        const { data: output, error: getErr } = await api.v2
          .notebooks({ nid: s.activeNotebookId })
          .outputs({ id: outputId })
          .get();
        if (getErr)
          throw new Error(
            typeof getErr === 'string' ? getErr : typeof getErr === 'string' ? getErr : '',
          );
        const normalized = normalizeOutput(output);
        const s2 = store.getState();
        s2.setOutputs(s2.outputs.map((item) => (item.id === outputId ? normalized : item)));
        return normalized;
      } catch {
        store.getState().setError('outputs', '获取输出详情失败。');
        return null;
      }
    },
    [isConnected, store],
  );

  /** Ensure detail is loaded before viewer / slides open (c72). */
  const ensureOutputDetail = useCallback(
    async (outputId: number) => {
      return fetchOutput(outputId);
    },
    [fetchOutput],
  );

  return {
    outputQueueJobs,
    enqueueOutputJob,
    enqueueSlidesJob,
    hasPendingJobs,
    outputsLoading: loadingOutputs,
    outputsError: errOutputs,
    retryOutputs,
    retryOutputJob,
    cancelOutputJob,
    deleteOutput,
    clearOutputs,
    fetchOutput,
    ensureOutputDetail,
  };
}
