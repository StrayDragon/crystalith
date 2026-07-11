import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { useWorkspaceStore } from '../state/workspaceStore';
import type {
  GenerationPreference,
  OutputItem,
  OutputTypeId,
  SlideGenerationConfig,
} from '../types';
import { createId, formatTimestamp, normalizeOutput } from '../utils';
import { readInitialGenerationPreferenceForApi } from './useGenerationPreference';

type OutputQueueStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';
type SlidesStreamStage = 'outline' | 'markdown';

type SlidesDraftSnapshot = {
  stage?: string | null;
  status?: string | null;
  output_id?: number | null;
  error_message?: string | null;
  markdown?: string | null;
};

const SLIDES_STREAM_POLL_INTERVAL_MS = 1000;
const SLIDES_STREAM_TIMEOUT_MS = 180000;

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
    theme_preset: config.themePreset ?? undefined,
    frontmatter: config.frontmatter ?? undefined,
  };
}

function buildSlidesStreamUrl(
  notebookId: number,
  slideId: number,
  stage: 'outline' | 'markdown',
  modelId?: string,
) {
  const base = `/v2/studio/slides/${slideId}/${stage}`;
  return modelId ? `${base}?model_id=${encodeURIComponent(modelId)}` : base;
}

function parseSseMessage(event: Event) {
  const raw = (event as MessageEvent).data;
  if (!raw || typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {};
  }
}

function hasSlidesStageCompleted(stage: SlidesStreamStage, draft: SlidesDraftSnapshot): boolean {
  if (draft.status !== 'idle') return false;
  if (stage === 'outline') {
    return draft.stage === 'outline' || draft.stage === 'markdown';
  }
  return draft.stage === 'markdown' && (draft.output_id != null || Boolean(draft.markdown?.trim()));
}

function runSlidesStream(
  url: string,
  stage: SlidesStreamStage,
  options?: {
    signal?: AbortSignal;
    pollDraft?: () => Promise<SlidesDraftSnapshot>;
  },
): Promise<void> {
  const signal = options?.signal;
  const pollDraft = options?.pollDraft;

  return new Promise((resolve, reject) => {
    let settled = false;
    let polling = false;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const eventSource = new EventSource(url);

    const cleanup = () => {
      eventSource.close();
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
      }
      if (timeoutTimer != null) {
        window.clearTimeout(timeoutTimer);
      }
    };

    const finalize = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const rejectWithMessage = (message: string) => {
      finalize(() => reject(new Error(message)));
    };

    const pollDraftState = async () => {
      if (!pollDraft || polling || settled) return;
      polling = true;
      try {
        const draft = await pollDraft();
        if (settled) return;
        if (draft.status === 'error') {
          rejectWithMessage(draft.error_message?.trim() || '生成失败，请稍后重试。');
          return;
        }
        if (hasSlidesStageCompleted(stage, draft)) {
          finalize(resolve);
        }
      } catch {
      } finally {
        polling = false;
      }
    };

    const handleAbort = () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      finalize(() => reject(abortError));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener('abort', handleAbort);

    eventSource.addEventListener('done', () => {
      finalize(resolve);
    });

    eventSource.addEventListener('busy', (event) => {
      const data = parseSseMessage(event);
      const message =
        typeof data.message === 'string' ? data.message : '演示正在生成中，请稍后重试。';
      rejectWithMessage(message);
    });

    eventSource.addEventListener('error', (event) => {
      const data = parseSseMessage(event);
      const message = typeof data.message === 'string' ? data.message : '生成失败，请稍后重试。';
      rejectWithMessage(message);
    });

    eventSource.onerror = () => {
      if (!pollDraft) {
        rejectWithMessage('生成失败，请稍后重试。');
        return;
      }
      void pollDraftState();
    };

    if (pollDraft) {
      pollTimer = window.setInterval(() => {
        void pollDraftState();
      }, SLIDES_STREAM_POLL_INTERVAL_MS);
      timeoutTimer = window.setTimeout(() => {
        rejectWithMessage('生成超时，请稍后重试。');
      }, SLIDES_STREAM_TIMEOUT_MS);
      void pollDraftState();
    }
  });
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
      const { data, error: fetchErr } = await api.v2.outputs.get({
        query: { notebook_id: String(activeNotebookId ?? 0) },
      });
      if (fetchErr) throw fetchErr;
      return data ?? [];
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
    s.setOutputs(outputsData.map((o: any) => normalizeOutput(o)));
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
        source_ids: sourceIds.length ? sourceIds : undefined,
        generation_config: normalizeSlideGenerationConfig(generationConfig),
      };
      const { data: created, error: createErr } = await api.v2.studio.slides.post(payload);
      if (createErr) throw createErr;
      const draftId = created!.id;

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
            const outlineUrl = buildSlidesStreamUrl(
              job.notebookId,
              job.draftId,
              'outline',
              job.modelId,
            );
            const markdownUrl = buildSlidesStreamUrl(
              job.notebookId,
              job.draftId,
              'markdown',
              job.modelId,
            );
            const pollDraft = async () => {
              const { data: draftData, error: draftErr } = await api.v2.studio
                .slides({ id: job.draftId! })
                .get();
              if (draftErr) throw draftErr;
              return draftData as SlidesDraftSnapshot;
            };
            await runSlidesStream(outlineUrl, 'outline', {
              signal: abortController.signal,
              pollDraft,
            });
            await runSlidesStream(markdownUrl, 'markdown', {
              signal: abortController.signal,
              pollDraft,
            });
            if (!isCancelled()) {
              await mutateOutputs();
            }
          } else {
            throw new Error('missing slide draft');
          }
        } else if (job.notebookId) {
          const preference = job.preference;
          const body: Record<string, unknown> = {
            notebook_id: job.notebookId,
            type: job.type,
            prompt: job.prompt || undefined,
            source_ids: job.sourceIds.length ? job.sourceIds : undefined,
            model_id: job.modelId || undefined,
          };
          if (preference) Object.assign(body, { preference });
          const { data: response, error: createErr } = await api.v2.outputs.post(body);
          if (createErr) throw createErr;
          if (isCancelled()) {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            throw abortError;
          }
          normalized = [normalizeOutput(response as any)];
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
        const cancelled = isCancelled() || (error instanceof Error && error.name === 'AbortError');
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

          if (statusError.status === 503) {
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
        const { error: deleteErr } = await api.v2.outputs({ id: outputId }).delete();
        if (deleteErr) throw deleteErr;
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
      try {
        const { data: output, error: getErr } = await api.v2.outputs({ id: outputId }).get();
        if (getErr) throw getErr;
        const normalized = normalizeOutput(output as any);
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
  };
}
