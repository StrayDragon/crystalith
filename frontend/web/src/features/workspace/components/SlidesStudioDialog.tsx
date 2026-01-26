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

import type { SlideDraft, SlideOutline, SlideOutlineItem, SlideStage } from '../types';
import {
  createSlidesDraft,
  getLatestSlidesDraft,
  getSlidesDraft,
  updateSlidesDraft,
  updateSlidesOutline,
  updateSlidesMarkdown,
} from '../api';
import { buildSlidevPreviewUrl } from '@crystalith-slidev';

const STAGES: { id: SlideStage; label: string }[] = [
  { id: 'input', label: '输入' },
  { id: 'outline', label: '大纲' },
  { id: 'markdown', label: 'Markdown' },
];

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
  selectedChunkIds: number[];
  isDemo: boolean;
  onOutputsUpdated: () => void;
}

export default function SlidesStudioDialog({
  open,
  onClose,
  notebookId,
  selectedChunkIds,
  isDemo,
  onOutputsUpdated,
}: SlidesStudioDialogProps) {
  const [draft, setDraft] = useState<SlideDraft | null>(null);
  const [activeStage, setActiveStage] = useState<SlideStage>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [events, setEvents] = useState<{ type: string; message: string }[]>([]);

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [outlineTitle, setOutlineTitle] = useState('');
  const [outlineItems, setOutlineItems] = useState<SlideOutlineItem[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);

  const selectionLabel = useMemo(() => {
    if (!selectedChunkIds.length) return '将基于当前笔记本自动检索。';
    return `已选择 ${selectedChunkIds.length} 条引用，将仅基于选中引用生成。`;
  }, [selectedChunkIds]);

  const previewStale = useMemo(
    () => Boolean(previewMarkdown && previewMarkdown !== markdown),
    [previewMarkdown, markdown],
  );
  const previewReady = Boolean(previewMarkdown);
  const previewUrl = useMemo(() => buildSlidevPreviewUrl(previewKey), [previewKey]);
  const previewStatus = previewReady ? '已同步' : '未生成';
  const previewStatusTone = previewReady ? 'green' : 'gray';

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const resetDraftState = useCallback(() => {
    setDraft(null);
    setActiveStage('input');
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
  }, []);

  const syncFromDraft = useCallback((nextDraft: SlideDraft | null) => {
    if (!nextDraft) {
      resetDraftState();
      return;
    }
    setDraft(nextDraft);
    setTitle(nextDraft.title ?? '');
    setPrompt(nextDraft.prompt ?? '');
    setOutlineTitle(outlineTitleFromDraft(nextDraft));
    setOutlineItems(outlineItemsFromDraft(nextDraft));
    setMarkdown(nextDraft.markdown ?? '');
    setActiveStage(nextDraft.stage ?? 'input');
  }, [resetDraftState]);

  const loadLatestDraft = useCallback(async () => {
    if (!open) return;
    if (!notebookId || isDemo) {
      syncFromDraft(isDemo ? DEMO_DRAFT : null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const latest = await getLatestSlidesDraft(notebookId);
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
  }, [isDemo, notebookId, open, resetDraftState, syncFromDraft]);

  const refreshDraft = useCallback(async (slideId?: number) => {
    if (!notebookId) return;
    const targetId = slideId ?? draft?.id;
    if (!targetId) return;
    const latest = await getSlidesDraft(notebookId, targetId);
    syncFromDraft(normalizeDraft(latest));
  }, [draft?.id, notebookId, syncFromDraft]);

  useEffect(() => {
    if (open) {
      void loadLatestDraft();
    } else {
      closeEventSource();
    }
  }, [closeEventSource, loadLatestDraft, open]);

  useEffect(() => () => closeEventSource(), [closeEventSource]);

  useEffect(() => {
    if (!draft?.id) {
      setPreviewMarkdown('');
      setPreviewError('');
      setPreviewKey(0);
      return;
    }
    setPreviewMarkdown('');
    setPreviewError('');
    setPreviewKey(0);
  }, [draft?.id]);

  const saveInputStage = useCallback(async () => {
    if (!notebookId) return null;
    setError('');
    const payload = {
      title: title.trim() || undefined,
      prompt: prompt.trim() || undefined,
      chunk_ids: selectedChunkIds,
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
  }, [draft, notebookId, prompt, selectedChunkIds, syncFromDraft, title]);

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

  const startEventSource = useCallback(
    (url: string, onDone?: () => Promise<void> | void) => {
      closeEventSource();
      setIsGenerating(true);
      setEvents([]);
      setError('');
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      const handleFinish = async () => {
        setIsGenerating(false);
        closeEventSource();
        if (onDone) await onDone();
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
        void handleFinish();
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setError(data.message || '生成失败，请稍后重试。');
        void handleFinish();
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
    const url = `/v1/notebooks/${notebookId}/slides/drafts/${saved.id}/outline/stream`;
    startEventSource(url, async () => {
      await refreshDraft(saved.id);
      setActiveStage('outline');
    });
  }, [isDemo, notebookId, refreshDraft, saveInputStage, startEventSource]);

  const handleGenerateMarkdown = useCallback(async () => {
    if (!notebookId || !draft || isDemo) return;
    await handleSaveOutline();
    const url = `/v1/notebooks/${notebookId}/slides/drafts/${draft.id}/markdown/stream`;
    startEventSource(url, async () => {
      await refreshDraft(draft.id);
      setActiveStage('markdown');
      onOutputsUpdated();
    });
  }, [draft, handleSaveOutline, isDemo, notebookId, onOutputsUpdated, refreshDraft, startEventSource]);

  const buildPreview = useCallback(async (force = false) => {
    if (!markdown.trim()) {
      setPreviewError('请先生成 Markdown。');
      return;
    }
    setPreviewError('');
    try {
      await handleSaveMarkdown();
      setPreviewMarkdown(markdown);
      if (force || !previewMarkdown) {
        setPreviewKey((prev) => prev + 1);
      }
    } catch {
      setPreviewError('预览更新失败，请稍后重试。');
    }
  }, [draft?.markdown, handleSaveMarkdown, markdown, previewMarkdown]);

  const handlePreview = useCallback(() => {
    void buildPreview(false);
  }, [buildPreview]);

  const handleRefreshPreview = useCallback(() => {
    void buildPreview(true);
  }, [buildPreview]);

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

    if (!notebookId) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <Typography variant="small" className="text-gray-600">
            请先创建或选择笔记本。
          </Typography>
        </div>
      );
    }

    if (activeStage === 'input') {
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
    if (!notebookId || isDemo) {
      return (
        <Button variant="outlined" onClick={onClose}>
          关闭
        </Button>
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
          <Button color="blue" onClick={handleGenerateOutline} disabled={isGenerating}>
            生成大纲
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
  const gridLayoutClass =
    activeStage === 'markdown'
      ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'
      : 'lg:grid-cols-[minmax(0,1fr)_360px]';

  return (
    <Dialog
      open={open}
      handler={onClose}
      size="xxl"
      className="rounded-xl overflow-hidden flex flex-col h-[85vh] max-h-[85vh] bg-white"
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
              输入 → 大纲 → Markdown
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Chip value={draft?.engine || 'slidev'} size="sm" variant="ghost" />
          <IconButton variant="text" size="sm" onClick={onClose} className="rounded-full">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </DialogHeader>
      <DialogBody className="p-4 flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 h-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <Typography variant="small" className="text-gray-500 text-xs">
              {draft ? `草稿 ${draft.id}` : '暂无草稿'}
            </Typography>
          </div>
          <div className={`grid grid-cols-1 ${gridLayoutClass} gap-4 flex-1 min-h-0`}>
            <div className="flex flex-col gap-3 min-h-0">
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              {isGenerating && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  正在生成中，请稍候...
                </div>
              )}
              {events.length > 0 && (
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
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-3 flex flex-col min-h-0 shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <Typography variant="small" className="text-gray-700 font-semibold">
                    预览
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
                  disabled={!canBuildPreview || isGenerating}
                >
                  {previewReady ? '更新预览' : '生成预览'}
                </Button>
                {previewReady && (
                  <Button
                    size="sm"
                    variant="outlined"
                    onClick={handleRefreshPreview}
                    disabled={isGenerating}
                  >
                    强制刷新
                  </Button>
                )}
              </div>
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
              <div className="mt-3 flex-1 min-h-0 rounded-lg border border-slate-200 bg-slate-900/5 overflow-hidden">
                {previewReady ? (
                  <iframe
                    key={previewKey}
                    title="Slidev 预览"
                    src={previewUrl}
                    className="h-full w-full border-0 bg-black"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-gray-500 px-6 text-center">
                    <span>暂无预览，请先生成 Markdown 并点击“生成预览”。</span>
                    <span className="text-[11px] text-gray-400">
                      预览基于本地 Slidev 服务（默认 http://localhost:3030）。
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="flex items-center justify-end border-t border-gray-100 p-4">
        {stageActions()}
      </DialogFooter>
    </Dialog>
  );
}
