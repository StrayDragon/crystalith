import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import type {
  FieldDescriptor as ApiFieldDescriptor,
  FrontendBundleDescriptor as ApiFrontendBundleDescriptor,
  PluginConfigSchema as ApiPluginConfigSchema,
  PreviewDescriptor as ApiPreviewDescriptor,
  RenderDescriptor as ApiRenderDescriptor,
  WorkspaceTool as ApiWorkspaceTool,
} from '../../../../api/generated';
import { useOutputQueue } from '../../shared/hooks/useOutputQueue';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type {
  FieldDescriptor,
  FrontendBundleDescriptor,
  OutputItem,
  OutputTypeId,
  PluginConfigSchema,
  PreviewDescriptor,
  RefineOutput,
  RenderDescriptor,
  RefineJob,
  RefineMode,
  SlideGenerationConfig,
  WorkspaceTool,
} from '../../shared/types';
import {
  buildJobTitle,
  collectOutputCitations,
  createId,
  formatTimestamp,
  normalizeCitation,
  resolveTemplateLabel,
} from '../../shared/utils';
import { REFINE_FORMATS, REFINE_TEMPLATES } from './data/refineTemplates';

function normalizeFieldDescriptor(field: ApiFieldDescriptor): FieldDescriptor {
  return {
    key: field.key,
    type: field.type,
    label: field.label ?? null,
    children: (field.children ?? []).map(normalizeFieldDescriptor),
  };
}

function normalizeRenderDescriptor(
  descriptor?: ApiRenderDescriptor | null,
): RenderDescriptor | null {
  if (!descriptor) return null;
  return {
    layout: descriptor.layout,
    item_schema: descriptor.item_schema
      ? {
          fields: (descriptor.item_schema.fields ?? []).map(normalizeFieldDescriptor),
        }
      : null,
    options: descriptor.options ?? {},
  };
}

function normalizeSlideGenerationDefaults(
  raw: Record<string, unknown> | null | undefined,
): SlideGenerationConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    preference: (raw.preference as SlideGenerationConfig['preference']) ?? null,
    quantity: (raw.quantity as string | null | undefined) ?? null,
    audience: (raw.audience as string | null | undefined) ?? null,
    structure: (raw.structure as string | null | undefined) ?? null,
    tone: (raw.tone as string | null | undefined) ?? null,
    language: (raw.language as string | null | undefined) ?? null,
    density: (raw.density as string | null | undefined) ?? null,
    themePreset:
      (raw.themePreset as string | null | undefined) ??
      (raw.theme_preset as string | null | undefined) ??
      null,
    frontmatter: (raw.frontmatter as string | null | undefined) ?? null,
  };
}

function normalizePreviewDescriptor(
  descriptor?: ApiPreviewDescriptor | null,
): PreviewDescriptor | null {
  if (!descriptor) return null;
  return {
    kind: descriptor.kind ?? 'external_url',
    service: descriptor.service ?? null,
    url: descriptor.url ?? null,
    open_in_new_tab: descriptor.open_in_new_tab ?? false,
    meta: descriptor.meta ?? {},
  };
}

function normalizeConfigSchema(schema?: ApiPluginConfigSchema | null): PluginConfigSchema | null {
  if (!schema) return null;
  return {
    defaults: normalizeSlideGenerationDefaults(schema.defaults ?? null),
    quantity_options: schema.quantity_options ?? [],
    difficulty_options: schema.difficulty_options ?? [],
    audience_options: schema.audience_options ?? [],
    structure_options: schema.structure_options ?? [],
    tone_options: schema.tone_options ?? [],
    language_options: schema.language_options ?? [],
    density_options: schema.density_options ?? [],
    theme_preset_options: (schema.theme_preset_options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      template: option.template ?? {},
    })),
    topic_placeholder: schema.topic_placeholder ?? '',
    supports_topic: schema.supports_topic ?? false,
    engine: schema.engine ?? null,
    preview: normalizePreviewDescriptor(schema.preview ?? null),
  };
}

function normalizeFrontendBundle(
  bundle?: ApiFrontendBundleDescriptor | null,
): FrontendBundleDescriptor | null {
  if (!bundle) return null;
  return {
    api_version: bundle.api_version ?? 'v1',
    kind: bundle.kind ?? 'builtin',
    id: bundle.id,
    export: bundle.export ?? 'render',
    meta: bundle.meta ?? {},
  };
}

function normalizeTool(tool: ApiWorkspaceTool): WorkspaceTool {
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    tone: tool.tone,
    outputType: tool.output_type,
    prompt: tool.prompt,
    renderDescriptor: normalizeRenderDescriptor(tool.render_descriptor),
    configSchema: normalizeConfigSchema(tool.config_schema),
    frontendBundle: normalizeFrontendBundle(tool.frontend_bundle),
    badge: tool.badge ?? undefined,
    enabled: tool.enabled !== false,
  };
}

export function useRefine() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const refineModeCurrent = useWorkspaceStore((s) => s.refineMode);
  const refinePromptCurrent = useWorkspaceStore((s) => s.refinePrompt);
  const refineJobsCurrent = useWorkspaceStore((s) => s.refineJobs);
  const refineSettingsCurrent = useWorkspaceStore((s) => s.refineSettings);
  const hasNewOutputCurrent = useWorkspaceStore((s) => s.hasNewOutput);
  const recentCompletedJobIdCurrent = useWorkspaceStore((s) => s.recentCompletedJobId);
  const selectedSourceIdsCurrent = useWorkspaceStore((s) => s.selectedSourceIds);
  const outputsCurrent = useWorkspaceStore((s) => s.outputs);
  const outputTypeCurrent = useWorkspaceStore((s) => s.outputType);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const refineFormats = useMemo(() => REFINE_FORMATS, []);
  const refineTemplates = useMemo(() => REFINE_TEMPLATES, []);
  const compareTemplate = useMemo(
    () => refineTemplates.find((item) => item.id === 'compare-analysis') ?? null,
    [refineTemplates],
  );

  const {
    data: toolsData,
    error: toolsError,
    isLoading: toolsLoading,
    mutate: refreshTools,
  } = useSWR(
    isConnected ? 'workspace/tools' : null,
    async () => {
      const { data, error } = await api.v2.workspace.tools.get();
      if (error) throw error;
      return data as any;
    },
    {
      revalidateOnFocus: false,
    },
  );

  const toolsDiagnostics = useMemo(() => toolsData?.diagnostics ?? null, [toolsData]);

  const tools = useMemo<WorkspaceTool[]>(() => {
    // Return backend data if available
    if (toolsData?.tools?.length) {
      return toolsData.tools.map(normalizeTool);
    }
    // Return empty array while loading or on error (UI should show appropriate state)
    return [];
  }, [toolsData]);

  useEffect(() => {
    const descriptors: Partial<Record<OutputTypeId, RenderDescriptor>> = {};
    const bundles: Partial<Record<OutputTypeId, FrontendBundleDescriptor>> = {};
    for (const tool of tools) {
      if (tool.outputType && tool.renderDescriptor) {
        descriptors[tool.outputType] = tool.renderDescriptor;
      }
      if (tool.outputType && tool.frontendBundle) {
        bundles[tool.outputType] = tool.frontendBundle;
      }
    }
    store.getState().setOutputTypeRenderDescriptors(descriptors);
    store.getState().setOutputTypeFrontendBundles(bundles);
  }, [store, tools]);

  const outputTypeOptions = useMemo(() => {
    const seen = new Set<OutputTypeId>();
    const options: {
      id: OutputTypeId;
      label: string;
      description: string;
      prompt: string;
      badge?: string;
      enabled?: boolean;
    }[] = [];
    for (const tool of tools) {
      if (!tool.outputType || seen.has(tool.outputType)) continue;
      seen.add(tool.outputType);
      options.push({
        id: tool.outputType,
        label: tool.label,
        description: tool.description,
        prompt: tool.prompt,
        badge: tool.badge,
        enabled: tool.enabled,
      });
    }
    return options;
  }, [tools]);

  const activePanelRef = useRef(activePanel);
  const activeNotebookIdRef = useRef(activeNotebookId);
  const refineQueueRef = useRef<RefineJob[]>(refineJobsCurrent);
  const refineRunningRef = useRef(false);
  const runNextRefineJobRef = useRef<() => void>(() => {});
  const [queueSummary, setQueueSummary] = useState({ total: 0, done: 0 });

  useEffect(() => {
    activePanelRef.current = activePanel;
    if (activePanel === 'refine') {
      store.getState().setHasNewOutput(false);
    }
  }, [activePanel, store]);

  useEffect(() => {
    activeNotebookIdRef.current = activeNotebookId;
  }, [activeNotebookId]);

  useEffect(() => {
    refineQueueRef.current = refineJobsCurrent;
    if (refineRunningRef.current) return;
    if (!refineJobsCurrent.some((job) => job.status === 'queued')) return;
    runNextRefineJobRef.current();
  }, [refineJobsCurrent]);

  useEffect(() => {
    if (refinePromptCurrent.trim().length > 0) return;
    if (!refineTemplates[0]) return;
    store.getState().setRefinePrompt(refineTemplates[0].prompt);
  }, [refineTemplates, refinePromptCurrent, store]);

  const selectedSourceIds = useMemo(
    () =>
      Object.entries(selectedSourceIdsCurrent)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((value) => Number.isFinite(value) && value > 0),
    [selectedSourceIdsCurrent],
  );

  const resolveSelectedSourceIds = useCallback(async () => selectedSourceIds, [selectedSourceIds]);

  const updateRefineJobs = useCallback(
    (updater: (jobs: RefineJob[]) => RefineJob[]) => {
      const next = updater(refineQueueRef.current);
      refineQueueRef.current = next;
      store.getState().setRefineJobs(next);
    },
    [store],
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
        store.getState().setHasNewOutput(true);
      }
      store.getState().setRecentCompletedJob(jobId);
      window.setTimeout(() => {
        store.getState().setRecentCompletedJob(null);
      }, 2000);
    },
    [store],
  );

  const hasPendingRefineJobs = useCallback(
    () => refineQueueRef.current.some((job) => job.status === 'queued' || job.status === 'running'),
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
    retryOutputJob,
    cancelOutputJob,
    deleteOutput,
    clearOutputs,
    fetchOutput,
  } = useOutputQueue({
    isConnected,
    hasPendingRefineJobs,
    onQueueReset: resetQueueSummary,
    onQueueTotal: incrementQueueTotal,
    onQueueDone: incrementQueueDone,
    markJobCompleted,
  });

  const processRefineJob = useCallback(
    async (jobId: string, prompt: string, sourceIds: number[], jobNotebookId: number | null) => {
      try {
        const normalizedOutputs: Partial<Record<RefineMode, RefineOutput>> = {};
        let resolvedCitations = null as ReturnType<typeof normalizeCitation>[] | null;
        if (jobNotebookId && isConnected) {
          const { data: response, error: refineErr } = await api.v2.refine.batch.post({
            notebook_id: jobNotebookId,
            prompt,
            formats: [...refineFormats],
            source_ids: sourceIds,
          } as any);
          if (refineErr) throw refineErr;
          resolvedCitations = (response as any).citations?.map(normalizeCitation) ?? [];
          for (const [format, output] of Object.entries(response.outputs ?? {})) {
            if (!output) continue;
            const key = format as RefineMode;
            normalizedOutputs[key] = {
              paragraph: output.paragraph ?? '',
              bullets: output.bullets ?? [],
              structured: output.structured ?? null,
              evidence: response.evidence,
            };
          }
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
          store.getState().setCitations(resolvedCitations);
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
            errorMessage = '可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置。';
            userFacingError = '可选 AI 服务暂时不可用，请稍后重试或切换模型。';
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
          store.getState().setError('send', userFacingError);
        }
      } finally {
        refineRunningRef.current = false;
        runNextRefineJobRef.current();
      }
    },
    [isConnected, incrementQueueDone, markJobCompleted, refineFormats, store, updateRefineJobs],
  );

  const runNextRefineJob = useCallback(() => {
    if (refineRunningRef.current) return;
    const nextJob = refineQueueRef.current.find((job) => job.status === 'queued');
    if (!nextJob) return;

    refineRunningRef.current = true;
    updateRefineJobs((prev) =>
      prev.map((job) => (job.id === nextJob.id ? { ...job, status: 'running' } : job)),
    );
    void processRefineJob(nextJob.id, nextJob.prompt, nextJob.sourceIds ?? [], nextJob.notebookId);
  }, [processRefineJob, updateRefineJobs]);

  runNextRefineJobRef.current = runNextRefineJob;

  const enqueueRefineJob = useCallback(
    ({
      prompt: jobPrompt,
      sourceIds,
      label,
    }: {
      prompt: string;
      sourceIds?: number[];
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
        sourceIds,
        outputs: null,
        error: '',
        createdAt,
        createdAtLabel: formatTimestamp(createdAt),
        completedAt: null,
        completedAtLabel: '',
        pinned: false,
        title: buildJobTitle(jobLabel, createdAt),
        notebookId: activeNotebookId,
      };
      updateRefineJobs((prev) => [job, ...prev]);
      return job;
    },
    [
      hasPendingJobs,
      incrementQueueTotal,
      refineTemplates,
      resetQueueSummary,
      activeNotebookId,
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

  const handleRefineGenerate = useCallback(async () => {
    const s = store.getState();
    if (!isConnected) {
      s.setError('send', '未连接到后端服务。');
      return;
    }
    if (!s.activeNotebookId) {
      s.setError('send', '请先创建笔记本。');
      return;
    }
    const trimmed = s.refinePrompt.trim();
    if (!trimmed) return;
    const resolvedSourceIds = await resolveSelectedSourceIds();
    enqueueRefineJob({
      prompt: trimmed,
      sourceIds: resolvedSourceIds.length ? [...resolvedSourceIds] : [],
      label: resolveTemplateLabel(trimmed, refineTemplates),
    });
    s.setActivePanel('refine');
  }, [enqueueRefineJob, isConnected, refineTemplates, resolveSelectedSourceIds, store]);

  const handleCompareSelectedCitations = useCallback(async () => {
    const s = store.getState();
    if (!isConnected) {
      s.setError('send', '未连接到后端服务。');
      return;
    }
    if (!s.activeNotebookId) {
      s.setError('send', '请先创建笔记本。');
      return;
    }
    const resolvedSourceIds = await resolveSelectedSourceIds();
    const promptText =
      compareTemplate?.prompt ?? '基于选中来源生成对比分析，输出相同点 / 差异点 / 结论。';
    s.setRefinePrompt(promptText);
    enqueueRefineJob({
      prompt: promptText,
      sourceIds: [...resolvedSourceIds],
      label: compareTemplate?.label ?? '对比分析',
    });
    s.setActivePanel('refine');
  }, [
    compareTemplate?.label,
    compareTemplate?.prompt,
    enqueueRefineJob,
    isConnected,
    resolveSelectedSourceIds,
    store,
  ]);

  const handleReplayRefineJob = useCallback(
    (job: RefineJob) => {
      const s = store.getState();
      if (!isConnected) {
        s.setError('send', '未连接到后端服务。');
        return;
      }
      if (!s.activeNotebookId) {
        s.setError('send', '请先创建笔记本。');
        return;
      }
      if (!job.prompt.trim()) return;
      s.setRefinePrompt(job.prompt);
      enqueueRefineJob({
        prompt: job.prompt,
        sourceIds: job.sourceIds ?? [],
        label: resolveTemplateLabel(job.prompt, refineTemplates),
      });
      s.setActivePanel('refine');
    },
    [enqueueRefineJob, isConnected, refineTemplates, store],
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
    const s = store.getState();
    s.setHasNewOutput(false);
    s.setRecentCompletedJob(null);
  }, [store, updateRefineJobs]);

  const handleToggleRefineSetting = useCallback(
    (key: keyof typeof refineSettingsCurrent) => {
      const s = store.getState();
      s.setRefineSettings({ ...s.refineSettings, [key]: !s.refineSettings[key] });
    },
    [store],
  );

  const setOutputType = useCallback(
    (value: OutputTypeId) => {
      store.getState().setOutputType(value);
    },
    [store],
  );

  const setRefineMode = useCallback(
    (mode: RefineMode) => {
      store.getState().setRefineMode(mode);
    },
    [store],
  );

  const setRefinePrompt = useCallback(
    (value: string) => {
      store.getState().setRefinePrompt(value);
    },
    [store],
  );

  const handleGenerateOutput = useCallback(
    async (overrideType?: OutputTypeId, modelId?: string | null) => {
      const s = store.getState();
      if (!isConnected) {
        s.setError('outputs', '未连接到后端服务。');
        return;
      }
      if (!s.activeNotebookId) {
        s.setError('outputs', '请先创建笔记本。');
        return;
      }
      const selectedType = overrideType ?? s.outputType;
      if (selectedType === 'SLIDES') {
        s.setError('outputs', '请使用演示工具进行生成。');
        return;
      }
      const selectedOption = outputTypeOptions.find((item) => item.id === selectedType);
      const promptSource = overrideType
        ? selectedOption?.prompt
        : s.refinePrompt || selectedOption?.prompt;
      const prompt = resolveOutputPrompt(selectedType, promptSource);
      if (!overrideType && prompt) {
        s.setRefinePrompt(prompt);
      }
      if (overrideType) {
        s.setOutputType(selectedType);
      }
      const resolvedSourceIds = await resolveSelectedSourceIds();
      if (resolvedSourceIds.length === 0) {
        s.setError('outputs', '请先选择来源。');
        return;
      }
      enqueueOutputJob({
        type: selectedType,
        prompt,
        sourceIds: resolvedSourceIds.length ? resolvedSourceIds : [],
        modelId: modelId ?? undefined,
      });
      if (s.activePanel !== 'refine') {
        s.setHasNewOutput(true);
      }
      s.setActivePanel('refine');
    },
    [
      enqueueOutputJob,
      isConnected,
      outputTypeOptions,
      resolveOutputPrompt,
      resolveSelectedSourceIds,
      store,
    ],
  );

  const handleReplayOutput = useCallback(
    (output: OutputItem) => {
      const s = store.getState();
      if (!isConnected) {
        s.setError('outputs', '未连接到后端服务。');
        return;
      }
      if (!s.activeNotebookId) {
        s.setError('outputs', '请先创建笔记本。');
        return;
      }
      if (output.type === 'SLIDES') {
        s.setError('outputs', '请使用演示工具进行生成。');
        return;
      }
      const prompt = resolveOutputPrompt(output.type, output.prompt);
      s.setOutputType(output.type);
      if (prompt) {
        s.setRefinePrompt(prompt);
      }
      const outputSourceIds = Array.from(
        new Set(
          collectOutputCitations(output.content)
            .map((citation) => citation.sourceId)
            .filter(
              (value): value is number =>
                typeof value === 'number' && Number.isFinite(value) && value > 0,
            ),
        ),
      );
      if (outputSourceIds.length === 0) {
        s.setError('outputs', '请先选择来源。');
        return;
      }
      enqueueOutputJob({
        type: output.type,
        prompt,
        sourceIds: outputSourceIds,
      });
      s.setActivePanel('refine');
    },
    [enqueueOutputJob, isConnected, resolveOutputPrompt, store],
  );

  const saveContentAsNote = useCallback(
    (content: string) => {
      const s = store.getState();
      if (!isConnected) {
        s.setError('outputs', '未连接到后端服务。');
        return;
      }
      if (!s.activeNotebookId) {
        s.setError('outputs', '请先创建笔记本。');
        return;
      }
      enqueueOutputJob({
        type: 'PARAGRAPH',
        prompt: content,
        sourceIds: [],
      });
      if (s.activePanel !== 'refine') {
        s.setHasNewOutput(true);
      }
      s.setActivePanel('refine');
    },
    [enqueueOutputJob, isConnected, store],
  );

  return {
    refineFormats,
    refineTemplates,
    compareTemplate,
    tools,
    toolsDiagnostics,
    toolsLoading,
    toolsError: !isConnected ? '未连接到后端服务。' : toolsError ? '工具加载失败' : '',
    refreshTools,
    selectedSourceIds,
    refineMode: refineModeCurrent,
    setRefineMode,
    refinePrompt: refinePromptCurrent,
    setRefinePrompt,
    refineJobs: refineJobsCurrent,
    refineSettings: refineSettingsCurrent,
    hasNewOutput: hasNewOutputCurrent,
    recentCompletedJobId: recentCompletedJobIdCurrent,
    onGenerateRefine: handleRefineGenerate,
    onCompareSelected: handleCompareSelectedCitations,
    onReplayRefineJob: handleReplayRefineJob,
    onTogglePin: handleToggleRefinePin,
    onDeleteJob: handleDeleteRefineJob,
    onClearJobs: handleClearRefineJobs,
    onToggleSetting: handleToggleRefineSetting,
    outputTypeOptions,
    outputType: outputTypeCurrent,
    setOutputType,
    outputs: outputsCurrent,
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
    retryOutputJob,
    cancelOutputJob,
    onClearOutputs: clearOutputs,
    fetchOutput,
  };
}
