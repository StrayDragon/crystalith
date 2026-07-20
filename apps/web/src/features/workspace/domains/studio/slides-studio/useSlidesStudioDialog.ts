import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../../../../api/eden';
import { edenFetchOptions } from '../../../../../api/edenFetchOptions';
import { t } from '../../../../../shared/i18n';
import { toast } from '../../../../../shared/toast';
import {
  toApiGenerationPreference,
  useGenerationPreference,
} from '../../../shared/hooks/useGenerationPreference';
import type {
  GenerationPreferenceSetting,
  SlideDraft,
  SlideGenerationConfig,
  SlideOutline,
  SlideOutlineItem,
  SlideStage,
} from '../../../shared/types';
import { buildFrontmatterPreview } from '../utils/slides';
import {
  buildSlidesPreviewUrl,
  normalizeDraft,
  outlineItemsFromDraft,
  outlineTitleFromDraft,
  resolveErrorStatus,
  resolveOptionId,
  resolvePreviewProviderLabel,
  resolveSlidesRecoveryHint,
  resolveStatusMessage,
} from './slidesStudioUtils';
import type {
  SlidesInputStageProps,
  SlidesMarkdownStageProps,
  SlidesOutlineStageProps,
  SlidesPreviewModeContentProps,
  SlidesStageContentProps,
  SlidesStudioDialogProps,
} from './types';

export function useSlidesStudioDialog({
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
  const previewStatusTone: 'blue' | 'green' | 'gray' = isPreviewSyncing
    ? 'blue'
    : previewReady
      ? 'green'
      : 'gray';

  const closeGenerate = useCallback(() => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
      generateAbortRef.current = null;
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
      const quantityOptions = slidesConfig?.quantityOptions ?? [];
      const audienceOptions = slidesConfig?.audienceOptions ?? [];
      const structureOptions = slidesConfig?.structureOptions ?? [];
      const toneOptions = slidesConfig?.toneOptions ?? [];
      const languageOptions = slidesConfig?.languageOptions ?? [];
      const densityOptions = slidesConfig?.densityOptions ?? [];
      const themeOptions = slidesConfig?.themePresetOptions ?? [];
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
        const { data, error: fetchErr } = await api.v2
          .notebooks({ nid: notebookId })
          .studio.slides({ id: draftId })
          .get();
        if (fetchErr)
          throw new Error(
            typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
          );
        syncFromDraft(normalizeDraft(data));
      } else {
        const { data, error: fetchErr } = await api.v2
          .notebooks({ nid: notebookId })
          .studio.slides.get({
            query: { offset: 0, limit: 200 },
          });
        if (fetchErr)
          throw new Error(
            typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
          );
        const list = data?.items ?? [];
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
      const { data, error: fetchErr } = await api.v2
        .notebooks({ nid: notebookId })
        .studio.slides({ id: targetId })
        .get();
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
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
        prev || resolveOptionId(configDefaults?.quantity ?? null, slidesConfig.quantityOptions),
    );
    setConfigAudience(
      (prev) =>
        prev || resolveOptionId(configDefaults?.audience ?? null, slidesConfig.audienceOptions),
    );
    setConfigStructure(
      (prev) =>
        prev || resolveOptionId(configDefaults?.structure ?? null, slidesConfig.structureOptions),
    );
    setConfigTone(
      (prev) => prev || resolveOptionId(configDefaults?.tone ?? null, slidesConfig.toneOptions),
    );
    setConfigLanguage(
      (prev) =>
        prev || resolveOptionId(configDefaults?.language ?? null, slidesConfig.languageOptions),
    );
    setConfigDensity(
      (prev) =>
        prev || resolveOptionId(configDefaults?.density ?? null, slidesConfig.densityOptions),
    );
    setConfigThemePreset(
      (prev) =>
        prev ||
        resolveOptionId(configDefaults?.themePreset ?? null, slidesConfig.themePresetOptions),
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
      themePreset: config.themePreset,
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
      sourceIds: resolvedSourceIds,
      generationConfig: buildGenerationConfigPayload(),
    };
    if (!draft) {
      const { data: created, error: createErr } = await api.v2
        .notebooks({ nid: notebookId })
        .studio.slides.post(payload);
      if (createErr)
        throw new Error(
          typeof createErr === 'string'
            ? createErr
            : typeof createErr === 'string'
              ? createErr
              : '',
        );
      const normalized = normalizeDraft(created);
      syncFromDraft(normalized);
      return normalized;
    }
    const { data: updated, error: updateErr } = await api.v2
      .notebooks({ nid: notebookId })
      .studio.slides({ id: draft.id })
      .patch(payload);
    if (updateErr)
      throw new Error(
        typeof updateErr === 'string' ? updateErr : typeof updateErr === 'string' ? updateErr : '',
      );
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
    const { data: updated, error: updateErr } = await api.v2
      .notebooks({ nid: notebookId })
      .studio.slides({ id: draft.id })
      .outline.put({ outline });
    if (updateErr)
      throw new Error(
        typeof updateErr === 'string' ? updateErr : typeof updateErr === 'string' ? updateErr : '',
      );
    syncFromDraft(normalizeDraft(updated));
  }, [draft, isConnected, notebookId, outlineItems, outlineTitle, syncFromDraft, title]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    if (!isConnected) {
      setError(t('studio.slides.connection_required'));
      return;
    }
    const { data: updated, error: updateErr } = await api.v2
      .notebooks({ nid: notebookId })
      .studio.slides({ id: draft.id })
      .markdown.put({ markdown });
    if (updateErr)
      throw new Error(
        typeof updateErr === 'string' ? updateErr : typeof updateErr === 'string' ? updateErr : '',
      );
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
        if (!notebookId) return;
        const slides = api.v2.notebooks({ nid: notebookId }).studio.slides({ id: slideId });
        const fetchOpts = edenFetchOptions(ac.signal);
        const { error: genErr } =
          stage === 'outline'
            ? await slides.outline.post(undefined, fetchOpts)
            : await slides.markdown.post(undefined, fetchOpts);
        if (genErr)
          throw new Error(
            typeof genErr === 'string' ? genErr : typeof genErr === 'string' ? genErr : '',
          );
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
    [closeGenerate, notebookId],
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

  const handleAddSlide = useCallback(() => {
    setOutlineItems((prev) => [...prev, { title: '', bullets: [] }]);
  }, []);

  const handleUpdateSlideTitle = useCallback((index: number, value: string) => {
    setOutlineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, title: value } : item)),
    );
  }, []);

  const handleUpdateSlideBullets = useCallback((index: number, value: string) => {
    const bullets = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setOutlineItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, bullets } : item)),
    );
  }, []);

  const handleRemoveSlide = useCallback((index: number) => {
    setOutlineItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const quantityOptions = slidesConfig?.quantityOptions ?? [];
  const structureOptions = slidesConfig?.structureOptions ?? [];
  const audienceOptions = slidesConfig?.audienceOptions ?? [];
  const toneOptions = slidesConfig?.toneOptions ?? [];
  const languageOptions = slidesConfig?.languageOptions ?? [];
  const densityOptions = slidesConfig?.densityOptions ?? [];
  const themePresetOptions = slidesConfig?.themePresetOptions ?? [];

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
  const statusMessage = resolveStatusMessage({
    isGenerating,
    queueStatus,
    draftStatus: draft?.status,
  });
  const configActionsDisabled =
    !isConnected || slidesConfigLoading || Boolean(slidesConfigErrorMessage) || !hasSelectedSources;

  const inputStageProps: SlidesInputStageProps = {
    title,
    onTitleChange: setTitle,
    prompt,
    onPromptChange: setPrompt,
    configPreference,
    onConfigPreferenceChange: (next) => {
      setConfigPreference(next);
      setGlobalPreference(next);
    },
    configQuantity,
    onConfigQuantityChange: setConfigQuantity,
    configStructure,
    onConfigStructureChange: setConfigStructure,
    configAudience,
    onConfigAudienceChange: setConfigAudience,
    configTone,
    onConfigToneChange: setConfigTone,
    configLanguage,
    onConfigLanguageChange: setConfigLanguage,
    configDensity,
    onConfigDensityChange: setConfigDensity,
    configThemePreset,
    onConfigThemePresetChange: setConfigThemePreset,
    showAdvanced,
    onToggleAdvanced: () => setShowAdvanced((prev) => !prev),
    configFrontmatter,
    onConfigFrontmatterChange: setConfigFrontmatter,
    frontmatterPreview,
    configModelId,
    onConfigModelIdChange: setConfigModelId,
    isConnected,
    selectionLabel,
    quantityOptions,
    structureOptions,
    audienceOptions,
    toneOptions,
    languageOptions,
    densityOptions,
    themePresetOptions,
  };

  const outlineStageProps: SlidesOutlineStageProps = {
    outlineTitle,
    onOutlineTitleChange: setOutlineTitle,
    outlineItems,
    onAddSlide: handleAddSlide,
    onUpdateSlideTitle: handleUpdateSlideTitle,
    onUpdateSlideBullets: handleUpdateSlideBullets,
    onRemoveSlide: handleRemoveSlide,
    selectionLabel,
  };

  const markdownStageProps: SlidesMarkdownStageProps = {
    markdown,
    onMarkdownChange: setMarkdown,
    selectionLabel,
  };

  const previewModeProps: SlidesPreviewModeContentProps = {
    title,
    outlineTitle,
    draft,
    outlineItems,
    slidesEngine,
    queueStatus,
    showMarkdownEditor,
    onToggleMarkdownEditor: () => setShowMarkdownEditor((prev) => !prev),
    markdown,
    onMarkdownChange: setMarkdown,
    selectionLabel,
  };

  const stageContentProps: SlidesStageContentProps = {
    loading,
    slidesConfigErrorMessage,
    slidesConfigLoading,
    slidesConfig,
    notebookId,
    isConfigOnly,
    isPreviewMode,
    activeStage,
    selectionLabel,
    quantityOptions,
    structureOptions,
    audienceOptions,
    toneOptions,
    languageOptions,
    densityOptions,
    themePresetOptions,
    inputStageProps,
    outlineStageProps,
    markdownStageProps,
    previewModeProps,
  };

  return {
    dialogRef,
    onClose,
    isFullscreen,
    setIsFullscreen,
    isConfigOnly,
    isPreviewMode,
    slidesEngine,
    headerSubtitle,
    draft,
    activeStage,
    setActiveStage,
    isGenerating,
    error,
    statusMessage,
    events,
    debugTimings,
    gridLayoutClass,
    showPreviewPanel,
    stageContentProps,
    canBuildPreview,
    previewStatus,
    previewStatusTone,
    previewReady,
    previewStale,
    previewError,
    previewSupported,
    previewProviderLabel,
    previewDescriptor,
    previewUrl,
    previewKey,
    isPreviewSyncing,
    isConnected,
    queueStatus,
    handleOpenPreviewWindow,
    handlePreview,
    handleRefreshPreview,
    notebookId,
    loading,
    isQueueing,
    configActionsDisabled,
    onQueueSlidesAvailable: Boolean(onQueueSlides),
    handleQueueSlides,
    handleSaveMarkdown: () => {
      void handleSaveMarkdown();
    },
    saveInputStage: () => {
      void saveInputStage();
    },
    handleGenerateOutline: () => {
      void handleGenerateOutline();
    },
    handleGenerateAll: () => {
      void handleGenerateAll();
    },
    handleSaveOutline: () => {
      void handleSaveOutline();
    },
    handleGenerateMarkdown: () => {
      void handleGenerateMarkdown();
    },
  };
}
