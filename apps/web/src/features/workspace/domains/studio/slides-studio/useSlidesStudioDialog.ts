import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../../../../api/eden';
import { t } from '../../../../../shared/i18n';
import { toast } from '../../../../../shared/toast';
import { useGenerationPreference } from '../../../shared/hooks/useGenerationPreference';
import type { SlideDraft, SlideOutline, SlideOutlineItem, SlideStage } from '../../../shared/types';
import {
  normalizeDraft,
  outlineItemsFromDraft,
  outlineTitleFromDraft,
  resolveErrorStatus,
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
import { useSlidesConfigForm } from './useSlidesConfigForm';
import { useSlidesPreviewSync } from './useSlidesPreviewSync';
import { useSlidesStageGeneration } from './useSlidesStageGeneration';

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
  const [isQueueing, setIsQueueing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [outlineTitle, setOutlineTitle] = useState('');
  const [outlineItems, setOutlineItems] = useState<SlideOutlineItem[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false);

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

  const {
    configPreference,
    setConfigPreference,
    configQuantity,
    setConfigQuantity,
    configAudience,
    setConfigAudience,
    configStructure,
    setConfigStructure,
    configTone,
    setConfigTone,
    configLanguage,
    setConfigLanguage,
    configDensity,
    setConfigDensity,
    configThemePreset,
    setConfigThemePreset,
    configFrontmatter,
    setConfigFrontmatter,
    showAdvanced,
    setShowAdvanced,
    configModelId,
    setConfigModelId,
    frontmatterPreview,
    applyGenerationConfig,
    resetConfigFields,
    buildGenerationConfig,
    buildGenerationConfigPayload,
    quantityOptions,
    structureOptions,
    audienceOptions,
    toneOptions,
    languageOptions,
    densityOptions,
    themePresetOptions,
  } = useSlidesConfigForm({
    slidesConfig,
    globalPreference,
    open,
    title,
  });

  const selectionLabel = useMemo(() => {
    const draftSourceIds = isPreviewMode ? (draft?.sourceIds ?? []) : [];
    const activeSourceIds = draftSourceIds.length ? draftSourceIds : selectedSourceIds;
    if (activeSourceIds.length) {
      return `已选择 ${activeSourceIds.length} 个来源，将仅基于选中来源生成。`;
    }
    return '未选择来源，无法生成演示。';
  }, [draft?.sourceIds, isPreviewMode, selectedSourceIds]);

  const slidesEngine = draft?.engine || slidesConfig?.engine || null;
  const hasSelectedSources = useMemo(() => {
    const draftSourceIds = draft?.sourceIds ?? [];
    return draftSourceIds.length > 0 || selectedSourceIds.length > 0;
  }, [draft?.sourceIds, selectedSourceIds]);

  const resolveSourceIds = useCallback(async () => selectedSourceIds, [selectedSourceIds]);

  // Preview + generation hooks need save/outline callbacks defined later; bridge via refs.
  const handleSaveMarkdownRef = useRef<() => Promise<void>>(async () => {});
  const saveInputStageRef = useRef<() => Promise<SlideDraft | null>>(async () => null);
  const handleSaveOutlineRef = useRef<() => Promise<void>>(async () => {});
  const refreshDraftRef = useRef<(slideId?: number) => Promise<void>>(async () => {});

  const bridgedSaveMarkdown = useCallback(() => handleSaveMarkdownRef.current(), []);
  const bridgedSaveInputStage = useCallback(() => saveInputStageRef.current(), []);
  const bridgedSaveOutline = useCallback(() => handleSaveOutlineRef.current(), []);
  const bridgedRefreshDraft = useCallback(
    (slideId?: number) => refreshDraftRef.current(slideId),
    [],
  );

  const previewSync = useSlidesPreviewSync({
    open,
    isPreviewMode,
    isConnected,
    draftId: draft?.id,
    markdown,
    slidesTool,
    slidesConfig,
    slidesConfigErrorMessage,
    slidesEngine,
    handleSaveMarkdown: bridgedSaveMarkdown,
  });

  const stageGeneration = useSlidesStageGeneration({
    notebookId,
    isConnected,
    draft,
    saveInputStage: bridgedSaveInputStage,
    refreshDraft: bridgedRefreshDraft,
    handleSaveOutline: bridgedSaveOutline,
    onOutputsUpdated,
    setActiveStage,
    setError,
  });

  const {
    resetPreviewState,
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
    handleOpenPreviewWindow,
    handlePreview,
    handleRefreshPreview,
  } = previewSync;

  const {
    isGenerating,
    setIsGenerating,
    events,
    debugTimings,
    closeGenerate,
    resetGenerationState,
    handleGenerateOutline,
    handleGenerateMarkdown,
    handleGenerateAll,
  } = stageGeneration;

  const resetDraftState = useCallback(() => {
    setDraft(null);
    setActiveStage('input');
    setLoading(false);
    setIsGenerating(false);
    resetConfigFields();
    setTitle('');
    setPrompt('');
    setOutlineTitle('');
    setOutlineItems([]);
    setMarkdown('');
    resetGenerationState();
    setError('');
    resetPreviewState();
    setShowMarkdownEditor(false);
    setIsQueueing(false);
  }, [resetConfigFields, resetGenerationState, resetPreviewState, setIsGenerating]);

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
    } catch (error: unknown) {
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

  handleSaveMarkdownRef.current = handleSaveMarkdown;
  saveInputStageRef.current = saveInputStage;
  handleSaveOutlineRef.current = handleSaveOutline;
  refreshDraftRef.current = refreshDraft;

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
  }, [closeGenerate, loadDraft, open, setIsGenerating]);

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
