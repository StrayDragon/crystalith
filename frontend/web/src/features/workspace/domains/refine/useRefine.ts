import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { listWorkspaceTools, refineBatch } from '../../shared/api';
import { useWorkspaceDispatch, useWorkspaceState } from '../../app/WorkspaceContext';
import type {
  ApiWorkspaceTool,
  OutputItem,
  OutputTypeId,
  RefineJob,
  RefineMode,
  WorkspaceTool,
} from '../../shared/types';
import {
  buildJobTitle,
  createId,
  formatTimestamp,
  normalizeCitation,
  resolveTemplateLabel,
} from '../../shared/utils';
import { REFINE_FORMATS, REFINE_TEMPLATES } from './data/refineTemplates';
import { useOutputQueue } from '../../shared/hooks/useOutputQueue';

function normalizeTool(tool: ApiWorkspaceTool): WorkspaceTool {
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    tone: tool.tone,
    outputType: tool.output_type,
    prompt: tool.prompt,
    badge: tool.badge ?? undefined,
    enabled: tool.enabled !== false,
  };
}

export function useRefine() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isConnected = state.connectionState === 'live';
  const refineFormats = useMemo(() => REFINE_FORMATS, []);
  const refineTemplates = useMemo(() => REFINE_TEMPLATES, []);
  const compareTemplate = useMemo(
    () => refineTemplates.find((item) => item.id === 'compare-analysis') ?? null,
    [refineTemplates],
  );

  const { data: toolsData, error: toolsError, isLoading: toolsLoading } = useSWR(
    isConnected ? 'workspace/tools' : null,
    listWorkspaceTools,
    { revalidateOnFocus: false },
  );

  const tools = useMemo<WorkspaceTool[]>(() => {
    // Return backend data if available
    if (toolsData?.tools?.length) {
      return toolsData.tools.map(normalizeTool);
    }
    // Return empty array while loading or on error (UI should show appropriate state)
    return [];
  }, [toolsData]);

  const outputTypeOptions = useMemo(() => {
    const seen = new Set<OutputTypeId>();
    const options: { id: OutputTypeId; label: string; description: string; prompt: string }[] = [];
    for (const tool of tools) {
      if (!tool.outputType || seen.has(tool.outputType)) continue;
      seen.add(tool.outputType);
      options.push({
        id: tool.outputType,
        label: tool.label,
        description: tool.description,
        prompt: tool.prompt,
      });
    }
    return options;
  }, [tools]);

  const activePanelRef = useRef(state.activePanel);
  const activeNotebookIdRef = useRef(state.activeNotebookId);
  const refineQueueRef = useRef<RefineJob[]>(state.refineJobs);
  const refineRunningRef = useRef(false);
  const runNextRefineJobRef = useRef<() => void>(() => {});
  const [queueSummary, setQueueSummary] = useState({ total: 0, done: 0 });

  useEffect(() => {
    activePanelRef.current = state.activePanel;
    if (state.activePanel === 'refine') {
      dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: false });
    }
  }, [dispatch, state.activePanel]);

  useEffect(() => {
    activeNotebookIdRef.current = state.activeNotebookId;
  }, [state.activeNotebookId]);

  useEffect(() => {
    refineQueueRef.current = state.refineJobs;
    if (refineRunningRef.current) return;
    if (!state.refineJobs.some((job) => job.status === 'queued')) return;
    runNextRefineJobRef.current();
  }, [state.refineJobs]);

  useEffect(() => {
    if (state.refinePrompt.trim().length > 0) return;
    if (!refineTemplates[0]) return;
    dispatch({ type: 'SET_REFINE_PROMPT', payload: refineTemplates[0].prompt });
  }, [dispatch, refineTemplates, state.refinePrompt]);

  const selectedChunkIds = useMemo(
    () =>
      state.citations
        .filter((citation) => state.selectedCitationIds[citation.id])
        .map((citation) => citation.chunkId ?? Number(citation.id))
        .filter((value): value is number => Number.isFinite(value) && value > 0),
    [state.citations, state.selectedCitationIds],
  );


  const updateRefineJobs = useCallback(
    (updater: (jobs: RefineJob[]) => RefineJob[]) => {
      const next = updater(refineQueueRef.current);
      refineQueueRef.current = next;
      dispatch({ type: 'SET_REFINE_JOBS', payload: next });
    },
    [dispatch],
  );

  const resetQueueSummary = useCallback(() => {
    setQueueSummary({ total: 0, done: 0 });
  }, []);

  const incrementQueueTotal = useCallback(() => {
    setQueueSummary((prev) => ({ total: prev.total + 1, done: prev.done }));
  }, []);

  const incrementQueueDone = useCallback(() => {
    setQueueSummary((prev) => ({ total: prev.total, done: prev.done + 1 }));
  }, []);

  const markJobCompleted = useCallback(
    (jobId: string) => {
      if (activePanelRef.current !== 'refine') {
        dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: true });
      }
      dispatch({ type: 'SET_RECENT_COMPLETED_JOB', payload: jobId });
      window.setTimeout(() => {
        dispatch({ type: 'SET_RECENT_COMPLETED_JOB', payload: null });
      }, 2000);
    },
    [dispatch],
  );

  const hasPendingRefineJobs = useCallback(
    () =>
      refineQueueRef.current.some(
        (job) => job.status === 'queued' || job.status === 'running',
      ),
    [],
  );

  const {
    outputQueueJobs,
    enqueueOutputJob,
    enqueueSlidesJob,
    hasPendingJobs,
    outputsLoading,
    outputsError,
    retryOutputs,
    deleteOutput,
    clearOutputs,
    fetchOutput,
  } = useOutputQueue({
    state,
    dispatch,
    isConnected,
    hasPendingRefineJobs,
    onQueueReset: resetQueueSummary,
    onQueueTotal: incrementQueueTotal,
    onQueueDone: incrementQueueDone,
    markJobCompleted,
  });

  const processRefineJob = useCallback(
    async (jobId: string, prompt: string, chunkIds: number[], jobNotebookId: number | null) => {
      try {
        let normalizedOutputs = {};
        let response = null;
        let resolvedCitations = null;
        if (jobNotebookId && isConnected) {
          response = await refineBatch(jobNotebookId, prompt, refineFormats, chunkIds);
          resolvedCitations = response?.citations
            ? response.citations.map(normalizeCitation)
            : null;
          normalizedOutputs = Object.entries(response.outputs ?? {}).reduce(
            (acc, [format, output]) => {
              if (!output) return acc;
              const key = format as RefineMode;
              acc[key] = {
                paragraph: output.paragraph ?? '',
                bullets: output.bullets ?? [],
                structured: output.structured ?? null,
                evidence: response?.evidence,
              };
              return acc;
            },
            {} as Record<RefineMode, any>,
          );
        } else {
          throw new Error('backend unavailable');
        }

        const completedAt = new Date().toISOString();
        const isCurrentNotebook =
          jobNotebookId != null && jobNotebookId === activeNotebookIdRef.current;
        updateRefineJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: 'done',
                  outputs: normalizedOutputs,
                  error: '',
                  citations: resolvedCitations ?? job.citations,
                  completedAt,
                  completedAtLabel: formatTimestamp(completedAt),
                }
              : job,
          ),
        );
        const stillTracked = refineQueueRef.current.some((job) => job.id === jobId);
        if (stillTracked) {
          incrementQueueDone();
        }
        if (isCurrentNotebook && stillTracked) {
          markJobCompleted(jobId);
        }
        if (resolvedCitations && isCurrentNotebook && stillTracked) {
          dispatch({
            type: 'SET_CITATIONS',
            payload: resolvedCitations,
          });
        }
      } catch (error) {
        const completedAt = new Date().toISOString();
        const isCurrentNotebook =
          jobNotebookId != null && jobNotebookId === activeNotebookIdRef.current;

        // Extract meaningful error message
        let errorMessage = '提炼失败，请稍后重试。';
        let userFacingError = '提炼生成失败。';

        if (error instanceof Error) {
          const statusError = error as Error & { status?: number };

          if (statusError.status === 503) {
            errorMessage = 'AI 服务暂时不可用，请检查模型配置。';
            userFacingError = 'AI 服务配置错误，请联系管理员。';
          } else if (statusError.status === 404) {
            errorMessage = '笔记本不存在或已被删除。';
            userFacingError = '笔记本已失效，请刷新页面。';
          } else if (statusError.status === 400) {
            errorMessage = '请求参数无效，请检查输入。';
            userFacingError = '输入参数有误。';
          } else if (statusError.status === 500) {
            errorMessage = '服务器内部错误，请稍后重试。';
            userFacingError = '服务器错误，请稍后重试。';
          } else if (error.message && error.message.length < 100) {
            errorMessage = error.message;
            userFacingError = error.message;
          }
        }

        updateRefineJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: 'error',
                  error: errorMessage,
                  completedAt,
                  completedAtLabel: formatTimestamp(completedAt),
                }
              : job,
          ),
        );
        const stillTracked = refineQueueRef.current.some((job) => job.id === jobId);
        if (stillTracked) {
          incrementQueueDone();
        }
        if (isCurrentNotebook && stillTracked) {
          markJobCompleted(jobId);
          dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: userFacingError } });
        }
      } finally {
        refineRunningRef.current = false;
        runNextRefineJobRef.current();
      }
    },
    [
      dispatch,
      isConnected,
      incrementQueueDone,
      markJobCompleted,
      refineFormats,
      updateRefineJobs,
    ],
  );

  const runNextRefineJob = useCallback(() => {
    if (refineRunningRef.current) return;
    const nextJob = refineQueueRef.current.find((job) => job.status === 'queued');
    if (!nextJob) return;

    refineRunningRef.current = true;
    updateRefineJobs((prev) =>
      prev.map((job) => (job.id === nextJob.id ? { ...job, status: 'running' } : job)),
    );
    void processRefineJob(
      nextJob.id,
      nextJob.prompt,
      nextJob.chunkIds ?? [],
      nextJob.notebookId,
    );
  }, [processRefineJob, updateRefineJobs]);

  runNextRefineJobRef.current = runNextRefineJob;

  const enqueueRefineJob = useCallback(
    ({
      prompt: jobPrompt,
      chunkIds,
      label,
    }: {
      prompt: string;
      chunkIds?: number[];
      label?: string;
    }) => {
      const createdAt = new Date().toISOString();
      const jobLabel = label ?? resolveTemplateLabel(jobPrompt, refineTemplates);
      if (!hasPendingJobs()) {
        resetQueueSummary();
      }
      incrementQueueTotal();
      const job: RefineJob = {
        id: createId(),
        prompt: jobPrompt,
        status: 'queued',
        chunkIds,
        outputs: null,
        error: '',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        completedAt: null,
        completedAtLabel: '',
        pinned: false,
        title: buildJobTitle(jobLabel, createdAt),
        notebookId: state.activeNotebookId,
      };
      updateRefineJobs((prev) => [job, ...prev]);
      return job;
    },
    [
      hasPendingJobs,
      incrementQueueTotal,
      refineTemplates,
      resetQueueSummary,
      state.activeNotebookId,
      updateRefineJobs,
    ],
  );

  const resolveOutputPrompt = useCallback(
    (type: OutputTypeId, prompt?: string) => {
      const normalized = prompt?.trim();
      if (normalized) return normalized;
      const fallback = outputTypeOptions.find((item) => item.id === type)?.prompt ?? '';
      return fallback;
    },
    [outputTypeOptions],
  );

  const handleRefineGenerate = useCallback(() => {
    if (!isConnected) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '未连接到后端服务。' } });
      return;
    }
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '请先创建笔记本。' } });
      return;
    }
    const trimmed = state.refinePrompt.trim();
    if (!trimmed) return;
    enqueueRefineJob({
      prompt: trimmed,
      chunkIds: selectedChunkIds.length ? [...selectedChunkIds] : [],
      label: resolveTemplateLabel(trimmed, refineTemplates),
    });
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
  }, [
    dispatch,
    enqueueRefineJob,
    isConnected,
    refineTemplates,
    selectedChunkIds,
    state.activeNotebookId,
    state.refinePrompt,
  ]);

  const handleCompareSelectedCitations = useCallback(() => {
    if (!selectedChunkIds.length) return;
    if (!isConnected) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '未连接到后端服务。' } });
      return;
    }
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '请先创建笔记本。' } });
      return;
    }
    const promptText =
      compareTemplate?.prompt ??
      '基于选中引用生成对比分析，输出相同点 / 差异点 / 结论。';
    dispatch({ type: 'SET_REFINE_PROMPT', payload: promptText });
    enqueueRefineJob({
      prompt: promptText,
      chunkIds: [...selectedChunkIds],
      label: compareTemplate?.label ?? '对比分析',
    });
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
  }, [
    compareTemplate?.label,
    compareTemplate?.prompt,
    dispatch,
    enqueueRefineJob,
    isConnected,
    selectedChunkIds,
    state.activeNotebookId,
  ]);

  const handleReplayRefineJob = useCallback(
    (job: RefineJob) => {
      if (!isConnected) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '未连接到后端服务。' } });
        return;
      }
      if (!state.activeNotebookId) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '请先创建笔记本。' } });
        return;
      }
      if (!job.prompt.trim()) return;
      dispatch({ type: 'SET_REFINE_PROMPT', payload: job.prompt });
      enqueueRefineJob({
        prompt: job.prompt,
        chunkIds: job.chunkIds ?? [],
        label: resolveTemplateLabel(job.prompt, refineTemplates),
      });
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
    },
    [dispatch, enqueueRefineJob, isConnected, refineTemplates, state.activeNotebookId],
  );

  const handleToggleRefinePin = useCallback(
    (jobId: string) => {
      updateRefineJobs((prev) =>
        prev.map((job) => (job.id === jobId ? { ...job, pinned: !job.pinned } : job)),
      );
    },
    [updateRefineJobs],
  );

  const handleDeleteRefineJob = useCallback(
    (jobId: string) => {
      updateRefineJobs((prev) => prev.filter((job) => job.id !== jobId));
    },
    [updateRefineJobs],
  );

  const handleClearRefineJobs = useCallback(() => {
    refineRunningRef.current = false;
    updateRefineJobs(() => []);
    dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: false });
    dispatch({ type: 'SET_RECENT_COMPLETED_JOB', payload: null });
  }, [dispatch, updateRefineJobs]);

  const handleToggleRefineSetting = useCallback(
    (key: keyof typeof state.refineSettings) => {
      dispatch({
        type: 'SET_REFINE_SETTINGS',
        payload: { ...state.refineSettings, [key]: !state.refineSettings[key] },
      });
    },
    [dispatch, state.refineSettings],
  );

  const setOutputType = useCallback(
    (value: OutputTypeId) => {
      dispatch({ type: 'SET_OUTPUT_TYPE', payload: value });
    },
    [dispatch],
  );

  const setRefineMode = useCallback(
    (mode: RefineMode) => {
      dispatch({ type: 'SET_REFINE_MODE', payload: mode });
    },
    [dispatch],
  );

  const setRefinePrompt = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_REFINE_PROMPT', payload: value });
    },
    [dispatch],
  );

  const handleGenerateOutput = useCallback((overrideType?: OutputTypeId, modelId?: string | null) => {
    if (!isConnected) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '未连接到后端服务。' } });
      return;
    }
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
      return;
    }
    const selectedType = overrideType ?? state.outputType;
    if (selectedType === 'SLIDES') {
      dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请使用演示工具进行生成。' } });
      return;
    }
    const selectedOption = outputTypeOptions.find((item) => item.id === selectedType);
    const promptSource = overrideType ? selectedOption?.prompt : state.refinePrompt || selectedOption?.prompt;
    const prompt = resolveOutputPrompt(selectedType, promptSource);
    if (!overrideType && prompt) {
      dispatch({ type: 'SET_REFINE_PROMPT', payload: prompt });
    }
    if (overrideType) {
      dispatch({ type: 'SET_OUTPUT_TYPE', payload: selectedType });
    }
    enqueueOutputJob({
      type: selectedType,
      prompt,
      chunkIds: selectedChunkIds.length ? selectedChunkIds : [],
      modelId: modelId ?? undefined,
    });
    if (state.activePanel !== 'refine') {
      dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: true });
    }
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
  }, [
    dispatch,
    enqueueOutputJob,
    isConnected,
    outputTypeOptions,
    resolveOutputPrompt,
    selectedChunkIds,
    state.activeNotebookId,
    state.activePanel,
    state.outputType,
    state.refinePrompt,
  ]);

  const handleReplayOutput = useCallback(
    (output: OutputItem) => {
      if (!isConnected) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '未连接到后端服务。' } });
        return;
      }
      if (!state.activeNotebookId) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
        return;
      }
      if (output.type === 'SLIDES') {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请使用演示工具进行生成。' } });
        return;
      }
      const prompt = resolveOutputPrompt(output.type, output.prompt);
      dispatch({ type: 'SET_OUTPUT_TYPE', payload: output.type });
      if (prompt) {
        dispatch({ type: 'SET_REFINE_PROMPT', payload: prompt });
      }
      enqueueOutputJob({
        type: output.type,
        prompt,
        chunkIds: output.chunkIds ?? [],
      });
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
    },
    [dispatch, enqueueOutputJob, isConnected, resolveOutputPrompt, state.activeNotebookId],
  );

  const saveContentAsNote = useCallback(
    (content: string) => {
      if (!isConnected) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '未连接到后端服务。' } });
        return;
      }
      if (!state.activeNotebookId) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
        return;
      }
      enqueueOutputJob({
        type: 'PARAGRAPH',
        prompt: content,
        chunkIds: [],
      });
      if (state.activePanel !== 'refine') {
        dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: true });
      }
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
    },
    [dispatch, enqueueOutputJob, isConnected, state.activeNotebookId, state.activePanel],
  );

  return {
    refineFormats,
    refineTemplates,
    compareTemplate,
    tools,
    toolsLoading,
    toolsError: !isConnected ? '未连接到后端服务。' : toolsError ? '工具加载失败' : '',
    selectedChunkIds,
    refineMode: state.refineMode,
    setRefineMode,
    refinePrompt: state.refinePrompt,
    setRefinePrompt,
    refineJobs: state.refineJobs,
    refineSettings: state.refineSettings,
    hasNewOutput: state.hasNewOutput,
    recentCompletedJobId: state.recentCompletedJobId,
    onGenerateRefine: handleRefineGenerate,
    onCompareSelected: handleCompareSelectedCitations,
    onReplayRefineJob: handleReplayRefineJob,
    onTogglePin: handleToggleRefinePin,
    onDeleteJob: handleDeleteRefineJob,
    onClearJobs: handleClearRefineJobs,
    onToggleSetting: handleToggleRefineSetting,
    outputTypeOptions,
    outputType: state.outputType,
    setOutputType,
    outputs: state.outputs,
    outputQueueJobs,
    queueSummary,
    outputsLoading,
    outputsError,
    onGenerateOutput: handleGenerateOutput,
    onQueueSlides: enqueueSlidesJob,
    onReplayOutput: handleReplayOutput,
    onDeleteOutput: deleteOutput,
    saveContentAsNote,
    retryOutputs,
    onClearOutputs: clearOutputs,
    fetchOutput,
  };
}
