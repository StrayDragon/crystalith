import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  IconButton,
  Input,
  Textarea,
  Typography,
  Chip,
  Spinner,
} from '@material-tailwind/react';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import { ModelSelector } from './ModelSelector';
import type { SlideDraft, SlideGenerationConfig, SlideOutline, SlideOutlineItem, SlideStage } from '../../shared/types';
import {
  createDraftV1NotebooksNotebookIdSlidesDraftsPost as createSlidesDraft,
  getLatestDraftV1NotebooksNotebookIdSlidesDraftsLatestGet as getLatestSlidesDraft,
  getSlidesConfigV1WorkspaceToolsSlidesConfigGet as getSlidesConfig,
  getDraftV1NotebooksNotebookIdSlidesDraftsSlideIdGet as getSlidesDraft,
  updateDraftV1NotebooksNotebookIdSlidesDraftsSlideIdPatch as updateSlidesDraft,
  updateOutlineV1NotebooksNotebookIdSlidesDraftsSlideIdOutlinePut as updateSlidesOutline,
  updateMarkdownV1NotebooksNotebookIdSlidesDraftsSlideIdMarkdownPut as updateSlidesMarkdown,
} from '../../../../api/generated';
import { buildSlidevPreviewUrl } from '@crystalith-slidev';
import { toast } from '../../../../shared/toast';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import { buildFrontmatterPreview, normalizeGenerationConfig } from './utils/slides';

const STAGES: { id: SlideStage; label: string }[] = [
  { id: 'input', label: '输入' },
  { id: 'outline', label: '大纲' },
  { id: 'markdown', label: 'Markdown' },
];

type SlidesConfigOption = {
  id: string;
  label: string;
  isDefault?: boolean;
};

type SlidesThemePreset = {
  id: string;
  label: string;
  template: Record<string, any>;
};

type SlidesConfig = {
  defaults: SlideGenerationConfig;
  quantityOptions: SlidesConfigOption[];
  audienceOptions: SlidesConfigOption[];
  structureOptions: SlidesConfigOption[];
  toneOptions: SlidesConfigOption[];
  languageOptions: SlidesConfigOption[];
  densityOptions: SlidesConfigOption[];
  themePresetOptions: SlidesThemePreset[];
};

function normalizeSlidesConfig(raw: any): SlidesConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const defaults = normalizeGenerationConfig(raw.defaults) ?? {};
  const normalizeOption = (option: any) => ({
    id: option.id,
    label: option.label,
    isDefault: option.is_default ?? option.isDefault ?? false,
  });
  const normalizeTheme = (option: any) => ({
    id: option.id,
    label: option.label,
    template: option.template ?? {},
  });
  return {
    defaults: {
      quantity: defaults.quantity ?? null,
      audience: defaults.audience ?? null,
      structure: defaults.structure ?? null,
      tone: defaults.tone ?? null,
      language: defaults.language ?? null,
      density: defaults.density ?? null,
      themePreset: defaults.themePreset ?? null,
      frontmatter: defaults.frontmatter ?? '',
    },
    quantityOptions: (raw.quantity_options ?? []).map(normalizeOption),
    audienceOptions: (raw.audience_options ?? []).map(normalizeOption),
    structureOptions: (raw.structure_options ?? []).map(normalizeOption),
    toneOptions: (raw.tone_options ?? []).map(normalizeOption),
    languageOptions: (raw.language_options ?? []).map(normalizeOption),
    densityOptions: (raw.density_options ?? []).map(normalizeOption),
    themePresetOptions: (raw.theme_preset_options ?? []).map(normalizeTheme),
  };
}

function resolveOptionId(
  value: string | null | undefined,
  options: SlidesConfigOption[],
): string {
  if (value && options.some((option) => option.id === value)) return value;
  const fallback = options.find((option) => option.isDefault)?.id ?? options[0]?.id ?? '';
  return fallback;
}

function normalizeDraft(raw: any): SlideDraft {
  return {
    id: Number(raw.id),
    notebookId: Number(raw.notebook_id ?? raw.notebookId ?? 0),
    outputId: raw.output_id ?? raw.outputId ?? null,
    title: raw.title ?? null,
    prompt: raw.prompt ?? null,
    engine: raw.engine ?? 'slidev',
    chunkIds: raw.chunk_ids ?? raw.chunkIds ?? null,
    sourceIds: raw.source_ids ?? raw.sourceIds ?? null,
    outline: raw.outline ?? null,
    markdown: raw.markdown ?? null,
    generationConfig: normalizeGenerationConfig(raw.generation_config ?? raw.generationConfig),
    stage: raw.stage ?? 'input',
    status: raw.status ?? 'idle',
    errorMessage: raw.error_message ?? raw.errorMessage ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function outlineTitleFromDraft(draft: SlideDraft | null) {
  return draft?.outline?.title || draft?.title || '演示';
}

function outlineItemsFromDraft(draft: SlideDraft | null): SlideOutlineItem[] {
  return draft?.outline?.slides?.length ? draft.outline.slides : [];
}

function resolveErrorStatus(error: any): number | undefined {
  if (!error) return undefined;
  if (typeof error.status === 'number') return error.status;
  if (typeof error?.response?.status === 'number') return error.response.status;
  return undefined;
}

interface SlidesStudioDialogProps {
  open: boolean;
  onClose: () => void;
  notebookId: number | null;
  selectedSourceIds?: number[];
  isConnected: boolean;
  onOutputsUpdated: () => void;
  openMode?: 'config' | 'preview';
  draftId?: number | null;
  queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
  onQueueSlides?: (payload: {
    title: string;
    prompt: string;
    sourceIds: number[];
    generationConfig: SlideGenerationConfig;
    modelId?: string | null;
  }) => Promise<{ draftId?: number | null } | null>;
}

export default function SlidesStudioDialog({
  open,
  onClose,
  notebookId,
  selectedSourceIds = [],
  isConnected,
  onOutputsUpdated,
  openMode = 'config',
  draftId = null,
  queueStatus = null,
  onQueueSlides,
}: SlidesStudioDialogProps) {
  const [draft, setDraft] = useState<SlideDraft | null>(null);
  const [activeStage, setActiveStage] = useState<SlideStage>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [events, setEvents] = useState<{ type: string; message: string }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [configQuantity, setConfigQuantity] = useState('');
  const [configAudience, setConfigAudience] = useState('');
  const [configStructure, setConfigStructure] = useState('');
  const [configTone, setConfigTone] = useState('');
  const [configLanguage, setConfigLanguage] = useState('');
  const [configDensity, setConfigDensity] = useState('');
  const [configThemePreset, setConfigThemePreset] = useState('');
  const [configFrontmatter, setConfigFrontmatter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configModelId, setConfigModelId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [outlineTitle, setOutlineTitle] = useState('');
  const [outlineItems, setOutlineItems] = useState<SlideOutlineItem[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [isPreviewSyncing, setIsPreviewSyncing] = useState(false);
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const autoPreviewRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const maxEvents = 200;
  const isConfigOnly = openMode === 'config';
  const isPreviewMode = openMode === 'preview';
  const {
    data: slidesConfigData,
    error: slidesConfigError,
    isLoading: slidesConfigLoading,
  } = useSWR(open && isConnected ? 'workspace/slides-config' : null, () => getSlidesConfig(), {
    revalidateOnFocus: false,
  });
  const slidesConfig = useMemo(() => normalizeSlidesConfig(slidesConfigData), [slidesConfigData]);
  const slidesConfigErrorMessage = !isConnected
    ? '未连接到后端服务。'
    : slidesConfigError
      ? '演示配置加载失败。'
      : '';

  const selectionLabel = useMemo(() => {
    const draftSourceIds = isPreviewMode ? draft?.sourceIds ?? [] : [];
    const activeSourceIds = draftSourceIds.length ? draftSourceIds : selectedSourceIds;
    if (activeSourceIds.length) {
      return `已选择 ${activeSourceIds.length} 个来源，将仅基于选中来源生成。`;
    }
    return '未选择来源，无法生成演示。';
  }, [draft?.sourceIds, isPreviewMode, selectedSourceIds]);

  const selectedThemePreset = useMemo(() => {
    const options = slidesConfig?.themePresetOptions ?? [];
    if (!options.length) return null;
    return options.find((option) => option.id === configThemePreset) ?? options[0] ?? null;
  }, [configThemePreset, slidesConfig?.themePresetOptions]);
  const configDefaults = slidesConfig?.defaults ?? null;

  const frontmatterPreview = useMemo(
    () =>
      buildFrontmatterPreview(
        title.trim() || '演示',
        selectedThemePreset?.template,
        configFrontmatter,
      ),
    [configFrontmatter, selectedThemePreset?.template, title],
  );

  const previewStale = useMemo(
    () => Boolean(previewMarkdown && previewMarkdown !== markdown),
    [previewMarkdown, markdown],
  );
  const previewReady = Boolean(previewMarkdown);
  const previewUrl = useMemo(() => buildSlidevPreviewUrl(previewKey), [previewKey]);
  const previewStatus = isPreviewSyncing ? '同步中' : previewReady ? '已同步' : '未同步';
  const hasSelectedSources = useMemo(() => {
    const draftSourceIds = draft?.sourceIds ?? [];
    return draftSourceIds.length > 0 || selectedSourceIds.length > 0;
  }, [draft?.sourceIds, selectedSourceIds]);
  const previewStatusTone = isPreviewSyncing ? 'blue' : previewReady ? 'green' : 'gray';

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const resolveSourceIds = useCallback(async () => selectedSourceIds, [selectedSourceIds]);

  const resetDraftState = useCallback(() => {
    const defaults = configDefaults;
    const quantityOptions = slidesConfig?.quantityOptions ?? [];
    const audienceOptions = slidesConfig?.audienceOptions ?? [];
    const structureOptions = slidesConfig?.structureOptions ?? [];
    const toneOptions = slidesConfig?.toneOptions ?? [];
    const languageOptions = slidesConfig?.languageOptions ?? [];
    const densityOptions = slidesConfig?.densityOptions ?? [];
    const themeOptions = slidesConfig?.themePresetOptions ?? [];
    setDraft(null);
    setActiveStage('input');
    setLoading(false);
    setIsGenerating(false);
    setConfigQuantity(resolveOptionId(defaults?.quantity ?? null, quantityOptions));
    setConfigAudience(resolveOptionId(defaults?.audience ?? null, audienceOptions));
    setConfigStructure(resolveOptionId(defaults?.structure ?? null, structureOptions));
    setConfigTone(resolveOptionId(defaults?.tone ?? null, toneOptions));
    setConfigLanguage(resolveOptionId(defaults?.language ?? null, languageOptions));
    setConfigDensity(resolveOptionId(defaults?.density ?? null, densityOptions));
    setConfigThemePreset(resolveOptionId(defaults?.themePreset ?? null, themeOptions));
    setConfigFrontmatter(defaults?.frontmatter ?? '');
    setShowAdvanced(false);
    setConfigModelId(null);
    setTitle('');
    setPrompt('');
    setOutlineTitle('');
    setOutlineItems([]);
    setMarkdown('');
    setEvents([]);
    setError('');
    setPreviewMarkdown('');
    setPreviewError('');
    setPreviewKey(0);
    setIsPreviewSyncing(false);
    setShowMarkdownEditor(false);
    autoPreviewRef.current = null;
    setIsQueueing(false);
  }, [configDefaults, slidesConfig]);

  const applyGenerationConfig = useCallback((config: SlideGenerationConfig | null | undefined) => {
    const defaults = configDefaults;
    const quantityOptions = slidesConfig?.quantityOptions ?? [];
    const audienceOptions = slidesConfig?.audienceOptions ?? [];
    const structureOptions = slidesConfig?.structureOptions ?? [];
    const toneOptions = slidesConfig?.toneOptions ?? [];
    const languageOptions = slidesConfig?.languageOptions ?? [];
    const densityOptions = slidesConfig?.densityOptions ?? [];
    const themeOptions = slidesConfig?.themePresetOptions ?? [];
    setConfigQuantity(
      resolveOptionId(config?.quantity ?? defaults?.quantity ?? null, quantityOptions),
    );
    setConfigAudience(
      resolveOptionId(config?.audience ?? defaults?.audience ?? null, audienceOptions),
    );
    setConfigStructure(
      resolveOptionId(config?.structure ?? defaults?.structure ?? null, structureOptions),
    );
    setConfigTone(resolveOptionId(config?.tone ?? defaults?.tone ?? null, toneOptions));
    setConfigLanguage(
      resolveOptionId(config?.language ?? defaults?.language ?? null, languageOptions),
    );
    setConfigDensity(
      resolveOptionId(config?.density ?? defaults?.density ?? null, densityOptions),
    );
    setConfigThemePreset(
      resolveOptionId(config?.themePreset ?? defaults?.themePreset ?? null, themeOptions),
    );
    setConfigFrontmatter(config?.frontmatter ?? defaults?.frontmatter ?? '');
  }, [configDefaults, slidesConfig]);

  const syncFromDraft = useCallback((nextDraft: SlideDraft | null) => {
    if (!nextDraft) {
      resetDraftState();
      return;
    }
    setDraft(nextDraft);
    applyGenerationConfig(nextDraft.generationConfig);
    setTitle(nextDraft.title ?? '');
    setPrompt(nextDraft.prompt ?? '');
    setOutlineTitle(outlineTitleFromDraft(nextDraft));
    setOutlineItems(outlineItemsFromDraft(nextDraft));
    setMarkdown(nextDraft.markdown ?? '');
    setActiveStage(nextDraft.stage ?? 'input');
  }, [applyGenerationConfig, resetDraftState]);

  const loadDraft = useCallback(async () => {
    if (!open) return;
    if (isConfigOnly) {
      resetDraftState();
      return;
    }
    if (!notebookId || !isConnected) {
      syncFromDraft(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const latest = draftId
        ? await getSlidesDraft({ path: { notebook_id: notebookId, slide_id: draftId } })
        : await getLatestSlidesDraft({ path: { notebook_id: notebookId } });
      syncFromDraft(normalizeDraft(latest));
    } catch (err: any) {
      const status = resolveErrorStatus(err);
      if (status === 404) {
        resetDraftState();
      } else {
        setError('加载演示草稿失败。');
      }
    } finally {
      setLoading(false);
    }
  }, [draftId, isConfigOnly, isConnected, notebookId, open, resetDraftState, syncFromDraft]);

  const refreshDraft = useCallback(async (slideId?: number) => {
    if (!notebookId || !isConnected) return;
    const targetId = slideId ?? draft?.id;
    if (!targetId) return;
    const latest = await getSlidesDraft({ path: { notebook_id: notebookId, slide_id: targetId } });
    syncFromDraft(normalizeDraft(latest));
  }, [draft?.id, isConnected, notebookId, syncFromDraft]);

  useEffect(() => {
    if (open) {
      setIsFullscreen(false);
      setIsQueueing(false);
      setIsGenerating(false);
      void loadDraft();
    } else {
      closeEventSource();
      setIsFullscreen(false);
      setIsQueueing(false);
      setIsGenerating(false);
    }
  }, [closeEventSource, loadDraft, open]);

  useEffect(() => {
    if (!open) return;
    if (isConfigOnly) {
      setActiveStage('input');
      return;
    }
    if (isPreviewMode) {
      setActiveStage('markdown');
    }
  }, [isConfigOnly, isPreviewMode, open]);

  useEffect(() => {
    if (!open || !slidesConfig) return;
    setConfigQuantity((prev) =>
      prev || resolveOptionId(configDefaults?.quantity ?? null, slidesConfig.quantityOptions),
    );
    setConfigAudience((prev) =>
      prev || resolveOptionId(configDefaults?.audience ?? null, slidesConfig.audienceOptions),
    );
    setConfigStructure((prev) =>
      prev || resolveOptionId(configDefaults?.structure ?? null, slidesConfig.structureOptions),
    );
    setConfigTone((prev) =>
      prev || resolveOptionId(configDefaults?.tone ?? null, slidesConfig.toneOptions),
    );
    setConfigLanguage((prev) =>
      prev || resolveOptionId(configDefaults?.language ?? null, slidesConfig.languageOptions),
    );
    setConfigDensity((prev) =>
      prev || resolveOptionId(configDefaults?.density ?? null, slidesConfig.densityOptions),
    );
    setConfigThemePreset((prev) =>
      prev || resolveOptionId(configDefaults?.themePreset ?? null, slidesConfig.themePresetOptions),
    );
    setConfigFrontmatter((prev) => prev || configDefaults?.frontmatter || '');
  }, [configDefaults, open, slidesConfig]);

  useEffect(() => () => closeEventSource(), [closeEventSource]);

  useEffect(() => {
    if (!draft?.id) {
      setPreviewMarkdown('');
      setPreviewError('');
      setPreviewKey(0);
      setIsPreviewSyncing(false);
      autoPreviewRef.current = null;
      return;
    }
    setPreviewMarkdown('');
    setPreviewError('');
    setPreviewKey(0);
    setIsPreviewSyncing(false);
    autoPreviewRef.current = null;
  }, [draft?.id]);

  useEffect(() => {
    if (!open || !isPreviewMode || !draft?.id || !isConnected) return;
    if (queueStatus !== 'running') return;
    const timer = window.setInterval(() => {
      void refreshDraft(draft.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [draft?.id, isConnected, isPreviewMode, open, queueStatus, refreshDraft]);

  useEffect(() => {
    if (!open || !isPreviewMode || !draft?.id) return;
    if (queueStatus !== 'done') return;
    void refreshDraft(draft.id);
  }, [draft?.id, isPreviewMode, open, queueStatus, refreshDraft]);

  useEffect(() => {
    if (!open || !isPreviewMode) return;
    setShowMarkdownEditor(true);
  }, [isPreviewMode, open]);

  const buildGenerationConfig = useCallback((): SlideGenerationConfig => {
    const frontmatter = configFrontmatter.trim();
    return {
      quantity: configQuantity,
      audience: configAudience,
      structure: configStructure,
      tone: configTone,
      language: configLanguage,
      density: configDensity,
      themePreset: configThemePreset,
      frontmatter: frontmatter || undefined,
    };
  }, [
    configAudience,
    configDensity,
    configFrontmatter,
    configLanguage,
    configQuantity,
    configStructure,
    configThemePreset,
    configTone,
  ]);

  const buildGenerationConfigPayload = useCallback(() => {
    const config = buildGenerationConfig();
    return {
      quantity: config.quantity,
      audience: config.audience,
      structure: config.structure,
      tone: config.tone,
      language: config.language,
      density: config.density,
      theme_preset: config.themePreset,
      frontmatter: config.frontmatter,
    };
  }, [buildGenerationConfig]);

  const saveInputStage = useCallback(async () => {
    if (!notebookId) return null;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return null;
    }
    setError('');
    const resolvedSourceIds = await resolveSourceIds();
    if (resolvedSourceIds.length === 0) {
      setError('请先选择来源。');
      return null;
    }
    const payload = {
      title: title.trim() || undefined,
      prompt: prompt.trim() || undefined,
      source_ids: resolvedSourceIds,
      generation_config: buildGenerationConfigPayload(),
    };
    if (!draft) {
      const created = await createSlidesDraft({
        path: { notebook_id: notebookId },
        body: payload,
      });
      const normalized = normalizeDraft(created);
      syncFromDraft(normalized);
      return normalized;
    }
    const updated = await updateSlidesDraft({
      path: { notebook_id: notebookId, slide_id: draft.id },
      body: payload,
    });
    const normalized = normalizeDraft(updated);
    syncFromDraft(normalized);
    return normalized;
  }, [
    buildGenerationConfigPayload,
    draft,
    isConnected,
    notebookId,
    prompt,
    resolveSourceIds,
    syncFromDraft,
    title,
  ]);

  const handleQueueSlides = useCallback(async () => {
    if (!onQueueSlides) return;
    if (isQueueing) return;
    if (!isConnected) {
      toast.error('未连接到后端服务。');
      return;
    }
    if (!notebookId) {
      toast.error('请先创建笔记本。');
      return;
    }
    setError('');
    setIsQueueing(true);
    try {
      const resolvedSourceIds = await resolveSourceIds();
      if (resolvedSourceIds.length === 0) {
        setError('请先选择来源。');
        toast.error('请先选择来源。');
        return;
      }
      const job = await onQueueSlides({
        title: title.trim(),
        prompt: prompt.trim(),
        sourceIds: resolvedSourceIds,
        generationConfig: buildGenerationConfig(),
        modelId: configModelId ?? undefined,
      });
      if (job) {
        toast.success('已加入队列');
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入队列失败，请稍后重试。';
      setError(message);
      toast.error(message);
    } finally {
      setIsQueueing(false);
    }
  }, [
    buildGenerationConfig,
    configModelId,
    isConnected,
    isQueueing,
    notebookId,
    onClose,
    onQueueSlides,
    prompt,
    resolveSourceIds,
    title,
  ]);

  const handleSaveOutline = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return;
    }
    const outline: SlideOutline = {
      title: outlineTitle.trim() || title.trim() || '演示',
      slides: outlineItems.map((item) => ({
        title: item.title.trim() || '未命名幻灯片',
        bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      })),
    };
    const updated = await updateSlidesOutline({
      path: { notebook_id: notebookId, slide_id: draft.id },
      body: { outline },
    });
    syncFromDraft(normalizeDraft(updated));
  }, [draft, isConnected, notebookId, outlineItems, outlineTitle, syncFromDraft, title]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return;
    }
    const updated = await updateSlidesMarkdown({
      path: { notebook_id: notebookId, slide_id: draft.id },
      body: { markdown: markdown },
    });
    syncFromDraft(normalizeDraft(updated));
    onOutputsUpdated();
  }, [draft, isConnected, markdown, notebookId, onOutputsUpdated, syncFromDraft]);

  const buildOutlineStreamUrl = useCallback(
    (slideId: number) => {
      if (!notebookId) return '';
      const base = `/v1/notebooks/${notebookId}/slides/drafts/${slideId}/outline/stream`;
      return configModelId ? `${base}?model_id=${encodeURIComponent(configModelId)}` : base;
    },
    [configModelId, notebookId],
  );

  const buildMarkdownStreamUrl = useCallback(
    (slideId: number) => {
      if (!notebookId) return '';
      const base = `/v1/notebooks/${notebookId}/slides/drafts/${slideId}/markdown/stream`;
      return configModelId ? `${base}?model_id=${encodeURIComponent(configModelId)}` : base;
    },
    [configModelId, notebookId],
  );

  const startEventSource = useCallback(
    (
      url: string,
      handlers: { onDone?: () => Promise<void> | void; onError?: () => Promise<void> | void } = {},
    ) => {
      closeEventSource();
      setIsGenerating(true);
      setEvents([]);
      setError('');
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      const handleFinish = async (hasError = false) => {
        setIsGenerating(false);
        closeEventSource();
        if (hasError) {
          if (handlers.onError) await handlers.onError();
          return;
        }
        if (handlers.onDone) await handlers.onDone();
      };

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setEvents((prev) => {
          const next = [...prev, { type: 'progress', message: data.message || '生成中...' }];
          return next.length > maxEvents ? next.slice(-maxEvents) : next;
        });
      });

      eventSource.addEventListener('toolcall', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setEvents((prev) => {
          const next = [...prev, { type: 'toolcall', message: data.name || '调用生成工具' }];
          return next.length > maxEvents ? next.slice(-maxEvents) : next;
        });
      });

      eventSource.addEventListener('busy', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setError(data.message || '当前演示正在生成中。');
        void handleFinish(true);
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setError(data.message || '生成失败，请稍后重试。');
        void handleFinish(true);
      });

      eventSource.addEventListener('done', async () => {
        await handleFinish();
      });
    },
    [closeEventSource],
  );

  const handleGenerateOutline = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    const url = buildOutlineStreamUrl(saved.id);
    if (!url) return;
    startEventSource(url, {
      onDone: async () => {
        await refreshDraft(saved.id);
        setActiveStage('outline');
      },
    });
  }, [buildOutlineStreamUrl, isConnected, notebookId, refreshDraft, saveInputStage, startEventSource]);

  const handleGenerateMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return;
    }
    if (!draft.sourceIds || draft.sourceIds.length === 0) {
      setError('请先选择来源。');
      return;
    }
    await handleSaveOutline();
    const url = buildMarkdownStreamUrl(draft.id);
    if (!url) return;
    startEventSource(url, {
      onDone: async () => {
        await refreshDraft(draft.id);
        setActiveStage('markdown');
        onOutputsUpdated();
      },
    });
  }, [
    buildMarkdownStreamUrl,
    draft,
    handleSaveOutline,
    isConnected,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    startEventSource,
  ]);

  const handleGenerateAll = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError('未连接到后端服务。');
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    const outlineUrl = buildOutlineStreamUrl(saved.id);
    if (!outlineUrl) return;
    startEventSource(outlineUrl, {
      onDone: async () => {
        await refreshDraft(saved.id);
        const markdownUrl = buildMarkdownStreamUrl(saved.id);
        if (!markdownUrl) return;
        startEventSource(markdownUrl, {
          onDone: async () => {
            await refreshDraft(saved.id);
            setActiveStage('markdown');
            onOutputsUpdated();
          },
        });
      },
    });
  }, [
    buildMarkdownStreamUrl,
    buildOutlineStreamUrl,
    isConnected,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    saveInputStage,
    startEventSource,
  ]);

  const buildPreview = useCallback(async (force = false) => {
    if (!isConnected) {
      setPreviewError('未连接到后端服务。');
      return;
    }
    if (!markdown.trim()) {
      setPreviewError('请先生成 Markdown。');
      return;
    }
    setPreviewError('');
    setIsPreviewSyncing(true);
    try {
      await handleSaveMarkdown();
      setPreviewMarkdown(markdown);
      if (force || !previewMarkdown) {
        setPreviewKey((prev) => prev + 1);
      }
    } catch {
      setPreviewError('预览更新失败，请稍后重试。');
    } finally {
      setIsPreviewSyncing(false);
    }
  }, [draft?.markdown, handleSaveMarkdown, isConnected, markdown, previewMarkdown]);

  const handlePreview = useCallback(() => {
    void buildPreview(false);
  }, [buildPreview]);

  const handleRefreshPreview = useCallback(() => {
    void buildPreview(true);
  }, [buildPreview]);

  useEffect(() => {
    if (!open || !isPreviewMode || !draft?.id) return;
    if (!markdown.trim()) return;
    if (previewMarkdown) return;
    if (autoPreviewRef.current === draft.id) return;
    autoPreviewRef.current = draft.id;
    void buildPreview(false);
  }, [buildPreview, draft?.id, isPreviewMode, markdown, open, previewMarkdown]);

  const handleOpenPreviewWindow = useCallback(() => {
    if (!previewMarkdown) return;
    const url = buildSlidevPreviewUrl(previewKey || Date.now());
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [previewKey, previewMarkdown]);

  const handleAddSlide = () => {
    setOutlineItems((prev) => [...prev, { title: '', bullets: [] }]);
  };

  const handleUpdateSlideTitle = (index: number, value: string) => {
    setOutlineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, title: value } : item)),
    );
  };

  const handleUpdateSlideBullets = (index: number, value: string) => {
    const bullets = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setOutlineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, bullets } : item)),
    );
  };

  const handleRemoveSlide = (index: number) => {
    setOutlineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const stageContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      );
    }

    if (slidesConfigErrorMessage) {
      return (
        <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-6 text-center">
          <Typography variant="small" className="text-red-600">
            {slidesConfigErrorMessage}
          </Typography>
        </div>
      );
    }

    if ((isConfigOnly || activeStage === 'input') && slidesConfigLoading && !slidesConfig) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      );
    }

    if (!notebookId) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-6 text-center">
          <Typography variant="small" className="text-gray-600 dark:text-slate-300">
            请先创建或选择笔记本。
          </Typography>
        </div>
      );
    }

    if (isPreviewMode) {
      const previewTitle = title.trim() || outlineTitle.trim() || draft?.title || '演示';
      const slideCount = outlineItems.length || draft?.outline?.slides?.length || 0;
      const outlinePreview = outlineItems.slice(0, 4);
      const queueLabel = queueStatus
        ? {
            queued: '排队中',
            running: '生成中',
            error: '失败',
            done: '已完成',
          }[queueStatus]
        : draft?.status === 'running'
          ? '生成中'
          : draft?.status === 'error'
            ? '失败'
            : '就绪';
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Typography variant="small" className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                  演示信息
                </Typography>
                <Typography variant="h6" className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                  {previewTitle}
                </Typography>
                <Typography variant="small" className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                  {slideCount ? `${slideCount} 张幻灯片` : '尚未生成大纲'}
                </Typography>
              </div>
              <Button
                variant="text"
                size="sm"
                onClick={() => setShowMarkdownEditor((prev) => !prev)}
                className="px-2 py-1 text-xs text-gray-600 dark:text-slate-300"
              >
                {showMarkdownEditor ? '隐藏 Markdown' : '查看 Markdown'}
              </Button>
            </div>
            {outlinePreview.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                <Typography variant="small" className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold">
                  大纲速览
                </Typography>
                <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-slate-200">
                  {outlinePreview.map((item, index) => (
                    <li key={`preview-${index}`} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      <span className="truncate">{item.title || `幻灯片 ${index + 1}`}</span>
                    </li>
                  ))}
                </ul>
                {outlineItems.length > outlinePreview.length && (
                  <Typography variant="small" className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
                    还有 {outlineItems.length - outlinePreview.length} 张幻灯片
                  </Typography>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-300">
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                引擎：{draft?.engine || 'slidev'}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                状态：{queueLabel || '就绪'}
              </div>
            </div>
          </div>
          {showMarkdownEditor && (
            <div className="space-y-2">
              <Textarea
                label="Slidev Markdown"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
              <Typography variant="small" className="text-gray-600 dark:text-slate-300">
                {selectionLabel}
              </Typography>
            </div>
          )}
          {!showMarkdownEditor && (
            <Typography variant="small" className="text-gray-600 dark:text-slate-300">
              {selectionLabel}
            </Typography>
          )}
        </div>
      );
    }

    if (isConfigOnly || activeStage === 'input') {
      return (
        <div className="space-y-4">
          <Input
            label="演示标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            crossOrigin="anonymous"
          />
          <Textarea
            label="演示说明"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
          />
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Typography variant="small" className="text-gray-700 dark:text-slate-200 font-semibold">
                生成设置
              </Typography>
              <Button
                variant="text"
                size="sm"
                className="px-2 py-1 text-xs text-gray-600 dark:text-slate-300"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? '收起高级设置' : '高级设置'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                幻灯片数量
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configQuantity}
                  onChange={(event) => setConfigQuantity(event.target.value)}
                  name="slideQuantity"
                >
                  {quantityOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                结构模板
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configStructure}
                  onChange={(event) => setConfigStructure(event.target.value)}
                  name="slideStructure"
                >
                  {structureOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                受众定位
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configAudience}
                  onChange={(event) => setConfigAudience(event.target.value)}
                  name="slideAudience"
                >
                  {audienceOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                语气风格
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configTone}
                  onChange={(event) => setConfigTone(event.target.value)}
                  name="slideTone"
                >
                  {toneOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                输出语言
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configLanguage}
                  onChange={(event) => setConfigLanguage(event.target.value)}
                  name="slideLanguage"
                >
                  {languageOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                排版密度
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configDensity}
                  onChange={(event) => setConfigDensity(event.target.value)}
                  name="slideDensity"
                >
                  {densityOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                主题预设
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configThemePreset}
                  onChange={(event) => setConfigThemePreset(event.target.value)}
                  name="slideThemePreset"
                >
                  {themePresetOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {showAdvanced && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Typography variant="small" className="text-gray-600 dark:text-slate-300 text-xs font-medium">
                    Frontmatter 覆盖（YAML，可选）
                  </Typography>
                  <Textarea
                    value={configFrontmatter}
                    onChange={(event) => setConfigFrontmatter(event.target.value)}
                    rows={5}
                    className="font-mono text-[11px]"
                    placeholder={'theme: default\ncolorSchema: light\nfonts:\n  sans: "Manrope"\ntransition: fade'}
                  />
                  <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-[11px]">
                    留空将使用主题预设自动生成；如需覆盖请填写 YAML（不需要 --- 包裹）。
                  </Typography>
                </div>
                <div className="space-y-1">
                  <Typography variant="small" className="text-gray-600 dark:text-slate-300 text-xs font-medium">
                    Frontmatter 预览
                  </Typography>
                  <pre className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[11px] text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                    {frontmatterPreview}
                  </pre>
                </div>
                {isConnected && (
                  <div className="space-y-1">
                    <Typography variant="small" className="text-gray-600 dark:text-slate-300 text-xs font-medium">
                      AI 模型
                    </Typography>
                    <ModelSelector
                      value={configModelId}
                      onChange={setConfigModelId}
                      capability="chat"
                      label="选择生成模型"
                      size="md"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <Typography variant="small" className="text-gray-600 dark:text-slate-300">
            {selectionLabel}
          </Typography>
        </div>
      );
    }

    if (activeStage === 'outline') {
      return (
        <div className="space-y-4">
          <Input
            label="演示标题"
            value={outlineTitle}
            onChange={(event) => setOutlineTitle(event.target.value)}
            crossOrigin="anonymous"
          />
          <div className="space-y-4">
            {outlineItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-4 text-center text-sm text-gray-500 dark:text-slate-400">
                暂无大纲内容，请先生成或添加幻灯片。
              </div>
            ) : (
              outlineItems.map((item, index) => (
                <div key={`outline-${index}`} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      label={`幻灯片 ${index + 1} 标题`}
                      value={item.title}
                      onChange={(event) => handleUpdateSlideTitle(index, event.target.value)}
                      crossOrigin="anonymous"
                    />
                    <Button
                      variant="text"
                      color="red"
                      size="sm"
                      onClick={() => handleRemoveSlide(index)}
                    >
                      删除
                    </Button>
                  </div>
                  <Textarea
                    label="要点（每行一个）"
                    value={item.bullets.join('\n')}
                    onChange={(event) => handleUpdateSlideBullets(index, event.target.value)}
                    rows={4}
                  />
                </div>
              ))
            )}
          </div>
          <Button variant="outlined" color="blue" onClick={handleAddSlide}>
            添加幻灯片
          </Button>
          <Typography variant="small" className="text-gray-600 dark:text-slate-300">
            {selectionLabel}
          </Typography>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Textarea
          label="Slidev Markdown"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          rows={16}
          className="font-mono text-xs"
        />
        <Typography variant="small" className="text-gray-600 dark:text-slate-300">
          {selectionLabel}
        </Typography>
      </div>
    );
  };

  const stageActions = () => {
    if (!notebookId) {
      return (
        <Button variant="outlined" onClick={onClose}>
          关闭
        </Button>
      );
    }

    if (isConfigOnly) {
      return (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={onClose}>
            关闭
          </Button>
          <Button
            color="blue"
            onClick={handleQueueSlides}
            disabled={!onQueueSlides || isQueueing || loading || configActionsDisabled}
          >
            生成
          </Button>
        </div>
      );
    }

    if (isPreviewMode) {
      return (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={onClose}>
            关闭
          </Button>
          <Button variant="outlined" onClick={handleSaveMarkdown} disabled={isGenerating || !draft || !isConnected}>
            保存 Markdown
          </Button>
        </div>
      );
    }

    if (activeStage === 'input') {
      return (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="outlined"
            onClick={saveInputStage}
            disabled={isGenerating || configActionsDisabled}
          >
            保存
          </Button>
          <Button
            variant="outlined"
            onClick={handleGenerateOutline}
            disabled={isGenerating || configActionsDisabled}
          >
            生成大纲
          </Button>
          <Button
            color="blue"
            onClick={handleGenerateAll}
            disabled={isGenerating || configActionsDisabled}
          >
            一键生成
          </Button>
        </div>
      );
    }

    if (activeStage === 'outline') {
      return (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={() => setActiveStage('input')}>
            返回输入
          </Button>
          <Button
            variant="outlined"
            onClick={handleSaveOutline}
            disabled={isGenerating || !isConnected}
          >
            保存大纲
          </Button>
          <Button
            color="blue"
            onClick={handleGenerateMarkdown}
            disabled={isGenerating || !isConnected}
          >
            生成 Markdown
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <Button variant="outlined" onClick={() => setActiveStage('outline')}>
          返回大纲
        </Button>
        <Button
          variant="outlined"
          onClick={handleSaveMarkdown}
          disabled={isGenerating || !isConnected}
        >
          保存 Markdown
        </Button>
      </div>
    );
  };

  const canBuildPreview = Boolean(markdown.trim());
  const showPreviewPanel = !isConfigOnly;
  const gridLayoutClass = showPreviewPanel
    ? (isPreviewMode || activeStage === 'markdown'
        ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
        : 'lg:grid-cols-[minmax(0,1fr)_360px]')
    : 'lg:grid-cols-1';
  const headerSubtitle = isConfigOnly
    ? '配置演示参数'
    : isPreviewMode
      ? '演示预览'
      : '输入 → 大纲 → Markdown';
  const statusMessage = (() => {
    if (isGenerating) {
      return { tone: 'blue', message: '正在生成中，请稍候...' };
    }
    if (queueStatus === 'queued') {
      return { tone: 'gray', message: '已加入队列，等待生成...' };
    }
    if (queueStatus === 'running') {
      return { tone: 'blue', message: '正在生成中，请稍候...' };
    }
    if (queueStatus === 'error') {
      return { tone: 'red', message: '生成失败，请稍后重试。' };
    }
    if (draft?.status === 'running') {
      return { tone: 'blue', message: '正在生成中，请稍候...' };
    }
    return null;
  })();
  const configActionsDisabled =
    !isConnected || slidesConfigLoading || Boolean(slidesConfigError) || !hasSelectedSources;

  const quantityOptions = slidesConfig?.quantityOptions ?? [];
  const structureOptions = slidesConfig?.structureOptions ?? [];
  const audienceOptions = slidesConfig?.audienceOptions ?? [];
  const toneOptions = slidesConfig?.toneOptions ?? [];
  const languageOptions = slidesConfig?.languageOptions ?? [];
  const densityOptions = slidesConfig?.densityOptions ?? [];
  const themePresetOptions = slidesConfig?.themePresetOptions ?? [];

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  return (
    <Dialog
      open={open}
      handler={onClose}
      size="xxl"
      className={`rounded-xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 ux-modal-in ${
        isFullscreen
          ? 'absolute inset-0 min-w-[100vw] min-h-[100vh] h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw]'
          : 'absolute left-[5vw] top-[5vh] min-w-[90vw] min-h-[90vh] h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw]'
      }`}
    >
      <div ref={dialogRef} tabIndex={-1} className="flex flex-col flex-1 min-h-0">
      <DialogHeader className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 flex-shrink-0">
            <SlideshowIcon fontSize="small" />
          </div>
          <div className="min-w-0">
            <Typography variant="h6" className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 truncate">
              演示生成
            </Typography>
            <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-xs font-medium">
              {headerSubtitle}
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Chip value={draft?.engine || 'slidev'} size="sm" variant="ghost" />
          <IconButton
            variant="text"
            size="sm"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded-full"
            aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
          >
            {isFullscreen ? <CloseFullscreenIcon className="h-4 w-4" /> : <OpenInFullIcon className="h-4 w-4" />}
          </IconButton>
          <IconButton
            variant="text"
            size="sm"
            onClick={onClose}
            className="rounded-full"
            aria-label="关闭演示配置"
          >
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </DialogHeader>
      <DialogBody className="p-4 flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 h-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!isConfigOnly && !isPreviewMode && (
              <div className="flex flex-wrap items-center gap-2">
                {STAGES.map((stage) => (
                  <Button
                    key={stage.id}
                    size="sm"
                    variant={activeStage === stage.id ? 'filled' : 'outlined'}
                    color={activeStage === stage.id ? 'blue' : 'gray'}
                    onClick={() => setActiveStage(stage.id)}
                    disabled={isGenerating}
                  >
                    {stage.label}
                  </Button>
                ))}
              </div>
            )}
            <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-xs">
              {draft ? `草稿 ${draft.id}` : isConfigOnly ? '新建演示' : '暂无草稿'}
            </Typography>
          </div>
          <div className={`grid grid-cols-1 ${gridLayoutClass} gap-4 flex-1 min-h-0`}>
            <div className={`flex flex-col gap-3 min-h-0 ${isPreviewMode ? 'order-2 lg:order-1' : ''}`}>
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              {statusMessage && !error && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    statusMessage.tone === 'red'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : statusMessage.tone === 'blue'
                        ? 'border-blue-100 bg-blue-50 text-blue-700'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
                  }`}
                >
                  {statusMessage.message}
                </div>
              )}
              {events.length > 0 && !isConfigOnly && !isPreviewMode && (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={`${event.type}-${index}`}
                      className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 flex items-start gap-2"
                    >
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full ${
                          event.type === 'toolcall' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}
                      />
                      <span className="flex-1">{event.message}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex-1 min-h-0 overflow-auto">
                {stageContent()}
              </div>
            </div>
            {showPreviewPanel && (
              <div className={`rounded-xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white via-white to-slate-50 p-3 flex flex-col min-h-0 shadow-sm ${isPreviewMode ? 'order-1 lg:order-2' : ''}`}>
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <Typography variant="small" className="text-gray-700 dark:text-slate-200 font-semibold">
                      幻灯片预览
                    </Typography>
                    <Chip value={previewStatus} size="sm" variant="ghost" color={previewStatusTone} />
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      variant="text"
                      size="sm"
                      onClick={handleOpenPreviewWindow}
                      className="rounded-full"
                      disabled={!previewReady}
                      aria-label="在新窗口打开预览"
                    >
                      <OpenInNewIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    color="blue"
                    onClick={handlePreview}
                    disabled={!canBuildPreview || isGenerating || isPreviewSyncing || !isConnected}
                  >
                    {isPreviewSyncing ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-3 w-3" />
                        同步中
                      </span>
                    ) : previewReady ? (
                      '同步预览'
                    ) : (
                      '生成预览'
                    )}
                  </Button>
                  {previewReady && (
                    <Button
                      size="sm"
                      variant="outlined"
                      onClick={handleRefreshPreview}
                      disabled={isGenerating || isPreviewSyncing || !isConnected}
                    >
                      强制刷新
                    </Button>
                  )}
                </div>
                {isPreviewMode && !previewReady && canBuildPreview && (
                  <Typography variant="small" className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                    自动同步预览已开启，如未更新可点击“同步预览”。
                  </Typography>
                )}
                {previewStale && (
                  <Typography variant="small" className="text-amber-600 text-xs mt-2">
                    预览已过期，请刷新以同步最新 Markdown。
                  </Typography>
                )}
                {previewError && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mt-2"
                  >
                    {previewError}
                  </div>
                )}
                <div className="mt-3 flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-900/5 overflow-hidden flex items-center justify-center p-3">
                  {previewReady ? (
                    <div className="h-full w-auto max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-800 relative">
                      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-800 z-0">
                        <Spinner className="h-5 w-5 text-gray-400" />
                      </div>
                      <iframe
                        key={previewKey}
                        title="Slidev 预览"
                        src={previewUrl}
                        className="h-full w-full border-0 bg-white dark:bg-slate-800 relative z-10"
                        loading="lazy"
                      />
                    </div>
                  ) : isPreviewSyncing || isGenerating || queueStatus === 'running' || draft?.status === 'running' ? (
                    <div className="w-full max-w-full aspect-video rounded-lg border border-dashed border-slate-300 bg-white dark:bg-slate-900/70 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <Spinner className="h-4 w-4" />
                      <span>预览同步中...</span>
                    </div>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400 px-6 text-center">
                      <span>暂无预览，请先生成 Markdown 或点击“同步预览”。</span>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">
                        预览基于本地 Slidev 服务（默认 http://localhost:3030）。
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="flex items-center justify-end border-t border-gray-100 dark:border-slate-700 p-4">
        {stageActions()}
      </DialogFooter>
      </div>
    </Dialog>
  );
}
