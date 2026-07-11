import { buildSlidevPreviewUrl } from '@crystalith-slidev';
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
import CloseIcon from '@mui/icons-material/Close';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import { t } from '../../../../shared/i18n';
import { toast } from '../../../../shared/toast';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import {
  toApiGenerationPreference,
  useGenerationPreference,
} from '../../shared/hooks/useGenerationPreference';
import type {
  ConfigOption,
  GenerationPreferenceSetting,
  PreviewDescriptor,
  SlideDraft,
  SlideGenerationConfig,
  SlideOutline,
  SlideOutlineItem,
  SlideStage,
  WorkspaceTool,
} from '../../shared/types';
import { ModelSelector } from './ModelSelector';
import { buildFrontmatterPreview, normalizeGenerationConfig } from './utils/slides';

/** Minimal tools diagnostics shape (was from generated client). */
type WorkspaceToolsDiagnostics = {
  slides?: { available?: boolean; message?: string | null } | null;
} | null;

const STAGES: { id: SlideStage; label: string }[] = [
  { id: 'input', label: '输入' },
  { id: 'outline', label: '大纲' },
  { id: 'markdown', label: 'Markdown' },
];

function resolveOptionId(value: string | null | undefined, options: ConfigOption[]): string {
  if (value && options.some((option) => option.id === value)) return value;
  const fallback = options.find((option) => option.is_default)?.id ?? options[0]?.id ?? '';
  return fallback;
}

function normalizeDraft(raw: any): SlideDraft {
  return {
    id: Number(raw.id),
    notebookId: Number(raw.notebook_id ?? raw.notebookId ?? 0),
    outputId: raw.output_id ?? raw.outputId ?? null,
    title: raw.title ?? null,
    prompt: raw.prompt ?? null,
    engine: typeof raw.engine === 'string' ? raw.engine : '',
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

function appendRefreshToken(url: string, refreshKey: number): string {
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

function buildSlidesPreviewUrl(
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

function resolvePreviewProviderLabel(
  preview: PreviewDescriptor | null | undefined,
  engine: string | null | undefined,
): string {
  if (preview?.service?.trim()) return preview.service.trim();
  if (engine?.trim()) return engine.trim();
  return 'slides';
}

function resolveSlidesRecoveryHint(
  toolsDiagnostics: WorkspaceToolsDiagnostics | null | undefined,
): string {
  return (
    toolsDiagnostics?.slides?.hint ??
    toolsDiagnostics?.slides?.message ??
    toolsDiagnostics?.official?.['slides-slidev']?.hint ??
    ''
  );
}

interface SlidesStudioDialogProps {
  open: boolean;
  onClose: () => void;
  notebookId: number | null;
  selectedSourceIds?: number[];
  isConnected: boolean;
  onOutputsUpdated: () => void;
  slidesTool?: WorkspaceTool | null;
  toolsDiagnostics?: WorkspaceToolsDiagnostics | null;
  openMode?: 'config' | 'preview';
  draftId?: number | null;
  queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
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
  slidesTool = null,
  toolsDiagnostics = null,
  openMode = 'config',
  draftId = null,
  queueStatus = null,
  onQueueSlides,
}: SlidesStudioDialogProps) {
  const { preference: globalPreference, setPreference: setGlobalPreference } =
    useGenerationPreference();
  const [draft, setDraft] = useState<SlideDraft | null>(null);
  const [activeStage, setActiveStage] = useState<SlideStage>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [events, setEvents] = useState<{ type: string; message: string }[]>([]);
  const [debugTimings, setDebugTimings] = useState<Record<string, number> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [configPreference, setConfigPreference] = useState<GenerationPreferenceSetting>(
    () => globalPreference,
  );
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

  const generateAbortRef = useRef<AbortController | null>(null);
  const autoPreviewRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isConfigOnly = openMode === 'config';
  const isPreviewMode = openMode === 'preview';
  const slidesConfigLoading = false;
  const slidesConfig = slidesTool?.configSchema ?? null;
  const slidesRecoveryHint = useMemo(
    () => resolveSlidesRecoveryHint(toolsDiagnostics),
    [toolsDiagnostics],
  );
  const slidesConfigErrorMessage = !isConnected
    ? t('studio.slides.connection_required')
    : !slidesTool
      ? slidesRecoveryHint || '演示能力当前不可用。'
      : !slidesConfig
        ? '演示配置不可用。'
        : '';

  const selectionLabel = useMemo(() => {
    const draftSourceIds = isPreviewMode ? (draft?.sourceIds ?? []) : [];
    const activeSourceIds = draftSourceIds.length ? draftSourceIds : selectedSourceIds;
    if (activeSourceIds.length) {
      return `已选择 ${activeSourceIds.length} 个来源，将仅基于选中来源生成。`;
    }
    return '未选择来源，无法生成演示。';
  }, [draft?.sourceIds, isPreviewMode, selectedSourceIds]);

  const selectedThemePreset = useMemo(() => {
    const options = slidesConfig?.theme_preset_options ?? [];
    if (!options.length) return null;
    return options.find((option) => option.id === configThemePreset) ?? options[0] ?? null;
  }, [configThemePreset, slidesConfig?.theme_preset_options]);
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
  const previewDescriptor = slidesConfig?.preview ?? null;
  const slidesEngine = draft?.engine || slidesConfig?.engine || null;
  const previewProviderLabel = useMemo(
    () => resolvePreviewProviderLabel(previewDescriptor, slidesEngine),
    [previewDescriptor, slidesEngine],
  );
  const previewUrl = useMemo(
    () => buildSlidesPreviewUrl(previewDescriptor, previewKey),
    [previewDescriptor, previewKey],
  );
  const previewSupported = Boolean(previewUrl);
  const previewStatus = isPreviewSyncing ? '同步中' : previewReady ? '已同步' : '未同步';
  const hasSelectedSources = useMemo(() => {
    const draftSourceIds = draft?.sourceIds ?? [];
    return draftSourceIds.length > 0 || selectedSourceIds.length > 0;
  }, [draft?.sourceIds, selectedSourceIds]);
  const previewStatusTone = isPreviewSyncing ? 'blue' : previewReady ? 'green' : 'gray';

  const closeGenerate = useCallback(() => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
      generateAbortRef.current = null;
    }
  }, []);

  const resolveSourceIds = useCallback(async () => selectedSourceIds, [selectedSourceIds]);

  const resetDraftState = useCallback(() => {
    const defaults = configDefaults;
    const quantityOptions = slidesConfig?.quantity_options ?? [];
    const audienceOptions = slidesConfig?.audience_options ?? [];
    const structureOptions = slidesConfig?.structure_options ?? [];
    const toneOptions = slidesConfig?.tone_options ?? [];
    const languageOptions = slidesConfig?.language_options ?? [];
    const densityOptions = slidesConfig?.density_options ?? [];
    const themeOptions = slidesConfig?.theme_preset_options ?? [];
    setDraft(null);
    setActiveStage('input');
    setLoading(false);
    setIsGenerating(false);
    setConfigPreference(globalPreference);
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
  }, [configDefaults, globalPreference, slidesConfig]);

  const applyGenerationConfig = useCallback(
    (config: SlideGenerationConfig | null | undefined) => {
      const defaults = configDefaults;
      const quantityOptions = slidesConfig?.quantity_options ?? [];
      const audienceOptions = slidesConfig?.audience_options ?? [];
      const structureOptions = slidesConfig?.structure_options ?? [];
      const toneOptions = slidesConfig?.tone_options ?? [];
      const languageOptions = slidesConfig?.language_options ?? [];
      const densityOptions = slidesConfig?.density_options ?? [];
      const themeOptions = slidesConfig?.theme_preset_options ?? [];
      const preferenceValue =
        config?.preference === 'quality' || config?.preference === 'speed'
          ? config.preference
          : globalPreference;
      setConfigPreference(preferenceValue);
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
    },
    [configDefaults, globalPreference, slidesConfig],
  );

  const syncFromDraft = useCallback(
    (nextDraft: SlideDraft | null) => {
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
    },
    [applyGenerationConfig, resetDraftState],
  );

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
      if (draftId) {
        const { data, error: fetchErr } = await api.v2.studio.slides({ id: draftId }).get();
        if (fetchErr) throw fetchErr;
        syncFromDraft(normalizeDraft(data));
      } else {
        const { data, error: fetchErr } = await api.v2.studio.slides.get({
          query: { notebook_id: String(notebookId) },
        });
        if (fetchErr) throw fetchErr;
        const list = Array.isArray(data) ? data : [];
        const latest = list.at(-1) ?? null;
        if (latest) syncFromDraft(normalizeDraft(latest));
        else resetDraftState();
      }
    } catch (error: any) {
      const status = resolveErrorStatus(error);
      if (status === 404) {
        resetDraftState();
      } else {
        setError('加载演示草稿失败。');
      }
    } finally {
      setLoading(false);
    }
  }, [draftId, isConfigOnly, isConnected, notebookId, open, resetDraftState, syncFromDraft]);

  const refreshDraft = useCallback(
    async (slideId?: number) => {
      if (!notebookId || !isConnected) return;
      const targetId = slideId ?? draft?.id;
      if (!targetId) return;
      const { data, error: fetchErr } = await api.v2.studio.slides({ id: targetId }).get();
      if (fetchErr) throw fetchErr;
      syncFromDraft(normalizeDraft(data));
    },
    [draft?.id, isConnected, notebookId, syncFromDraft],
  );

  useEffect(() => {
    if (open) {
      setIsFullscreen(false);
      setIsQueueing(false);
      setIsGenerating(false);
      void loadDraft();
    } else {
      closeGenerate();
      setIsFullscreen(false);
      setIsQueueing(false);
      setIsGenerating(false);
    }
  }, [closeGenerate, loadDraft, open]);

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
    setConfigQuantity(
      (prev) =>
        prev || resolveOptionId(configDefaults?.quantity ?? null, slidesConfig.quantity_options),
    );
    setConfigAudience(
      (prev) =>
        prev || resolveOptionId(configDefaults?.audience ?? null, slidesConfig.audience_options),
    );
    setConfigStructure(
      (prev) =>
        prev || resolveOptionId(configDefaults?.structure ?? null, slidesConfig.structure_options),
    );
    setConfigTone(
      (prev) => prev || resolveOptionId(configDefaults?.tone ?? null, slidesConfig.tone_options),
    );
    setConfigLanguage(
      (prev) =>
        prev || resolveOptionId(configDefaults?.language ?? null, slidesConfig.language_options),
    );
    setConfigDensity(
      (prev) =>
        prev || resolveOptionId(configDefaults?.density ?? null, slidesConfig.density_options),
    );
    setConfigThemePreset(
      (prev) =>
        prev ||
        resolveOptionId(configDefaults?.themePreset ?? null, slidesConfig.theme_preset_options),
    );
    setConfigFrontmatter((prev) => prev || configDefaults?.frontmatter || '');
  }, [configDefaults, open, slidesConfig]);

  useEffect(() => () => closeGenerate(), [closeGenerate]);

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
    if (queueStatus !== 'done' && queueStatus !== 'cancelled') return;
    void refreshDraft(draft.id);
  }, [draft?.id, isPreviewMode, open, queueStatus, refreshDraft]);

  useEffect(() => {
    if (!open || !isPreviewMode) return;
    setShowMarkdownEditor(true);
  }, [isPreviewMode, open]);

  const buildGenerationConfig = useCallback((): SlideGenerationConfig => {
    const frontmatter = configFrontmatter.trim();
    const apiPreference = toApiGenerationPreference(configPreference);
    return {
      preference: apiPreference,
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
    configPreference,
    configQuantity,
    configStructure,
    configThemePreset,
    configTone,
  ]);

  const buildGenerationConfigPayload = useCallback(() => {
    const config = buildGenerationConfig();
    const apiPreference = config.preference;
    return {
      ...(apiPreference ? { preference: apiPreference } : {}),
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
      setError(t('studio.slides.connection_required'));
      return null;
    }
    setError('');
    const resolvedSourceIds = await resolveSourceIds();
    if (resolvedSourceIds.length === 0) {
      setError(t('studio.slides.require_sources'));
      return null;
    }
    const payload = {
      title: title.trim() || undefined,
      prompt: prompt.trim() || undefined,
      source_ids: resolvedSourceIds,
      generation_config: buildGenerationConfigPayload(),
    };
    if (!draft) {
      const { data: created, error: createErr } = await api.v2.studio.slides.post({
        notebook_id: notebookId,
        ...payload,
      });
      if (createErr) throw createErr;
      const normalized = normalizeDraft(created);
      syncFromDraft(normalized);
      return normalized;
    }
    const { data: updated, error: updateErr } = await api.v2.studio
      .slides({ id: draft.id })
      .patch(payload);
    if (updateErr) throw updateErr;
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
      toast.error(t('studio.slides.connection_required'));
      return;
    }
    if (!notebookId) {
      toast.error(t('studio.slides.require_notebook'));
      return;
    }
    setError('');
    setIsQueueing(true);
    try {
      const resolvedSourceIds = await resolveSourceIds();
      if (resolvedSourceIds.length === 0) {
        setError(t('studio.slides.require_sources'));
        toast.error(t('studio.slides.require_sources'));
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
        toast.success(t('studio.slides.queue.added'));
        onClose();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('studio.slides.queue.failed_default');
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
      setError(t('studio.slides.connection_required'));
      return;
    }
    const outline: SlideOutline = {
      title: outlineTitle.trim() || title.trim() || '演示',
      slides: outlineItems.map((item) => ({
        title: item.title.trim() || '未命名幻灯片',
        bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      })),
    };
    const { data: updated, error: updateErr } = await api.v2.studio
      .slides({ id: draft.id })
      .outline.put({ outline });
    if (updateErr) throw updateErr;
    syncFromDraft(normalizeDraft(updated));
  }, [draft, isConnected, notebookId, outlineItems, outlineTitle, syncFromDraft, title]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const { data: updated, error: updateErr } = await api.v2.studio
      .slides({ id: draft.id })
      .markdown.put({ markdown });
    if (updateErr) throw updateErr;
    syncFromDraft(normalizeDraft(updated));
    onOutputsUpdated();
  }, [draft, isConnected, markdown, notebookId, onOutputsUpdated, syncFromDraft]);

  const runGenerateStage = useCallback(
    async (
      slideId: number,
      stage: 'outline' | 'markdown',
      handlers: { onDone?: () => Promise<void> | void; onError?: () => Promise<void> | void } = {},
    ) => {
      closeGenerate();
      setIsGenerating(true);
      setEvents([]);
      setDebugTimings(null);
      setError('');
      const ac = new AbortController();
      generateAbortRef.current = ac;

      try {
        setEvents((prev) => [...prev, { type: 'progress', message: '生成中...' }]);
        const slides = api.v2.studio.slides({ id: slideId });
        const { error: genErr } =
          stage === 'outline'
            ? await slides.outline.post(undefined, { fetch: { signal: ac.signal } })
            : await slides.markdown.post(undefined, { fetch: { signal: ac.signal } });
        if (genErr) throw genErr;
        setIsGenerating(false);
        generateAbortRef.current = null;
        if (handlers.onDone) await handlers.onDone();
      } catch (error) {
        setIsGenerating(false);
        generateAbortRef.current = null;
        if (error instanceof Error && error.name === 'AbortError') return;
        setError(error instanceof Error ? error.message : '生成失败，请稍后重试。');
        if (handlers.onError) await handlers.onError();
      }
    },
    [closeGenerate],
  );

  const handleGenerateOutline = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    await runGenerateStage(saved.id, 'outline', {
      onDone: async () => {
        await refreshDraft(saved.id);
        setActiveStage('outline');
      },
    });
  }, [isConnected, notebookId, refreshDraft, runGenerateStage, saveInputStage]);

  const handleGenerateMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    if (!draft.sourceIds || draft.sourceIds.length === 0) {
      setError(t('studio.slides.require_sources'));
      return;
    }
    await handleSaveOutline();
    await runGenerateStage(draft.id, 'markdown', {
      onDone: async () => {
        await refreshDraft(draft.id);
        setActiveStage('markdown');
        onOutputsUpdated();
      },
    });
  }, [
    draft,
    handleSaveOutline,
    isConnected,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    runGenerateStage,
  ]);

  const handleGenerateAll = useCallback(async () => {
    if (!notebookId) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const saved = await saveInputStage();
    if (!saved) return;
    await runGenerateStage(saved.id, 'outline', {
      onDone: async () => {
        await refreshDraft(saved.id);
        await runGenerateStage(saved.id, 'markdown', {
          onDone: async () => {
            await refreshDraft(saved.id);
            setActiveStage('markdown');
            onOutputsUpdated();
          },
        });
      },
    });
  }, [isConnected, notebookId, onOutputsUpdated, refreshDraft, runGenerateStage, saveInputStage]);

  const buildPreview = useCallback(
    async (force = false) => {
      if (!isConnected) {
        setPreviewError(t('studio.slides.connection_required'));
        return;
      }
      if (!slidesTool || !slidesConfig) {
        setPreviewError(slidesConfigErrorMessage || '演示能力当前不可用。');
        return;
      }
      if (!previewDescriptor) {
        setPreviewError('当前 slides 插件未声明预览入口。');
        return;
      }
      if (!previewSupported) {
        setPreviewError(`当前 slides 插件声明了暂不支持的预览服务：${previewProviderLabel}。`);
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
    },
    [
      handleSaveMarkdown,
      isConnected,
      markdown,
      previewDescriptor,
      previewProviderLabel,
      previewSupported,
      previewMarkdown,
      slidesConfig,
      slidesConfigErrorMessage,
      slidesTool,
    ],
  );

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
    if (!previewMarkdown || !previewSupported) return;
    const url = buildSlidesPreviewUrl(previewDescriptor, previewKey || Date.now());
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [previewDescriptor, previewKey, previewMarkdown, previewSupported]);

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
            cancelled: '已取消',
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
                <Typography
                  variant="small"
                  className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold"
                >
                  演示信息
                </Typography>
                <Typography
                  variant="h6"
                  className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate"
                >
                  {previewTitle}
                </Typography>
                <Typography
                  variant="small"
                  className="text-xs text-gray-600 dark:text-slate-300 font-medium"
                >
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
                <Typography
                  variant="small"
                  className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold"
                >
                  大纲速览
                </Typography>
                <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-slate-200">
                  {(() => {
                    const keyCounts = new Map<string, number>();
                    return outlinePreview.map((item, index) => {
                      const baseKey = JSON.stringify(item);
                      const ordinal = keyCounts.get(baseKey) ?? 0;
                      keyCounts.set(baseKey, ordinal + 1);
                      const outlinePreviewKey = `${baseKey}:${ordinal}`;
                      return (
                        <li key={outlinePreviewKey} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          <span className="truncate">{item.title || `幻灯片 ${index + 1}`}</span>
                        </li>
                      );
                    });
                  })()}
                </ul>
                {outlineItems.length > outlinePreview.length && (
                  <Typography
                    variant="small"
                    className="mt-2 text-[11px] text-gray-500 dark:text-slate-400"
                  >
                    还有 {outlineItems.length - outlinePreview.length} 张幻灯片
                  </Typography>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-300">
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                引擎：{slidesEngine || '未配置'}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                状态：{queueLabel || '就绪'}
              </div>
            </div>
          </div>
          {showMarkdownEditor && (
            <div className="space-y-2">
              <Textarea
                label="Slides Markdown"
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
              <Typography
                variant="small"
                className="text-gray-700 dark:text-slate-200 font-semibold"
              >
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
                生成倾向
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configPreference}
                  onChange={(event) => {
                    const next = event.target.value as GenerationPreferenceSetting;
                    setConfigPreference(next);
                    setGlobalPreference(next);
                  }}
                  name="slidePreference"
                >
                  <option value="default">默认</option>
                  <option value="quality">质量</option>
                  <option value="speed">速度</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 dark:text-slate-300 font-medium">
                幻灯片数量
                <select
                  className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-gray-700 dark:text-slate-200"
                  value={configQuantity}
                  onChange={(event) => setConfigQuantity(event.target.value)}
                  name="slideQuantity"
                >
                  {quantityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
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
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {showAdvanced && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Typography
                    variant="small"
                    className="text-gray-600 dark:text-slate-300 text-xs font-medium"
                  >
                    Frontmatter 覆盖（YAML，可选）
                  </Typography>
                  <Textarea
                    value={configFrontmatter}
                    onChange={(event) => setConfigFrontmatter(event.target.value)}
                    rows={5}
                    className="font-mono text-[11px]"
                    placeholder={
                      'theme: default\ncolorSchema: light\nfonts:\n  sans: "Manrope"\ntransition: fade'
                    }
                  />
                  <Typography
                    variant="small"
                    className="text-gray-500 dark:text-slate-400 text-[11px]"
                  >
                    留空将使用主题预设自动生成；如需覆盖请填写 YAML（不需要 --- 包裹）。
                  </Typography>
                </div>
                <div className="space-y-1">
                  <Typography
                    variant="small"
                    className="text-gray-600 dark:text-slate-300 text-xs font-medium"
                  >
                    Frontmatter 预览
                  </Typography>
                  <pre className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[11px] text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                    {frontmatterPreview}
                  </pre>
                </div>
                {isConnected && (
                  <div className="space-y-1">
                    <Typography
                      variant="small"
                      className="text-gray-600 dark:text-slate-300 text-xs font-medium"
                    >
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
              (() => {
                const outlineKeyCounts = new Map<string, number>();
                return outlineItems.map((item, index) => {
                  const baseKey = JSON.stringify(item);
                  const ordinal = outlineKeyCounts.get(baseKey) ?? 0;
                  outlineKeyCounts.set(baseKey, ordinal + 1);
                  const outlineItemKey = `${baseKey}:${ordinal}`;
                  return (
                    <div
                      key={outlineItemKey}
                      className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2"
                    >
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
                  );
                });
              })()
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
          label="Slides Markdown"
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
          <Button
            variant="outlined"
            onClick={handleSaveMarkdown}
            disabled={isGenerating || !draft || !isConnected}
          >
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

  const canBuildPreview = Boolean(draft?.id && markdown.trim());
  const showPreviewPanel = !isConfigOnly;
  const gridLayoutClass = showPreviewPanel
    ? isPreviewMode || activeStage === 'markdown'
      ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
      : 'lg:grid-cols-[minmax(0,1fr)_360px]'
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
      return { tone: 'gray', message: t('studio.slides.queue.pending') };
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
    !isConnected || slidesConfigLoading || Boolean(slidesConfigErrorMessage) || !hasSelectedSources;

  const quantityOptions = slidesConfig?.quantity_options ?? [];
  const structureOptions = slidesConfig?.structure_options ?? [];
  const audienceOptions = slidesConfig?.audience_options ?? [];
  const toneOptions = slidesConfig?.tone_options ?? [];
  const languageOptions = slidesConfig?.language_options ?? [];
  const densityOptions = slidesConfig?.density_options ?? [];
  const themePresetOptions = slidesConfig?.theme_preset_options ?? [];

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
              <Typography
                variant="h6"
                className="text-[15px] font-semibold text-gray-900 dark:text-slate-100 truncate"
              >
                演示生成
              </Typography>
              <Typography
                variant="small"
                className="text-gray-500 dark:text-slate-400 text-xs font-medium"
              >
                {headerSubtitle}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Chip value={slidesEngine || '未配置'} size="sm" variant="ghost" />
            <IconButton
              variant="text"
              size="sm"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="rounded-full"
              aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
            >
              {isFullscreen ? (
                <CloseFullscreenIcon className="h-4 w-4" />
              ) : (
                <OpenInFullIcon className="h-4 w-4" />
              )}
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
              <div
                className={`flex flex-col gap-3 min-h-0 ${isPreviewMode ? 'order-2 lg:order-1' : ''}`}
              >
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
                    {(() => {
                      const keyCounts = new Map<string, number>();
                      return events.map((event) => {
                        const baseKey = `${event.type}:${event.message}`;
                        const ordinal = keyCounts.get(baseKey) ?? 0;
                        keyCounts.set(baseKey, ordinal + 1);
                        const eventKey = `${baseKey}:${ordinal}`;
                        return (
                          <div
                            key={eventKey}
                            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 flex items-start gap-2"
                          >
                            <span
                              className={`mt-1 h-1.5 w-1.5 rounded-full ${
                                event.type === 'toolcall' ? 'bg-purple-500' : 'bg-blue-500'
                              }`}
                            />
                            <span className="flex-1">{event.message}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                {import.meta.env.DEV && debugTimings && !isConfigOnly && !isPreviewMode && (
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 space-y-2">
                    <Typography
                      variant="small"
                      className="text-gray-500 dark:text-slate-400 text-xs"
                    >
                      timings_ms
                    </Typography>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(debugTimings)
                        .toSorted(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <Chip
                            key={key}
                            value={`${key}: ${value}ms`}
                            size="sm"
                            variant="ghost"
                            color="gray"
                          />
                        ))}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex-1 min-h-0 overflow-auto">
                  {stageContent()}
                </div>
              </div>
              {showPreviewPanel && (
                <div
                  className={`rounded-xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-white via-white to-slate-50 p-3 flex flex-col min-h-0 shadow-sm ${isPreviewMode ? 'order-1 lg:order-2' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <Typography
                        variant="small"
                        className="text-gray-700 dark:text-slate-200 font-semibold"
                      >
                        幻灯片预览
                      </Typography>
                      <Chip
                        value={previewStatus}
                        size="sm"
                        variant="ghost"
                        color={previewStatusTone}
                      />
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
                      disabled={
                        !canBuildPreview || isGenerating || isPreviewSyncing || !isConnected
                      }
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
                    <Typography
                      variant="small"
                      className="text-xs text-gray-500 dark:text-slate-400 mt-2"
                    >
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
                    {previewReady && previewSupported ? (
                      <div className="h-full w-auto max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-800 relative">
                        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-800 z-0">
                          <Spinner className="h-5 w-5 text-gray-400" />
                        </div>
                        <iframe
                          key={previewKey}
                          title={`${previewProviderLabel} 预览`}
                          src={previewUrl}
                          sandbox="allow-scripts"
                          className="h-full w-full border-0 bg-white dark:bg-slate-800 relative z-10"
                          loading="lazy"
                        />
                      </div>
                    ) : isPreviewSyncing ||
                      isGenerating ||
                      queueStatus === 'running' ||
                      draft?.status === 'running' ? (
                      <div className="w-full max-w-full aspect-video rounded-lg border border-dashed border-slate-300 bg-white dark:bg-slate-900/70 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                        <Spinner className="h-4 w-4" />
                        <span>预览同步中...</span>
                      </div>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400 px-6 text-center">
                        <span>暂无预览，请先生成 Markdown 或点击“同步预览”。</span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          {previewDescriptor
                            ? `预览基于 ${previewProviderLabel} 服务。`
                            : '当前 slides 插件未声明预览入口。'}
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
