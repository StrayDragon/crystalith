import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import useSWR from 'swr';

import {
  createOutput,
  createSlidesDraft,
  deleteOutput as deleteOutputApi,
  getOutput,
  listOutputs,
} from '../api';
import type { OutputItem, OutputTypeId, SlideGenerationConfig } from '../types';
import type { WorkspaceAction, WorkspaceState } from '../state/workspaceReducer';
import { createId, formatTimestamp, normalizeOutput } from '../utils';

type OutputQueueStatus = 'queued' | 'running' | 'done' | 'error';

export interface OutputQueueJob {
  id: string;
  type: OutputTypeId;
  prompt: string;
  chunkIds: number[];
  status: OutputQueueStatus;
  createdAt: string;
  createdAtLabel: string;
  notebookId: number | null;
  modelId?: string;
  draftId?: number | null;
  title?: string;
  generationConfig?: SlideGenerationConfig | null;
}

interface UseOutputQueueOptions {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  isConnected: boolean;
  hasPendingRefineJobs: () => boolean;
  onQueueReset: () => void;
  onQueueTotal: () => void;
  onQueueDone: () => void;
  markJobCompleted: (jobId: string) => void;
}

function normalizeSlideGenerationConfig(config?: SlideGenerationConfig | null) {
  if (!config) return undefined;
  return {
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
  const base = `/v1/notebooks/${notebookId}/slides/drafts/${slideId}/${stage}/stream`;
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

function runSlidesStream(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const eventSource = new EventSource(url);

    const cleanup = () => {
      eventSource.close();
    };

    const finalize = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    eventSource.addEventListener('done', () => {
      finalize(resolve);
    });

    eventSource.addEventListener('busy', (event) => {
      const data = parseSseMessage(event);
      const message =
        typeof data.message === 'string' ? data.message : '演示正在生成中，请稍后重试。';
      finalize(() => reject(new Error(message)));
    });

    eventSource.addEventListener('error', (event) => {
      const data = parseSseMessage(event);
      const message =
        typeof data.message === 'string' ? data.message : '生成失败，请稍后重试。';
      finalize(() => reject(new Error(message)));
    });

    eventSource.onerror = () => {
      finalize(() => reject(new Error('生成失败，请稍后重试。')));
    };
  });
}

export function useOutputQueue({
  state,
  dispatch,
  isConnected,
  hasPendingRefineJobs,
  onQueueReset,
  onQueueTotal,
  onQueueDone,
  markJobCompleted,
}: UseOutputQueueOptions) {
  const [outputQueueJobs, setOutputQueueJobs] = useState<OutputQueueJob[]>([]);
  const outputQueueRef = useRef<OutputQueueJob[]>(outputQueueJobs);
  const outputRunningRef = useRef(false);
  const runNextOutputJobRef = useRef<() => void>(() => {});

  const { data: outputsData, error: outputsError, isLoading: outputsLoading, mutate: mutateOutputs } =
    useSWR(
      state.activeNotebookId && isConnected
        ? ['workspace/outputs', state.activeNotebookId]
        : null,
      () => listOutputs(state.activeNotebookId ?? 0),
      { revalidateOnFocus: false },
    );

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'outputs', value: outputsLoading } });
  }, [dispatch, outputsLoading]);

  useEffect(() => {
    if (outputsError) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'outputs', value: '输出加载失败，请稍后重试。' },
      });
      return;
    }
    if (!outputsData) return;
    dispatch({ type: 'SET_OUTPUTS', payload: outputsData.map(normalizeOutput) });
    dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '' } });
  }, [dispatch, outputsData, outputsError]);

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
    setOutputQueueJobs([]);
    outputQueueRef.current = [];
    onQueueReset();
  }, [onQueueReset, state.activeNotebookId]);

  const enqueueOutputJob = useCallback(
    ({
      type,
      prompt,
      chunkIds,
      modelId,
    }: {
      type: OutputTypeId;
      prompt: string;
      chunkIds: number[];
      modelId?: string;
    }) => {
      const createdAt = new Date().toISOString();
      if (!hasPendingJobs()) {
        onQueueReset();
      }
      onQueueTotal();
      const job: OutputQueueJob = {
        id: createId(),
        type,
        prompt,
        chunkIds,
        status: 'queued',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        notebookId: state.activeNotebookId,
        modelId,
      };
      updateOutputQueueJobs((prev) => [job, ...prev]);
      return job;
    },
    [hasPendingJobs, onQueueReset, onQueueTotal, state.activeNotebookId, updateOutputQueueJobs],
  );

  const enqueueSlidesJob = useCallback(
    async ({
      title,
      prompt,
      chunkIds,
      generationConfig,
      modelId,
    }: {
      title: string;
      prompt: string;
      chunkIds: number[];
      generationConfig: SlideGenerationConfig;
      modelId?: string | null;
    }) => {
      if (!isConnected) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '未连接到后端服务。' } });
        return null;
      }
      if (!state.activeNotebookId) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
        return null;
      }

      const createdAt = new Date().toISOString();
      if (!hasPendingJobs()) {
        onQueueReset();
      }

      const payload = {
        title: title.trim() || undefined,
        prompt: prompt.trim() || undefined,
        chunk_ids: chunkIds.length ? chunkIds : undefined,
        generation_config: normalizeSlideGenerationConfig(generationConfig),
      };
      const created = await createSlidesDraft(state.activeNotebookId, payload);
      const draftId = created.id;

      onQueueTotal();
      const job: OutputQueueJob = {
        id: createId(),
        type: 'SLIDES',
        prompt,
        chunkIds,
        status: 'queued',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        notebookId: state.activeNotebookId,
        modelId: modelId ?? undefined,
        draftId,
        title,
        generationConfig,
      };
      updateOutputQueueJobs((prev) => [job, ...prev]);
      return job;
    },
    [
      dispatch,
      hasPendingJobs,
      isConnected,
      onQueueReset,
      onQueueTotal,
      state.activeNotebookId,
      updateOutputQueueJobs,
    ],
  );

  const processOutputJob = useCallback(
    async (job: OutputQueueJob) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'outputs', value: true } });
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '' } });
        let normalized: OutputItem[] = [];
        if (!isConnected) {
          throw new Error('backend unavailable');
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
            await runSlidesStream(outlineUrl);
            await runSlidesStream(markdownUrl);
            await mutateOutputs();
          } else {
            throw new Error('missing slide draft');
          }
        } else if (job.notebookId) {
          const response = await createOutput(job.notebookId, job.type, {
            prompt: job.prompt || undefined,
            chunk_ids: job.chunkIds.length ? job.chunkIds : undefined,
            model_id: job.modelId || undefined,
          });
          normalized = [normalizeOutput(response)];
          dispatch({ type: 'SET_OUTPUTS', payload: [...normalized, ...state.outputs] });
          await mutateOutputs();
        } else {
          throw new Error('missing notebook');
        }
        updateOutputQueueJobs((prev) =>
          prev.map((item) => (item.id === job.id ? { ...item, status: 'done' } : item)),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        const isCurrentNotebook =
          job.notebookId != null && job.notebookId === state.activeNotebookId;
        if ((normalized.length > 0 || job.type === 'SLIDES') && stillTracked && isCurrentNotebook) {
          markJobCompleted(job.id);
        }
        dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
        if (stillTracked) {
          onQueueDone();
        }
      } catch (error) {
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
          } else if (error.message && error.message.length < 100 && !error.message.includes('fetch')) {
            userFacingError = error.message;
          }
        }

        updateOutputQueueJobs((prev) =>
          prev.map((item) => (item.id === job.id ? { ...item, status: 'error' } : item)),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'outputs', value: userFacingError },
        });
        if (stillTracked) {
          onQueueDone();
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'outputs', value: false } });
        outputRunningRef.current = false;
        runNextOutputJobRef.current();
      }
    },
    [
      dispatch,
      isConnected,
      markJobCompleted,
      mutateOutputs,
      onQueueDone,
      state.activeNotebookId,
      state.outputs,
      updateOutputQueueJobs,
    ],
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

  const retryOutputs = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '' } });
    await mutateOutputs();
  }, [dispatch, mutateOutputs]);

  const deleteOutput = useCallback(
    async (outputId: number) => {
      if (!state.activeNotebookId) return;
      if (!isConnected) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'outputs', value: '未连接到后端服务，无法删除输出。' },
        });
        return;
      }

      dispatch({
        type: 'SET_OUTPUTS',
        payload: state.outputs.filter((item) => item.id !== outputId),
      });

      try {
        await deleteOutputApi(state.activeNotebookId, outputId);
      } catch (error) {
        console.error('Failed to delete output:', error);
        await mutateOutputs();
      }
    },
    [dispatch, isConnected, mutateOutputs, state.activeNotebookId, state.outputs],
  );

  const clearOutputs = useCallback(() => {
    dispatch({ type: 'SET_OUTPUTS', payload: [] });
  }, [dispatch]);

  const fetchOutput = useCallback(
    async (outputId: number) => {
      if (!state.activeNotebookId || !isConnected) return null;
      try {
        const output = await getOutput(state.activeNotebookId, outputId);
        const normalized = normalizeOutput(output);
        dispatch({
          type: 'SET_OUTPUTS',
          payload: state.outputs.map((item) =>
            item.id === outputId ? normalized : item,
          ),
        });
        return normalized;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'outputs', value: '获取输出详情失败。' },
        });
        return null;
      }
    },
    [dispatch, isConnected, state.activeNotebookId, state.outputs],
  );

  return {
    outputQueueJobs,
    enqueueOutputJob,
    enqueueSlidesJob,
    hasPendingJobs,
    outputsLoading: state.loading.outputs,
    outputsError: state.errors.outputs,
    retryOutputs,
    deleteOutput,
    clearOutputs,
    fetchOutput,
  };
}
