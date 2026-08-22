import type {
  WorkspaceTool as WireWorkspaceTool,
  WorkspaceToolsDiagnostics,
  WorkspaceToolsListResponse,
} from '@crystalith/shared';
import { PluginConfigSchema } from '@crystalith/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { toast } from '../../../../shared/toast';
import { useOutputQueue } from '../../shared/hooks/useOutputQueue';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type {
  FrontendBundleDescriptor,
  OutputItem,
  OutputTypeId,
  RenderDescriptor,
  WorkspaceTool,
} from '../../shared/types';
import { collectOutputCitations, normalizeOutput } from '../../shared/utils';

/**
 * Map Eden/shared workspace tool → UI view-model.
 * Nested descriptors stay shared SSOT; PluginConfig is re-parsed so Zod defaults apply
 * even when a partial payload arrives (e.g. MSW fixtures).
 */
function toUiTool(tool: WireWorkspaceTool): WorkspaceTool {
  return {
    id: tool.id,
    label: tool.label,
    description: tool.description,
    tone: tool.tone,
    outputType: tool.outputType,
    prompt: tool.prompt,
    enabled: tool.enabled,
    renderDescriptor: tool.renderDescriptor,
    configSchema: tool.configSchema != null ? PluginConfigSchema.parse(tool.configSchema) : null,
    frontendBundle: tool.frontendBundle ?? null,
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
  } = useSWR<WorkspaceToolsListResponse, Error>(
    isConnected ? 'workspace/tools' : null,
    async (): Promise<WorkspaceToolsListResponse> => {
      const { data, error } = await api.v2.workspace.tools.get();
      if (error) throw new Error(parseServerError(error).message);
      if (!data) throw new Error('workspace tools returned an empty payload');
      return data;
    },
    {
      revalidateOnFocus: false,
    },
  );

  const toolsDiagnostics = useMemo(
    (): WorkspaceToolsDiagnostics | null => toolsData?.diagnostics ?? null,
    [toolsData],
  );

  const tools = useMemo<WorkspaceTool[]>(() => {
    if (toolsData?.tools?.length) {
      return toolsData.tools.map(toUiTool);
    }
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
    mutateOutputs,
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
        s.setError('outputs', '请使用 Slides Studio 进行生成。');
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
        s.setError('outputs', '请使用 Slides Studio 进行生成。');
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
    async (content: string) => {
      const s = store.getState();
      if (!isConnected) {
        toast.warning('未连接到后端服务。');
        throw new Error('offline');
      }
      if (!s.activeNotebookId) {
        toast.warning('请先创建笔记本。');
        throw new Error('no notebook');
      }
      const trimmed = content.trim();
      if (!trimmed) {
        toast.warning('请输入笔记内容。');
        throw new Error('empty');
      }
      const firstLine =
        trimmed
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean)
          ?.replace(/^#+\s*/u, '')
          .slice(0, 80) ?? '笔记';
      const title = firstLine || '笔记';

      s.setError('outputs', '');
      s.setLoading('outputs', true);
      try {
        const { data, error } = await api.v2.notebooks({ nid: s.activeNotebookId }).outputs.post({
          type: 'PARAGRAPH',
          prompt: title,
          content: { title, text: trimmed },
        });
        if (error) throw new Error(parseServerError(error).message);
        if (!data) throw new Error('创建笔记失败');
        const normalized = normalizeOutput(data);
        const s2 = store.getState();
        s2.setOutputs([normalized, ...s2.outputs.filter((item) => item.id !== normalized.id)]);
        await mutateOutputs();
        if (s2.activePanel !== 'refine') {
          s2.setHasNewOutput(true);
        }
        s2.setActivePanel('refine');
        toast.success('笔记已保存');
      } catch (error) {
        const message = error instanceof Error ? error.message : '保存笔记失败';
        store.getState().setError('outputs', message);
        toast.error(message);
        throw error;
      } finally {
        store.getState().setLoading('outputs', false);
      }
    },
    [isConnected, mutateOutputs, store],
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
