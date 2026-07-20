import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { useOutputQueue } from '../../shared/hooks/useOutputQueue';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type {
  FieldDescriptor,
  FrontendBundleDescriptor,
  OutputItem,
  OutputTypeId,
  PluginConfigSchema,
  PreviewDescriptor,
  RenderDescriptor,
  SlideGenerationConfig,
  WorkspaceTool,
} from '../../shared/types';
import { collectOutputCitations } from '../../shared/utils';

/** Wire payloads from Eden `workspace/tools` — normalize into UI types (no shared-types island). */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeFieldDescriptor(field: unknown): FieldDescriptor {
  const f = asRecord(field);
  const children = Array.isArray(f.children) ? f.children : [];
  return {
    key: f.key as string,
    type: f.type as FieldDescriptor['type'],
    label: (f.label as string | null) ?? null,
    children: children.map(normalizeFieldDescriptor),
  };
}

function normalizeRenderDescriptor(descriptor?: unknown | null): RenderDescriptor | null {
  if (!descriptor) return null;
  const d = asRecord(descriptor);
  const rawItemSchema = d.itemSchema as Record<string, unknown> | null | undefined;
  return {
    layout: d.layout as RenderDescriptor['layout'],
    itemSchema: rawItemSchema
      ? {
          fields: ((rawItemSchema.fields as unknown[]) ?? []).map(normalizeFieldDescriptor),
        }
      : null,
    options: (d.options as Record<string, unknown>) ?? {},
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
    themePreset: (raw.themePreset as string | null | undefined) ?? null,
    frontmatter: (raw.frontmatter as string | null | undefined) ?? null,
  };
}

function normalizePreviewDescriptor(descriptor?: unknown | null): PreviewDescriptor | null {
  if (!descriptor) return null;
  const d = asRecord(descriptor);
  return {
    kind: (d.kind as PreviewDescriptor['kind']) ?? 'external_url',
    service: (d.service as string | null) ?? null,
    url: (d.url as string | null) ?? null,
    openInNewTab: (d.openInNewTab as boolean) ?? false,
    meta: (d.meta as Record<string, unknown>) ?? {},
  };
}

function normalizeConfigSchema(schema?: unknown | null): PluginConfigSchema | null {
  if (!schema) return null;
  const s = asRecord(schema);
  return {
    defaults: normalizeSlideGenerationDefaults(
      (s.defaults ?? null) as Record<string, unknown> | null,
    ) as PluginConfigSchema['defaults'],
    quantityOptions: (s.quantityOptions ?? []) as PluginConfigSchema['quantityOptions'],
    difficultyOptions: (s.difficultyOptions ?? []) as PluginConfigSchema['difficultyOptions'],
    audienceOptions: (s.audienceOptions ?? []) as PluginConfigSchema['audienceOptions'],
    structureOptions: (s.structureOptions ?? []) as PluginConfigSchema['structureOptions'],
    toneOptions: (s.toneOptions ?? []) as PluginConfigSchema['toneOptions'],
    languageOptions: (s.languageOptions ?? []) as PluginConfigSchema['languageOptions'],
    densityOptions: (s.densityOptions ?? []) as PluginConfigSchema['densityOptions'],
    themePresetOptions: ((s.themePresetOptions ?? []) as Array<Record<string, unknown>>).map(
      (option) => ({
        id: option.id as string,
        label: option.label as string,
        template: (option.template ?? {}) as Record<string, unknown>,
      }),
    ),
    topicPlaceholder: (s.topicPlaceholder as string) ?? '',
    supportsTopic: (s.supportsTopic as boolean) ?? false,
    engine: (s.engine as string | null) ?? null,
    preview: normalizePreviewDescriptor(s.preview ?? null),
  };
}

function normalizeFrontendBundle(bundle?: unknown | null): FrontendBundleDescriptor | null {
  if (!bundle) return null;
  const b = asRecord(bundle);
  return {
    apiVersion: (b.apiVersion as FrontendBundleDescriptor['apiVersion']) ?? 'v1',
    kind: (b.kind as FrontendBundleDescriptor['kind']) ?? 'builtin',
    id: b.id as string,
    export: (b.export as string) ?? 'render',
    meta: (b.meta as Record<string, unknown>) ?? {},
  };
}

function normalizeTool(tool: unknown): WorkspaceTool {
  const t = asRecord(tool);
  return {
    id: t.id as string,
    label: t.label as string,
    description: t.description as string,
    tone: t.tone as WorkspaceTool['tone'],
    outputType: t.outputType as WorkspaceTool['outputType'],
    prompt: t.prompt as string,
    renderDescriptor: normalizeRenderDescriptor(t.renderDescriptor ?? null),
    configSchema: normalizeConfigSchema(t.configSchema ?? null),
    frontendBundle: normalizeFrontendBundle(t.frontendBundle ?? null),
    badge: (t.badge as string | undefined) ?? undefined,
    enabled: (t.enabled as boolean) !== false,
  };
}

export function useRefine() {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const hasNewOutputCurrent = useWorkspaceStore((s) => s.hasNewOutput);
  const recentCompletedJobIdCurrent = useWorkspaceStore((s) => s.recentCompletedJobId);
  const selectedSourceIdsCurrent = useWorkspaceStore((s) => s.selectedSourceIds);
  const outputsCurrent = useWorkspaceStore((s) => s.outputs);
  const outputTypeCurrent = useWorkspaceStore((s) => s.outputType);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const {
    data: toolsData,
    error: toolsError,
    isLoading: toolsLoading,
    mutate: refreshTools,
  } = useSWR(
    isConnected ? 'workspace/tools' : null,
    async () => {
      const { data, error } = await api.v2.workspace.tools.get();
      if (error)
        throw new Error(typeof error === 'string' ? error : typeof error === 'string' ? error : '');
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

  const selectedSourceIds = useMemo(
    () =>
      Object.entries(selectedSourceIdsCurrent)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((value) => Number.isFinite(value) && value > 0),
    [selectedSourceIdsCurrent],
  );

  const hasPendingRefineJobs = useCallback(() => false, []);

  const resolveSelectedSourceIds = useCallback(async () => selectedSourceIds, [selectedSourceIds]);

  const resolveOutputPrompt = useCallback(
    (type: OutputTypeId, prompt?: string) => {
      const normalized = prompt?.trim();
      if (normalized) return normalized;
      const fallback = outputTypeOptions.find((item) => item.id === type)?.prompt ?? '';
      return fallback;
    },
    [outputTypeOptions],
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

  const {
    outputQueueJobs,
    enqueueOutputJob,
    enqueueSlidesJob,
    outputsLoading,
    outputsError,
    retryOutputs,
    retryOutputJob,
    cancelOutputJob,
    deleteOutput,
    clearOutputs,
    fetchOutput,
    ensureOutputDetail,
  } = useOutputQueue({
    isConnected,
    hasPendingRefineJobs,
    onQueueReset: resetQueueSummary,
    onQueueTotal: incrementQueueTotal,
    onQueueDone: incrementQueueDone,
    markJobCompleted,
  });

  const setOutputType = useCallback(
    (value: OutputTypeId) => {
      store.getState().setOutputType(value);
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
    tools,
    toolsDiagnostics,
    toolsLoading,
    toolsError: !isConnected ? '未连接到后端服务。' : toolsError ? '工具加载失败' : '',
    refreshTools,
    selectedSourceIds,
    hasNewOutput: hasNewOutputCurrent,
    recentCompletedJobId: recentCompletedJobIdCurrent,
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
    ensureOutputDetail,
  };
}
