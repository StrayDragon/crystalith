import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { createOutput, listOutputs, listWorkspaceTools, refineBatch } from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type {
  ApiWorkspaceTool,
  OutputItem,
  OutputTypeId,
  RefineJob,
  RefineMode,
  RefineTemplate,
  WorkspaceTool,
} from '../types';
import {
  buildJobTitle,
  buildRefineOutput,
  createId,
  formatTimestamp,
  normalizeCitation,
  normalizeOutput,
  resolveTemplateLabel,
} from '../utils';

const REFINE_FORMATS: RefineMode[] = ['paragraph', 'bullets', 'structured'];

const REFINE_TEMPLATES: RefineTemplate[] = [
  {
    id: 'core-insights',
    label: '关键结论',
    prompt: '提炼核心结论与决策要点，保持简洁。',
    group: '决策',
  },
  {
    id: 'action-items',
    label: '行动清单',
    prompt: '列出可执行的行动项，并按优先级排序。',
    group: '行动',
  },
  {
    id: 'role-advice',
    label: '角色建议',
    prompt: '按角色（负责人/协作方/风险人）给出建议要点。',
    group: '行动',
  },
  {
    id: 'risk-gaps',
    label: '风险盲点',
    prompt: '找出潜在风险、限制与未覆盖的关键点。',
    group: '风险',
  },
  {
    id: 'terms',
    label: '术语速记',
    prompt: '提炼关键术语并用一句话解释。',
    group: '洞察',
  },
  {
    id: 'compare',
    label: '对比差异',
    prompt: '如果存在多个对象/方案，提炼主要差异与取舍。',
    group: '分析',
  },
  {
    id: 'compare-analysis',
    label: '对比分析',
    prompt: '基于选中引用生成对比分析，输出相同点 / 差异点 / 结论。',
    group: '分析',
  },
  {
    id: 'questions',
    label: '问题清单',
    prompt: '列出尚待验证的问题与需要补充的信息。',
    group: '洞察',
  },
  {
    id: 'summary-outline',
    label: '摘要大纲',
    prompt: '整理成背景 / 洞察 / 下一步的三段式摘要。',
    group: '表达',
  },
  {
    id: 'highlights',
    label: '亮点摘录',
    prompt: '提炼最值得传播的亮点金句，控制在 3-5 条。',
    group: '表达',
  },
];

const DEFAULT_TOOLS: WorkspaceTool[] = [
  {
    id: 'faq',
    label: '闪卡',
    description: '问答清单',
    tone: 'blue',
    outputType: 'FAQ',
    prompt: '整理为 FAQ 问答清单。',
    enabled: true,
  },
  {
    id: 'guide',
    label: '指南',
    description: '学习/行动指南',
    tone: 'green',
    outputType: 'GUIDE',
    prompt: '生成结构化学习指南。',
    enabled: true,
  },
  {
    id: 'timeline',
    label: '时间轴',
    description: '关键事件序列',
    tone: 'rose',
    outputType: 'TIMELINE',
    prompt: '按时间轴整理关键事件。',
    enabled: true,
  },
  {
    id: 'mindmap',
    label: '思维导图',
    description: '主题层级结构',
    tone: 'indigo',
    outputType: 'MINDMAP',
    prompt: '生成思维导图层级结构。',
    enabled: true,
  },
  {
    id: 'quiz',
    label: '测验',
    description: '知识检验',
    tone: 'teal',
    outputType: 'QUIZ',
    prompt: '生成小测验题目。',
    enabled: true,
  },
  {
    id: 'briefing',
    label: '报告',
    description: '高层摘要',
    tone: 'amber',
    outputType: 'BRIEFING',
    prompt: '生成简报：背景/发现/建议/下一步。',
    enabled: true,
  },
];

const DEFAULT_OUTPUT_TYPE_OPTIONS = DEFAULT_TOOLS.map((tool) => ({
  id: tool.outputType,
  label: tool.label,
  description: tool.description,
  prompt: tool.prompt,
}));

type OutputQueueStatus = 'queued' | 'running' | 'done' | 'error';

interface OutputQueueJob {
  id: string;
  type: OutputTypeId;
  prompt: string;
  chunkIds: number[];
  status: OutputQueueStatus;
  createdAt: string;
  createdAtLabel: string;
  notebookId: number | null;
}

function buildDemoOutputContent(type: OutputTypeId, prompt: string) {
  if (type === 'FAQ') {
    return { items: [{ question: '演示问题', answer: prompt || '示例回答', citations: [] }] };
  }
  if (type === 'GUIDE') {
    return {
      modules: [
        {
          title: '演示模块',
          objective: { text: prompt || '示例目标', citations: [] },
          key_points: [{ text: '演示要点', citations: [] }],
          examples: [],
          exercises: [],
        },
      ],
    };
  }
  if (type === 'TIMELINE') {
    return {
      events: [
        {
          date: '2024',
          event: '演示事件',
          description: prompt || '示例描述',
          citations: [],
        },
      ],
    };
  }
  if (type === 'MINDMAP') {
    return {
      root: {
        label: prompt || '演示主题',
        citations: [],
        children: [
          { label: '子主题 A', citations: [], children: [] },
          { label: '子主题 B', citations: [], children: [] },
        ],
      },
    };
  }
  if (type === 'QUIZ') {
    return {
      questions: [
        {
          type: 'multiple_choice',
          question: prompt || '演示题目',
          options: ['选项 A', '选项 B', '选项 C'],
          answer: '选项 A',
          explanation: '示例解析',
          citations: [],
        },
      ],
    };
  }
  if (type === 'BRIEFING') {
    return {
      sections: [
        {
          heading: '演示简报',
          points: [{ text: prompt || '示例要点', citations: [] }],
        },
      ],
    };
  }
  if (type === 'PARAGRAPH') {
    return { text: prompt || '示例段落', citations: [] };
  }
  if (type === 'BULLETS') {
    return { items: [{ text: prompt || '示例要点', citations: [] }] };
  }
  if (type === 'STRUCTURED') {
    return { title: prompt || '示例主题', bullets: [{ text: '示例要点', citations: [] }], terms: [] };
  }
  return { summary: prompt || '示例输出' };
}

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
  const isDemo = state.connectionState === 'demo';
  const refineFormats = useMemo(() => REFINE_FORMATS, []);
  const refineTemplates = useMemo(() => REFINE_TEMPLATES, []);
  const compareTemplate = useMemo(
    () => refineTemplates.find((item) => item.id === 'compare-analysis') ?? null,
    [refineTemplates],
  );

  const { data: toolsData, error: toolsError } = useSWR(
    !isDemo ? 'workspace/tools' : null,
    listWorkspaceTools,
    { revalidateOnFocus: false },
  );

  const tools = useMemo<WorkspaceTool[]>(() => {
    if (isDemo) return DEFAULT_TOOLS;
    if (toolsData?.tools?.length) {
      return toolsData.tools.map(normalizeTool);
    }
    if (toolsError) {
      return DEFAULT_TOOLS;
    }
    return DEFAULT_TOOLS;
  }, [isDemo, toolsData, toolsError]);

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
    return options.length > 0 ? options : DEFAULT_OUTPUT_TYPE_OPTIONS;
  }, [tools]);

  const activePanelRef = useRef(state.activePanel);
  const activeNotebookIdRef = useRef(state.activeNotebookId);
  const refineQueueRef = useRef<RefineJob[]>(state.refineJobs);
  const refineRunningRef = useRef(false);
  const runNextRefineJobRef = useRef<() => void>(() => {});
  const [outputQueueJobs, setOutputQueueJobs] = useState<OutputQueueJob[]>([]);
  const [recentOutputJobId, setRecentOutputJobId] = useState<string | null>(null);
  const outputQueueRef = useRef<OutputQueueJob[]>(outputQueueJobs);
  const outputRunningRef = useRef(false);
  const runNextOutputJobRef = useRef<() => void>(() => {});
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
    outputQueueRef.current = outputQueueJobs;
    if (outputRunningRef.current) return;
    if (!outputQueueJobs.some((job) => job.status === 'queued')) return;
    runNextOutputJobRef.current();
  }, [outputQueueJobs]);

  useEffect(() => {
    setOutputQueueJobs([]);
    outputQueueRef.current = [];
    setQueueSummary({ total: 0, done: 0 });
  }, [state.activeNotebookId]);

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

  const { data: outputsData, error: outputsError, isLoading: outputsLoading, mutate: mutateOutputs } =
    useSWR(
      state.activeNotebookId && !isDemo
        ? ['workspace/outputs', state.activeNotebookId]
        : null,
      () => listOutputs(state.activeNotebookId ?? 0),
      { revalidateOnFocus: false },
    );

  const updateRefineJobs = useCallback(
    (updater: (jobs: RefineJob[]) => RefineJob[]) => {
      const next = updater(refineQueueRef.current);
      refineQueueRef.current = next;
      dispatch({ type: 'SET_REFINE_JOBS', payload: next });
    },
    [dispatch],
  );

  const updateOutputQueueJobs = useCallback(
    (updater: (jobs: OutputQueueJob[]) => OutputQueueJob[]) => {
      const next = updater(outputQueueRef.current);
      outputQueueRef.current = next;
      setOutputQueueJobs(next);
    },
    [],
  );

  const hasPendingJobs = useCallback(() => {
    const refinePending = refineQueueRef.current.some(
      (job) => job.status === 'queued' || job.status === 'running',
    );
    const outputPending = outputQueueRef.current.some(
      (job) => job.status === 'queued' || job.status === 'running',
    );
    return refinePending || outputPending;
  }, []);

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

  const processRefineJob = useCallback(
    async (jobId: string, prompt: string, chunkIds: number[], jobNotebookId: number | null) => {
      try {
        let normalizedOutputs = {};
        let response = null;
        let resolvedCitations = null;
        if (isDemo) {
          const demoOutput = buildRefineOutput(prompt);
          normalizedOutputs = refineFormats.reduce<Record<RefineMode, typeof demoOutput>>(
            (acc, format) => {
              acc[format] = demoOutput;
              return acc;
            },
            {} as Record<RefineMode, typeof demoOutput>,
          );
        } else if (jobNotebookId) {
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
          throw new Error('missing notebook');
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
      isDemo,
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

  const enqueueOutputJob = useCallback(
    ({ type, prompt, chunkIds }: { type: OutputTypeId; prompt: string; chunkIds: number[] }) => {
      const createdAt = new Date().toISOString();
      if (!hasPendingJobs()) {
        resetQueueSummary();
      }
      incrementQueueTotal();
      const job: OutputQueueJob = {
        id: createId(),
        type,
        prompt,
        chunkIds,
        status: 'queued',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        notebookId: state.activeNotebookId,
      };
      updateOutputQueueJobs((prev) => [job, ...prev]);
      return job;
    },
    [
      hasPendingJobs,
      incrementQueueTotal,
      resetQueueSummary,
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
        if (isDemo) {
          const createdAtRaw = new Date().toISOString();
          const demoOutput = {
            id: Date.now(),
            type: job.type,
            prompt: job.prompt,
            chunkIds: job.chunkIds,
            content: buildDemoOutputContent(job.type, job.prompt),
            createdAt: formatTimestamp(createdAtRaw),
            updatedAt: formatTimestamp(createdAtRaw),
            createdAtRaw,
            updatedAtRaw: createdAtRaw,
          };
          normalized = [demoOutput];
          dispatch({ type: 'SET_OUTPUTS', payload: [demoOutput, ...state.outputs] });
        } else if (job.notebookId) {
          const response = await createOutput(job.notebookId, job.type, {
            prompt: job.prompt || undefined,
            chunk_ids: job.chunkIds.length ? job.chunkIds : undefined,
          });
          normalized = [normalizeOutput(response)];
          dispatch({ type: 'SET_OUTPUTS', payload: [...normalized, ...state.outputs] });
          await mutateOutputs();
        } else {
          throw new Error('missing notebook');
        }
        updateOutputQueueJobs((prev) =>
          prev.map((item) =>
            item.id === job.id ? { ...item, status: 'done' } : item,
          ),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        const isCurrentNotebook =
          job.notebookId != null && job.notebookId === activeNotebookIdRef.current;
        if (normalized.length > 0 && stillTracked && isCurrentNotebook) {
          setRecentOutputJobId(job.id);
          window.setTimeout(() => {
            setRecentOutputJobId(null);
          }, 2000);
          markJobCompleted(job.id);
        }
        dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
        if (stillTracked) {
          incrementQueueDone();
        }
      } catch (error) {
        // Extract meaningful error message
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
          prev.map((item) =>
            item.id === job.id ? { ...item, status: 'error' } : item,
          ),
        );
        const stillTracked = outputQueueRef.current.some((item) => item.id === job.id);
        dispatch({
          type: 'SET_ERROR',
          payload: { key: 'outputs', value: userFacingError },
        });
        if (stillTracked) {
          incrementQueueDone();
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'outputs', value: false } });
        outputRunningRef.current = false;
        runNextOutputJobRef.current();
      }
    },
    [
      dispatch,
      incrementQueueDone,
      isDemo,
      markJobCompleted,
      mutateOutputs,
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

  const handleRefineGenerate = useCallback(() => {
    if (!state.activeNotebookId && !isDemo) {
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
    isDemo,
    refineTemplates,
    selectedChunkIds,
    state.activeNotebookId,
    state.refinePrompt,
  ]);

  const handleCompareSelectedCitations = useCallback(() => {
    if (!selectedChunkIds.length) return;
    if (!state.activeNotebookId && !isDemo) {
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
    isDemo,
    selectedChunkIds,
    state.activeNotebookId,
  ]);

  const handleReplayRefineJob = useCallback(
    (job: RefineJob) => {
      if (!state.activeNotebookId && !isDemo) {
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
    [dispatch, enqueueRefineJob, isDemo, refineTemplates, state.activeNotebookId],
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

  const handleGenerateOutput = useCallback((overrideType?: OutputTypeId) => {
    if (!state.activeNotebookId && !isDemo) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
      return;
    }
    const selectedType = overrideType ?? state.outputType;
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
    });
    if (state.activePanel !== 'refine') {
      dispatch({ type: 'SET_HAS_NEW_OUTPUT', payload: true });
    }
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'refine' });
  }, [
    dispatch,
    enqueueOutputJob,
    isDemo,
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
      if (!state.activeNotebookId && !isDemo) {
        dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '请先创建笔记本。' } });
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
    [dispatch, enqueueOutputJob, isDemo, resolveOutputPrompt, state.activeNotebookId],
  );

  const retryOutputs = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'outputs', value: '' } });
    await mutateOutputs();
  }, [dispatch, mutateOutputs]);

  const deleteOutput = useCallback(
    (outputId: number) => {
      dispatch({
        type: 'SET_OUTPUTS',
        payload: state.outputs.filter((item) => item.id !== outputId),
      });
    },
    [dispatch, state.outputs],
  );

  const clearOutputs = useCallback(() => {
    dispatch({ type: 'SET_OUTPUTS', payload: [] });
  }, [dispatch]);

  return {
    refineFormats,
    refineTemplates,
    compareTemplate,
    tools,
    selectedChunkIds,
    refineMode: state.refineMode,
    setRefineMode,
    refinePrompt: state.refinePrompt,
    setRefinePrompt,
    refineJobs: state.refineJobs,
    refineSettings: state.refineSettings,
    hasNewOutput: state.hasNewOutput,
    recentCompletedJobId: state.recentCompletedJobId,
    recentOutputJobId,
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
    outputsLoading: state.loading.outputs,
    outputsError: state.errors.outputs,
    onGenerateOutput: handleGenerateOutput,
    onReplayOutput: handleReplayOutput,
    onDeleteOutput: deleteOutput,
    retryOutputs,
    onClearOutputs: clearOutputs,
  };
}
