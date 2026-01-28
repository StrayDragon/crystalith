import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { SlideDraft, SlideGenerationConfig, SlideOutline, SlideOutlineItem, SlideStage } from '../types';
import {
  createSlidesDraft,
  getLatestSlidesDraft,
  getSlidesDraft,
  updateSlidesDraft,
  updateSlidesOutline,
  updateSlidesMarkdown,
} from '../api';
import { buildSlidevPreviewUrl } from '@crystalith-slidev';
import { toast } from '../../../shared/toast';

const STAGES: { id: SlideStage; label: string }[] = [
  { id: 'input', label: '输入' },
  { id: 'outline', label: '大纲' },
  { id: 'markdown', label: 'Markdown' },
];

const DEFAULT_CONFIG: Required<SlideGenerationConfig> = {
  quantity: 'standard',
  audience: 'general',
  structure: 'standard',
  tone: 'professional',
  language: 'zh',
  density: 'standard',
  themePreset: 'minimal-clean',
  frontmatter: '',
};

const QUANTITY_OPTIONS = [
  { id: 'short', label: '精简（6-8）' },
  { id: 'standard', label: '标准（8-12）' },
  { id: 'detailed', label: '详尽（12-18）' },
];

const AUDIENCE_OPTIONS = [
  { id: 'general', label: '通用受众' },
  { id: 'executive', label: '管理层' },
  { id: 'technical', label: '技术受众' },
  { id: 'external', label: '外部受众' },
];

const STRUCTURE_OPTIONS = [
  { id: 'standard', label: '通用结构' },
  { id: 'problem-solution', label: '问题/方案' },
  { id: 'story', label: '故事叙事' },
  { id: 'project-review', label: '项目复盘' },
  { id: 'training', label: '培训课程' },
];

const TONE_OPTIONS = [
  { id: 'professional', label: '正式专业' },
  { id: 'friendly', label: '亲和易读' },
  { id: 'inspiring', label: '鼓舞愿景' },
  { id: 'serious', label: '严谨客观' },
];

const LANGUAGE_OPTIONS = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: '英文' },
];

const DENSITY_OPTIONS = [
  { id: 'sparse', label: '稀疏（2-3 要点）' },
  { id: 'standard', label: '标准（3-5 要点）' },
  { id: 'dense', label: '密集（5-7 要点）' },
];

const THEME_PRESET_OPTIONS = [
  { id: 'minimal-clean', label: '清爽极简' },
  { id: 'business-brief', label: '商务汇报' },
  { id: 'product-launch', label: '产品发布' },
  { id: 'research-paper', label: '学术研究' },
  { id: 'data-insight', label: '数据洞察' },
  { id: 'creative-visual', label: '创意视觉' },
];

const THEME_PRESET_TEMPLATES: Record<string, Record<string, string | Record<string, string>>> = {
  'minimal-clean': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Manrope', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'fade',
    background: '#F8FAFC',
    class: 'text-left',
  },
  'business-brief': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'IBM Plex Sans', serif: 'Noto Serif SC', mono: 'JetBrains Mono' },
    transition: 'slide-left',
    background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
    class: 'text-left',
  },
  'product-launch': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Space Grotesk', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'fade-out',
    background: 'radial-gradient(circle at 20% 20%, #FDE68A 0%, #FFFFFF 45%, #EEF2FF 100%)',
    class: 'text-center',
  },
  'research-paper': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Source Sans 3', serif: 'Source Serif 4', mono: 'Source Code Pro' },
    transition: 'slide-up',
    background: '#FFFBF5',
    class: 'text-left',
  },
  'data-insight': {
    theme: 'default',
    colorSchema: 'light',
    fonts: { sans: 'Inter', serif: 'Noto Serif SC', mono: 'JetBrains Mono' },
    transition: 'slide-right',
    background: 'repeating-linear-gradient(0deg, #F8FAFC 0px, #F8FAFC 24px, #E5E7EB 25px)',
    class: 'text-left',
  },
  'creative-visual': {
    theme: 'default',
    colorSchema: 'dark',
    fonts: { sans: 'Bebas Neue', serif: 'Noto Serif SC', mono: 'Fira Code' },
    transition: 'zoom',
    background: 'linear-gradient(135deg, #0F172A 0%, #111827 50%, #1F2937 100%)',
    class: 'text-white text-left',
  },
};

const DEMO_DRAFT: SlideDraft = {
  id: 0,
  notebookId: 0,
  outputId: null,
  title: '演示主题',
  prompt: '请生成演示大纲与 Slidev Markdown。',
  engine: 'slidev',
  chunkIds: [],
  outline: {
    title: '演示主题',
    slides: [
      { title: '概览', bullets: ['要点 1', '要点 2'] },
      { title: '重点', bullets: ['发现 A', '发现 B'] },
    ],
  },
  markdown: '---\ntitle: 演示主题\n---\n\n# 演示主题\n\n---\n## 概览\n- 要点 1\n- 要点 2\n',
  generationConfig: {
    quantity: 'standard',
    audience: 'general',
    structure: 'standard',
    tone: 'professional',
    language: 'zh',
    density: 'standard',
    themePreset: 'minimal-clean',
    frontmatter: '',
  },
  stage: 'markdown',
  status: 'idle',
  errorMessage: null,
  createdAt: '',
  updatedAt: '',
};

function normalizeDraft(raw: any): SlideDraft {
  return {
    id: Number(raw.id),
    notebookId: Number(raw.notebook_id ?? raw.notebookId ?? 0),
    outputId: raw.output_id ?? raw.outputId ?? null,
    title: raw.title ?? null,
    prompt: raw.prompt ?? null,
    engine: raw.engine ?? 'slidev',
    chunkIds: raw.chunk_ids ?? raw.chunkIds ?? null,
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

function normalizeGenerationConfig(raw: any): SlideGenerationConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, any>;
  return {
    quantity: config.quantity ?? null,
    audience: config.audience ?? null,
    structure: config.structure ?? null,
    tone: config.tone ?? null,
    language: config.language ?? null,
    density: config.density ?? null,
    themePreset: config.themePreset ?? config.theme_preset ?? null,
    frontmatter: config.frontmatter ?? null,
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

function normalizeFrontmatterOverride(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('---')) return trimmed;
  const lines = trimmed.split('\n');
  const stripped = lines[0].trim() === '---' ? lines.slice(1) : lines;
  const endIndex = stripped.findIndex((line, index) => index > 0 && line.trim() === '---');
  const body = endIndex >= 0 ? stripped.slice(0, endIndex) : stripped;
  return body.join('\n').trim();
}

function yamlValue(value: string): string {
  return JSON.stringify(value);
}

function buildFrontmatterPreview(
  title: string,
  themePreset: string,
  override: string,
): string {
  const normalizedOverride = normalizeFrontmatterOverride(override);
  if (normalizedOverride) {
    if (normalizedOverride.includes('title:')) {
      return normalizedOverride;
    }
    return `title: ${yamlValue(title)}\n${normalizedOverride}`.trim();
  }
  const template = THEME_PRESET_TEMPLATES[themePreset] ?? THEME_PRESET_TEMPLATES['minimal-clean'];
  const lines: string[] = [`title: ${yamlValue(title)}`];
  Object.entries(template).forEach(([key, value]) => {
    if (key === 'fonts' && typeof value === 'object' && value) {
      lines.push('fonts:');
      Object.entries(value as Record<string, string>).forEach(([fontKey, fontValue]) => {
        lines.push(`  ${fontKey}: ${yamlValue(fontValue)}`);
      });
      return;
    }
    lines.push(`${key}: ${yamlValue(String(value))}`);
  });
  return lines.join('\n');
}

interface SlidesStudioDialogProps {
  open: boolean;
  onClose: () => void;
  notebookId: number | null;
  selectedChunkIds: number[];
  isDemo: boolean;
  onOutputsUpdated: () => void;
  openMode?: 'config' | 'preview';
  draftId?: number | null;
  queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
  onQueueSlides?: (payload: {
    title: string;
    prompt: string;
    chunkIds: number[];
    generationConfig: SlideGenerationConfig;
    modelId?: string | null;
  }) => Promise<{ draftId?: number | null } | null>;
}

export default function SlidesStudioDialog({
  open,
  onClose,
  notebookId,
  selectedChunkIds,
  isDemo,
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
  const [configQuantity, setConfigQuantity] = useState(DEFAULT_CONFIG.quantity);
  const [configAudience, setConfigAudience] = useState(DEFAULT_CONFIG.audience);
  const [configStructure, setConfigStructure] = useState(DEFAULT_CONFIG.structure);
  const [configTone, setConfigTone] = useState(DEFAULT_CONFIG.tone);
  const [configLanguage, setConfigLanguage] = useState(DEFAULT_CONFIG.language);
  const [configDensity, setConfigDensity] = useState(DEFAULT_CONFIG.density);
  const [configThemePreset, setConfigThemePreset] = useState(DEFAULT_CONFIG.themePreset);
  const [configFrontmatter, setConfigFrontmatter] = useState(DEFAULT_CONFIG.frontmatter);
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
  const isConfigOnly = openMode === 'config';
  const isPreviewMode = openMode === 'preview';

  const selectionLabel = useMemo(() => {
    const chunkIds = isPreviewMode && draft?.chunkIds?.length ? draft.chunkIds : selectedChunkIds;
    if (!chunkIds.length) return '将基于当前笔记本自动检索。';
    return `已选择 ${chunkIds.length} 条引用，将仅基于选中引用生成。`;
  }, [draft?.chunkIds, isPreviewMode, selectedChunkIds]);

  const frontmatterPreview = useMemo(
    () => buildFrontmatterPreview(title.trim() || '演示', configThemePreset, configFrontmatter),
    [configFrontmatter, configThemePreset, title],
  );

  const previewStale = useMemo(
    () => Boolean(previewMarkdown && previewMarkdown !== markdown),
    [previewMarkdown, markdown],
  );
  const previewReady = Boolean(previewMarkdown);
  const previewUrl = useMemo(() => buildSlidevPreviewUrl(previewKey), [previewKey]);
  const previewStatus = isPreviewSyncing ? '同步中' : previewReady ? '已同步' : '未同步';
  const previewStatusTone = isPreviewSyncing ? 'blue' : previewReady ? 'green' : 'gray';

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const resetDraftState = useCallback(() => {
    setDraft(null);
    setActiveStage('input');
    setLoading(false);
    setIsGenerating(false);
    setConfigQuantity(DEFAULT_CONFIG.quantity);
    setConfigAudience(DEFAULT_CONFIG.audience);
    setConfigStructure(DEFAULT_CONFIG.structure);
    setConfigTone(DEFAULT_CONFIG.tone);
    setConfigLanguage(DEFAULT_CONFIG.language);
    setConfigDensity(DEFAULT_CONFIG.density);
    setConfigThemePreset(DEFAULT_CONFIG.themePreset);
    setConfigFrontmatter(DEFAULT_CONFIG.frontmatter);
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
  }, []);

  const applyGenerationConfig = useCallback((config: SlideGenerationConfig | null | undefined) => {
    setConfigQuantity(config?.quantity ?? DEFAULT_CONFIG.quantity);
    setConfigAudience(config?.audience ?? DEFAULT_CONFIG.audience);
    setConfigStructure(config?.structure ?? DEFAULT_CONFIG.structure);
    setConfigTone(config?.tone ?? DEFAULT_CONFIG.tone);
    setConfigLanguage(config?.language ?? DEFAULT_CONFIG.language);
    setConfigDensity(config?.density ?? DEFAULT_CONFIG.density);
    setConfigThemePreset(config?.themePreset ?? DEFAULT_CONFIG.themePreset);
    setConfigFrontmatter(config?.frontmatter ?? DEFAULT_CONFIG.frontmatter);
  }, []);

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
    if (!notebookId || isDemo) {
      syncFromDraft(isDemo ? DEMO_DRAFT : null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const latest = draftId
        ? await getSlidesDraft(notebookId, draftId)
        : await getLatestSlidesDraft(notebookId);
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
  }, [draftId, isConfigOnly, isDemo, notebookId, open, resetDraftState, syncFromDraft]);

  const refreshDraft = useCallback(async (slideId?: number) => {
    if (!notebookId) return;
    const targetId = slideId ?? draft?.id;
    if (!targetId) return;
    const latest = await getSlidesDraft(notebookId, targetId);
    syncFromDraft(normalizeDraft(latest));
  }, [draft?.id, notebookId, syncFromDraft]);

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
    if (!open || !isPreviewMode || !draft?.id || isDemo) return;
    if (queueStatus !== 'running') return;
    const timer = window.setInterval(() => {
      void refreshDraft(draft.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [draft?.id, isDemo, isPreviewMode, open, queueStatus, refreshDraft]);

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
    setError('');
    const payload = {
      title: title.trim() || undefined,
      prompt: prompt.trim() || undefined,
      chunk_ids: selectedChunkIds,
      generation_config: buildGenerationConfigPayload(),
    };
    if (!draft) {
      const created = await createSlidesDraft(notebookId, payload);
      const normalized = normalizeDraft(created);
      syncFromDraft(normalized);
      return normalized;
    }
    const updated = await updateSlidesDraft(notebookId, draft.id, payload);
    const normalized = normalizeDraft(updated);
    syncFromDraft(normalized);
    return normalized;
  }, [
    buildGenerationConfigPayload,
    draft,
    notebookId,
    prompt,
    selectedChunkIds,
    syncFromDraft,
    title,
  ]);

  const handleQueueSlides = useCallback(async () => {
    if (!onQueueSlides) return;
    if (isQueueing) return;
    if (!notebookId && !isDemo) {
      toast.error('请先创建笔记本。');
      return;
    }
    setError('');
    setIsQueueing(true);
    try {
      const job = await onQueueSlides({
        title: title.trim(),
        prompt: prompt.trim(),
        chunkIds: selectedChunkIds,
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
    isDemo,
    isQueueing,
    notebookId,
    onClose,
    onQueueSlides,
    prompt,
    selectedChunkIds,
    title,
  ]);

  const handleSaveOutline = useCallback(async () => {
    if (!notebookId || !draft) return;
    const outline: SlideOutline = {
      title: outlineTitle.trim() || title.trim() || '演示',
      slides: outlineItems.map((item) => ({
        title: item.title.trim() || '未命名幻灯片',
        bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      })),
    };
    const updated = await updateSlidesOutline(notebookId, draft.id, { outline });
    syncFromDraft(normalizeDraft(updated));
  }, [draft, notebookId, outlineItems, outlineTitle, syncFromDraft, title]);

  const handleSaveMarkdown = useCallback(async () => {
    if (!notebookId || !draft) return;
    const updated = await updateSlidesMarkdown(notebookId, draft.id, {
      markdown: markdown,
    });
    syncFromDraft(normalizeDraft(updated));
    onOutputsUpdated();
  }, [draft, markdown, notebookId, onOutputsUpdated, syncFromDraft]);

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
        setEvents((prev) => [...prev, { type: 'progress', message: data.message || '生成中...' }]);
      });

      eventSource.addEventListener('toolcall', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setEvents((prev) => [...prev, { type: 'toolcall', message: data.name || '调用生成工具' }]);
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
    if (!notebookId || isDemo) return;
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
  }, [buildOutlineStreamUrl, isDemo, notebookId, refreshDraft, saveInputStage, startEventSource]);

  const handleGenerateMarkdown = useCallback(async () => {
    if (!notebookId || !draft || isDemo) return;
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
    isDemo,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    startEventSource,
  ]);

  const handleGenerateAll = useCallback(async () => {
    if (!notebookId || isDemo) return;
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
    isDemo,
    notebookId,
    onOutputsUpdated,
    refreshDraft,
    saveInputStage,
    startEventSource,
  ]);

  const buildPreview = useCallback(async (force = false) => {
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
  }, [draft?.markdown, handleSaveMarkdown, markdown, previewMarkdown]);

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

    if (!notebookId && !isDemo) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <Typography variant="small" className="text-gray-600">
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
                <Typography variant="h6" className="text-base font-semibold text-gray-900 truncate">
                  {previewTitle}
                </Typography>
                <Typography variant="small" className="text-xs text-gray-600 font-medium">
                  {slideCount ? `${slideCount} 张幻灯片` : '尚未生成大纲'}
                </Typography>
              </div>
              <Button
                variant="text"
                size="sm"
                onClick={() => setShowMarkdownEditor((prev) => !prev)}
                className="px-2 py-1 text-xs text-gray-600"
              >
                {showMarkdownEditor ? '隐藏 Markdown' : '查看 Markdown'}
              </Button>
            </div>
            {outlinePreview.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <Typography variant="small" className="text-[11px] text-gray-500 font-semibold">
                  大纲速览
                </Typography>
                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                  {outlinePreview.map((item, index) => (
                    <li key={`preview-${index}`} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      <span className="truncate">{item.title || `幻灯片 ${index + 1}`}</span>
                    </li>
                  ))}
                </ul>
                {outlineItems.length > outlinePreview.length && (
                  <Typography variant="small" className="mt-2 text-[11px] text-gray-500">
                    还有 {outlineItems.length - outlinePreview.length} 张幻灯片
                  </Typography>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
                引擎：{draft?.engine || 'slidev'}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
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
              <Typography variant="small" className="text-gray-600">
                {selectionLabel}
              </Typography>
            </div>
          )}
          {!showMarkdownEditor && (
            <Typography variant="small" className="text-gray-600">
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
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Typography variant="small" className="text-gray-700 font-semibold">
                生成设置
              </Typography>
              <Button
                variant="text"
                size="sm"
                className="px-2 py-1 text-xs text-gray-600"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? '收起高级设置' : '高级设置'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                幻灯片数量
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configQuantity}
                  onChange={(event) => setConfigQuantity(event.target.value)}
                >
                  {QUANTITY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                结构模板
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configStructure}
                  onChange={(event) => setConfigStructure(event.target.value)}
                >
                  {STRUCTURE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                受众定位
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configAudience}
                  onChange={(event) => setConfigAudience(event.target.value)}
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                语气风格
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configTone}
                  onChange={(event) => setConfigTone(event.target.value)}
                >
                  {TONE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                输出语言
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configLanguage}
                  onChange={(event) => setConfigLanguage(event.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                排版密度
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configDensity}
                  onChange={(event) => setConfigDensity(event.target.value)}
                >
                  {DENSITY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 font-medium">
                主题预设
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700"
                  value={configThemePreset}
                  onChange={(event) => setConfigThemePreset(event.target.value)}
                >
                  {THEME_PRESET_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {showAdvanced && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Typography variant="small" className="text-gray-600 text-xs font-medium">
                    Frontmatter 覆盖（YAML，可选）
                  </Typography>
                  <Textarea
                    value={configFrontmatter}
                    onChange={(event) => setConfigFrontmatter(event.target.value)}
                    rows={5}
                    className="font-mono text-[11px]"
                    placeholder={'theme: default\ncolorSchema: light\nfonts:\n  sans: "Manrope"\ntransition: fade'}
                  />
                  <Typography variant="small" className="text-gray-500 text-[11px]">
                    留空将使用主题预设自动生成；如需覆盖请填写 YAML（不需要 --- 包裹）。
                  </Typography>
                </div>
                <div className="space-y-1">
                  <Typography variant="small" className="text-gray-600 text-xs font-medium">
                    Frontmatter 预览
                  </Typography>
                  <pre className="rounded-lg border border-gray-200 bg-white p-2 text-[11px] text-gray-700 whitespace-pre-wrap">
                    {frontmatterPreview}
                  </pre>
                </div>
                {!isDemo && (
                  <div className="space-y-1">
                    <Typography variant="small" className="text-gray-600 text-xs font-medium">
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
          <Typography variant="small" className="text-gray-600">
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
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                暂无大纲内容，请先生成或添加幻灯片。
              </div>
            ) : (
              outlineItems.map((item, index) => (
                <div key={`outline-${index}`} className="rounded-lg border border-gray-200 p-3 space-y-2">
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
          <Typography variant="small" className="text-gray-600">
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
        <Typography variant="small" className="text-gray-600">
          {selectionLabel}
        </Typography>
      </div>
    );
  };

  const stageActions = () => {
    if (!notebookId && !isDemo) {
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
            disabled={!onQueueSlides || isQueueing || loading}
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
          {!isDemo && (
            <Button variant="outlined" onClick={handleSaveMarkdown} disabled={isGenerating || !draft}>
              保存 Markdown
            </Button>
          )}
        </div>
      );
    }

    if (activeStage === 'input') {
      return (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={onClose}>
            关闭
          </Button>
          <Button variant="outlined" onClick={saveInputStage} disabled={isGenerating}>
            保存
          </Button>
          <Button variant="outlined" onClick={handleGenerateOutline} disabled={isGenerating}>
            生成大纲
          </Button>
          <Button color="blue" onClick={handleGenerateAll} disabled={isGenerating}>
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
          <Button variant="outlined" onClick={handleSaveOutline} disabled={isGenerating}>
            保存大纲
          </Button>
          <Button color="blue" onClick={handleGenerateMarkdown} disabled={isGenerating}>
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
        <Button variant="outlined" onClick={handleSaveMarkdown} disabled={isGenerating}>
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

  return (
    <Dialog
      open={open}
      handler={onClose}
      size="xxl"
      className={`rounded-xl overflow-hidden flex flex-col bg-white ${
        isFullscreen
          ? 'absolute inset-0 min-w-[100vw] min-h-[100vh] h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw]'
          : 'absolute left-[5vw] top-[5vh] min-w-[90vw] min-h-[90vh] h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw]'
      }`}
    >
      <DialogHeader className="flex items-start justify-between gap-4 border-b border-gray-100 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
            <SlideshowIcon fontSize="small" />
          </div>
          <div className="min-w-0">
            <Typography variant="h6" className="text-[15px] font-semibold text-gray-900 truncate">
              演示生成
            </Typography>
            <Typography variant="small" className="text-gray-500 text-xs font-medium">
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
          <IconButton variant="text" size="sm" onClick={onClose} className="rounded-full">
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
            <Typography variant="small" className="text-gray-500 text-xs">
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
                        : 'border-gray-200 bg-gray-50 text-gray-700'
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
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 flex items-start gap-2"
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
              <div className="rounded-xl border border-gray-200 bg-white p-4 flex-1 min-h-0 overflow-auto">
                {stageContent()}
              </div>
            </div>
            {showPreviewPanel && (
              <div className={`rounded-xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-3 flex flex-col min-h-0 shadow-sm ${isPreviewMode ? 'order-1 lg:order-2' : ''}`}>
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Typography variant="small" className="text-gray-700 font-semibold">
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
                    disabled={!canBuildPreview || isGenerating || isPreviewSyncing}
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
                      disabled={isGenerating || isPreviewSyncing}
                    >
                      强制刷新
                    </Button>
                  )}
                </div>
                {isPreviewMode && !previewReady && canBuildPreview && (
                  <Typography variant="small" className="text-xs text-gray-500 mt-2">
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
                    <div className="h-full w-auto max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
                      <iframe
                        key={previewKey}
                        title="Slidev 预览"
                        src={previewUrl}
                        className="h-full w-full border-0 bg-black"
                        loading="lazy"
                      />
                    </div>
                  ) : isPreviewSyncing || isGenerating || queueStatus === 'running' || draft?.status === 'running' ? (
                    <div className="w-full max-w-full aspect-video rounded-lg border border-dashed border-slate-300 bg-white/70 flex flex-col items-center justify-center gap-2 text-xs text-gray-500">
                      <Spinner className="h-4 w-4" />
                      <span>预览同步中...</span>
                    </div>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-gray-500 px-6 text-center">
                      <span>暂无预览，请先生成 Markdown 或点击“同步预览”。</span>
                      <span className="text-[11px] text-gray-400">
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
      <DialogFooter className="flex items-center justify-end border-t border-gray-100 p-4">
        {stageActions()}
      </DialogFooter>
    </Dialog>
  );
}
