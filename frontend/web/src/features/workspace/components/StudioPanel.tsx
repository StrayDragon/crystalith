import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  IconButton,
  Typography,
  Chip,
  Card,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Textarea,
  Input,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Spinner,
  Tooltip,
} from '@material-tailwind/react';
import {
  Add as AddIcon,
  MoreHoriz as MoreHorizIcon,
  Close as CloseIcon,
  AccountTree as MindmapIcon,
  Assignment as BriefingIcon,
  QuestionAnswer as FAQIcon,
  Quiz as QuizIcon,
  MenuBook as GuideIcon,
  Timeline as TimelineIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  DriveFileMove as ConvertIcon,
  OpenInFull as OpenInFullIcon,
  Slideshow as SlidesIcon,
} from '@mui/icons-material';

import { getToolConfig, type ToolConfigResponse } from '../api';
import { ModelSelector } from './ModelSelector';
import type { OutputItem, OutputTypeId, WorkspaceTool } from '../types';
import { formatRelativeTime } from '../utils';
import { LAYER_LEVELS } from '../../../shared/layer';

interface StudioPanelProps {
  tools: WorkspaceTool[];
  toolsLoading?: boolean;
  toolsError?: string;
  outputs: OutputItem[];
  outputQueueJobs: {
    id: string;
    type: OutputTypeId;
    status: 'queued' | 'running' | 'done' | 'error';
    chunkIds: number[];
    draftId?: number | null;
  }[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
    queueJobId?: string | null;
  }) => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSelectOutputFullscreen?: (outputId: number) => void;
  onSaveNote?: (content: string) => void;
  onConvertToSource?: (outputId: number) => void;
  isDemo: boolean;
  isFullscreen?: boolean;
}

type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

type StudioNote = {
  id: string;
  outputId?: number;
  slideId?: number | null;
  title: string;
  meta: string;
  type: OutputTypeId;
};

type PendingNote = {
  id: string;
  title: string;
  meta: string;
  type: OutputTypeId;
  status: 'queued' | 'running' | 'error';
  slideId?: number | null;
  queueJobId?: string;
};

const DEFAULT_TYPE_LABELS: Record<OutputTypeId, string> = {
  FAQ: '闪卡',
  GUIDE: '指南',
  TIMELINE: '时间轴',
  MINDMAP: '思维导图',
  QUIZ: '测验',
  BRIEFING: '报告',
  SLIDES: '演示',
  PARAGRAPH: '段落',
  BULLETS: '要点',
  STRUCTURED: '结构化',
};

const TONE_COLORS: Record<StudioTone, { bg: string; border: string; text: string; icon: string }> = {
  slate: { bg: '#f4f6fb', border: '#e2e8f0', text: '#475569', icon: '#e7ebf2' },
  blue: { bg: '#eef4ff', border: '#c9d8ff', text: '#2f5fd0', icon: '#dbe7ff' },
  green: { bg: '#edf7f1', border: '#bfe6cf', text: '#2f8f5b', icon: '#d6f1e2' },
  rose: { bg: '#ffeef1', border: '#f7c5cf', text: '#b4234b', icon: '#ffd7de' },
  amber: { bg: '#fff4e6', border: '#fbd9a2', text: '#b45309', icon: '#ffe3c5' },
  teal: { bg: '#e7f7f6', border: '#b5e1de', text: '#0f766e', icon: '#ccefed' },
  indigo: { bg: '#eef0ff', border: '#cfd4ff', text: '#4f46e5', icon: '#dde2ff' },
};

const DEMO_NOTES: StudioNote[] = [
  {
    id: 'demo-1',
    title: '米诺地尔治疗脱发（激素抵抗性脱发）的研究总结与临...',
    meta: '39 个来源 · 3 天前',
    type: 'BRIEFING',
  },
  {
    id: 'demo-2',
    title: '脱发问答',
    meta: '39 个来源 · 6 天前',
    type: 'FAQ',
  },
  {
    id: 'demo-3',
    title: 'AGA 现代图景 或者 AGA Modern Landscape',
    meta: '39 个来源 · 7 天前',
    type: 'MINDMAP',
  },
  {
    id: 'demo-4',
    title: 'Eating for Healthier Hair: A Practical Guide to Key...',
    meta: '39 个来源 · 7 天前',
    type: 'GUIDE',
  },
  {
    id: 'demo-5',
    title: '雄激素脱发：脱发与治疗',
    meta: '39 个来源 · 7 天前',
    type: 'TIMELINE',
  },
  {
    id: 'demo-6',
    title: '雄激素性脱发：机制和新治疗',
    meta: '39 个来源 · 7 天前',
    type: 'QUIZ',
  },
];

function resolveOutputTitle(output: OutputItem): string {
  const content = output.content ?? {};
  const contentTitle = typeof (content as any).title === 'string' ? (content as any).title.trim() : '';
  if (contentTitle) return contentTitle;
  const promptTitle = output.prompt?.trim();
  if (promptTitle) return promptTitle;
  return `${output.type} 输出`;
}

function resolveNoteMeta(output: OutputItem): string {
  const count = output.chunkIds?.length ?? 0;
  const relative =
    formatRelativeTime(output.createdAtRaw ?? output.updatedAtRaw) ||
    output.createdAt ||
    output.updatedAt ||
    '刚刚';
  if (count > 0) {
    return `${count} 个来源 · ${relative}`;
  }
  return `自动生成 · ${relative}`;
}

function resolveTone(type: OutputTypeId): StudioTone {
  switch (type) {
    case 'MINDMAP':
      return 'indigo';
    case 'BRIEFING':
      return 'amber';
    case 'FAQ':
      return 'blue';
    case 'QUIZ':
      return 'teal';
    case 'GUIDE':
      return 'green';
    case 'TIMELINE':
      return 'rose';
    case 'SLIDES':
      return 'slate';
    default:
      return 'slate';
  }
}

function resolveTypeLabel(type: OutputTypeId, labels: Map<OutputTypeId, string>) {
  return labels.get(type) ?? DEFAULT_TYPE_LABELS[type];
}

function getToolIcon(type: OutputTypeId) {
  // Using MUI icons for now, can be replaced later
  const props = { style: { fontSize: 18 } };
  switch (type) {
    case 'MINDMAP':
      return <MindmapIcon {...props} />;
    case 'BRIEFING':
      return <BriefingIcon {...props} />;
    case 'FAQ':
      return <FAQIcon {...props} />;
    case 'QUIZ':
      return <QuizIcon {...props} />;
    case 'GUIDE':
      return <GuideIcon {...props} />;
    case 'TIMELINE':
      return <TimelineIcon {...props} />;
    case 'SLIDES':
      return <SlidesIcon {...props} />;
    default:
      return <SaveIcon {...props} />;
  }
}

function StudioPanel({
  tools,
  toolsLoading,
  toolsError,
  outputs,
  outputQueueJobs,
  outputsLoading,
  outputsError,
  onRetryOutputs,
  onGenerateOutput,
  onOpenSlides,
  onDeleteOutput,
  onSelectOutput,
  onSelectOutputFullscreen,
  onSaveNote,
  onConvertToSource,
  isDemo,
  isFullscreen = false,
}: StudioPanelProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Note editor dialog state
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteEditorContent, setNoteEditorContent] = useState('');

  // Tool config dialog state
  const [toolConfigOpen, setToolConfigOpen] = useState(false);
  const [activeToolType, setActiveToolType] = useState<OutputTypeId | null>(null);
  const [configQuantity, setConfigQuantity] = useState<string>('standard');
  const [configDifficulty, setConfigDifficulty] = useState<string>('medium');
  const [configTopic, setConfigTopic] = useState('');
  const [configModelId, setConfigModelId] = useState<string | null>(null);
  const [toolConfig, setToolConfig] = useState<ToolConfigResponse | null>(null);
  const [toolConfigLoading, setToolConfigLoading] = useState(false);

  // Fetch tool config when dialog opens
  useEffect(() => {
    if (!toolConfigOpen || !activeToolType || isDemo) return;

    const toolId = activeToolType.toLowerCase();
    setToolConfigLoading(true);
    getToolConfig(toolId)
      .then((config) => {
        setToolConfig(config);
        // Set default values from config
        const defaultQuantity = config.quantity_options?.find((o) => o.is_default)?.id || 'standard';
        const defaultDifficulty = config.difficulty_options?.find((o) => o.is_default)?.id || 'medium';
        setConfigQuantity(defaultQuantity);
        setConfigDifficulty(defaultDifficulty);
      })
      .catch(() => {
        // Fallback to defaults if API fails
        setToolConfig(null);
      })
      .finally(() => {
        setToolConfigLoading(false);
      });
  }, [toolConfigOpen, activeToolType, isDemo]);

  const handleToolConfigOpen = useCallback((event: React.MouseEvent<HTMLElement>, toolType: OutputTypeId) => {
    event.stopPropagation();
    if (toolType === 'SLIDES') {
      onOpenSlides?.({ mode: 'config' });
      return;
    }
    setActiveToolType(toolType);
    setToolConfigOpen(true);
    // Reset config
    setConfigQuantity('standard');
    setConfigDifficulty('medium');
    setConfigTopic('');
    setConfigModelId(null);
    setToolConfig(null);
  }, [onOpenSlides]);

  const handleToolConfigClose = useCallback(() => {
    setToolConfigOpen(false);
    setActiveToolType(null);
    setToolConfig(null);
    setConfigModelId(null);
  }, []);

  const handleGenerateWithConfig = useCallback(() => {
    if (activeToolType) {
      onGenerateOutput(activeToolType, configModelId);
    }
    handleToolConfigClose();
  }, [activeToolType, configModelId, onGenerateOutput, handleToolConfigClose]);

  // Note: Menu state is handled locally by Menu component in MT, but we need to track active item for actions
  // We'll use a specific way to handle menu actions

  const handleCopyNote = useCallback(() => {
    // TODO: Implement copy to clipboard
    setActiveNoteId(null);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    if (!id) return;
    // activeNoteId is the output.id as string
    const outputId = parseInt(id, 10);
    if (!isNaN(outputId)) {
      if (!window.confirm('确定要删除此输出吗？此操作不可撤销。')) {
        return;
      }
      onDeleteOutput(outputId);
    }
  }, [onDeleteOutput]);

  const handleConvertToSource = useCallback((id: string) => {
    if (!id) return;
    const outputId = parseInt(id, 10);
    if (!isNaN(outputId) && onConvertToSource) {
      onConvertToSource(outputId);
    }
  }, [onConvertToSource]);

  // Note editor handlers
  const handleOpenNoteEditor = useCallback(() => {
    setNoteEditorContent('');
    setNoteEditorOpen(true);
  }, []);

  const handleCloseNoteEditor = useCallback(() => {
    setNoteEditorOpen(false);
    setNoteEditorContent('');
  }, []);

  const handleSaveNote = useCallback(() => {
    if (noteEditorContent.trim() && onSaveNote) {
      onSaveNote(noteEditorContent.trim());
    }
    handleCloseNoteEditor();
  }, [noteEditorContent, onSaveNote, handleCloseNoteEditor]);

  const typeLabelMap = useMemo(() => {
    const map = new Map<OutputTypeId, string>();
    tools.forEach((tool) => {
      map.set(tool.outputType, tool.label);
    });
    return map;
  }, [tools]);

  const outputNotes = useMemo<StudioNote[]>(
    () =>
      outputs.map((output) => ({
        id: `${output.id}`,
        outputId: output.id,
        slideId: output.type === 'SLIDES' ? (output.content as any)?.slide_id ?? null : null,
        title: resolveOutputTitle(output),
        meta: resolveNoteMeta(output),
        type: output.type,
      })),
    [outputs],
  );

  const pendingNotes = useMemo<PendingNote[]>(() => {
    const statusLabels = {
      queued: '排队中',
      running: '生成中',
      error: '生成失败',
    } satisfies Record<PendingNote['status'], string>;
    return outputQueueJobs
      .filter((job) => job.status === 'queued' || job.status === 'running' || job.status === 'error')
      .map((job) => {
        const typeLabel = resolveTypeLabel(job.type, typeLabelMap);
        const sourceLabel = job.chunkIds.length
          ? `基于 ${job.chunkIds.length} 个来源`
          : '自动生成';
        const statusLabel = statusLabels[job.status as PendingNote['status']] || job.status;
        return {
          id: `pending-${job.id}`,
          title: job.status === 'error' ? `${typeLabel} 生成失败` : `生成${typeLabel}...`,
          meta: `${sourceLabel} · ${statusLabel}`,
          type: job.type,
          status: job.status as PendingNote['status'],
          slideId: job.type === 'SLIDES' ? job.draftId ?? null : null,
          queueJobId: job.id,
        };
      });
  }, [outputQueueJobs, typeLabelMap]);

  const notes = outputNotes.length > 0 ? outputNotes : isDemo ? DEMO_NOTES : [];
  const showSkeleton = outputsLoading && notes.length === 0 && pendingNotes.length === 0;
  const showEmpty = !outputsLoading && notes.length === 0 && pendingNotes.length === 0;

  return (
    <div className={`flex flex-1 flex-col gap-3 p-3 sm:p-4 min-h-0 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
      {/* Tools Grid */}
      {toolsLoading ? (
        <div className={`grid gap-2 ${isFullscreen ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-gray-300 animate-pulse" />
          ))}
        </div>
      ) : toolsError ? (
        <div className="p-3 text-center rounded-lg bg-red-50 border border-red-200">
          <Typography variant="small" color="red" className="font-medium">
            {toolsError}
          </Typography>
        </div>
      ) : tools.length === 0 ? (
        <div className="p-3 text-center border border-dashed border-gray-400 rounded-lg bg-gray-100">
          <Typography variant="small" className="font-medium text-gray-600">
            暂无可用工具
          </Typography>
        </div>
      ) : (
        <div className={`grid gap-2 ${isFullscreen ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {tools.map((tool, index) => {
            const isDisabled = !tool.enabled || !tool.outputType;
            const isSlidesTool = tool.outputType === 'SLIDES';
            const tone = tool.tone as StudioTone || 'slate';
            const colors = TONE_COLORS[tone];

            return (
              <Tooltip
                key={tool.id}
                content={tool.description || tool.label}
                placement="top"
                className="max-w-[200px] text-xs bg-gray-900 text-white px-2 py-1 rounded"
                animate={{
                  mount: { opacity: 1, scale: 1 },
                  unmount: { opacity: 0, scale: 0.95 },
                }}
              >
                <button
                  type="button"
                  disabled={isDisabled}
                  className={`group flex items-center gap-2 px-2 py-1.5 min-h-[34px] w-full rounded-lg border text-left font-semibold text-[11px] transition-all hover:shadow-sm hover:-translate-y-[1px] ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  onClick={() => {
                    if (isDisabled) return;
                    if (isSlidesTool) {
                      onOpenSlides?.({ mode: 'config' });
                      return;
                    }
                    onGenerateOutput(tool.outputType);
                  }}
                >
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded border flex-shrink-0"
                    style={{
                      backgroundColor: colors.icon,
                      borderColor: colors.border,
                    }}
                  >
                    {getToolIcon(tool.outputType)}
                  </div>
                  <span className="leading-tight truncate flex-1 min-w-0">{tool.label}</span>
                  {tool.badge && (
                    <span className="h-3 px-1 text-[8px] bg-gray-900 text-white rounded leading-none flex items-center flex-shrink-0">
                      {tool.badge}
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={-1}
                    className="flex-shrink-0 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleToolConfigOpen(e as unknown as React.MouseEvent<HTMLElement>, tool.outputType);
                    }}
                    aria-label="自定义工具参数"
                  >
                    <EditIcon sx={{ fontSize: 10 }} />
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Notes Section */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {/* Loading Skeleton */}
        {showSkeleton && (
          <div className="flex flex-col gap-2">
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-10 w-2/3 rounded-lg bg-gray-100 animate-pulse" />
          </div>
        )}

        {/* Empty State */}
        {showEmpty && (
          <div className="p-4 text-center border border-dashed border-gray-300 rounded-xl bg-gray-100">
            <Typography variant="small" className="text-gray-600 font-medium">
              暂无笔记
            </Typography>
          </div>
        )}

        {/* Notes List */}
        {!showSkeleton && !showEmpty && (
          <div className="flex flex-col gap-2">
            {/* Pending Notes */}
            {pendingNotes.map((note) => {
              const tone = resolveTone(note.type);
              const colors = TONE_COLORS[tone];
              const isError = note.status === 'error';
              const canOpenSlides = note.type === 'SLIDES' && note.slideId;

              const content = (
                <>
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-md border border-dashed flex-shrink-0 ${
                      isError ? 'bg-red-50 border-red-300 text-red-500' : ''
                    }`}
                    style={!isError ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text } : undefined}
                  >
                    {isError ? (
                      <span className="text-xs font-bold">!</span>
                    ) : (
                      <Spinner className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Typography
                      variant="small"
                      className={`font-medium leading-snug truncate ${isError ? 'text-red-700' : 'text-gray-900'}`}
                    >
                      {note.title}
                    </Typography>
                    <Typography
                      variant="small"
                      className={`text-[10px] font-medium leading-tight ${isError ? 'text-red-500' : 'text-gray-600'}`}
                    >
                      {note.meta}
                    </Typography>
                  </div>
                </>
              );

              if (canOpenSlides) {
                return (
                  <button
                    key={note.id}
                    type="button"
                    className={`flex items-center gap-2 p-2 rounded-lg border border-dashed w-full text-left transition-colors hover:bg-white/70 ${
                      isError ? 'bg-red-50/80 border-red-200' : ''
                    }`}
                    style={!isError ? { backgroundColor: `${colors.bg}80`, borderColor: colors.border } : undefined}
                    onClick={() => {
                      if (!note.slideId) return;
                      onOpenSlides?.({
                        mode: 'preview',
                        slideId: note.slideId,
                        queueStatus: note.status,
                        queueJobId: note.queueJobId ?? null,
                      });
                    }}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div
                  key={note.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border border-dashed ${
                    isError ? 'bg-red-50/80 border-red-200' : ''
                  }`}
                  style={!isError ? { backgroundColor: `${colors.bg}80`, borderColor: colors.border } : undefined}
                >
                  {content}
                </div>
              );
            })}

            {/* Completed Notes */}
            {notes.map((note) => {
              const tone = resolveTone(note.type);
              const colors = TONE_COLORS[tone];

              return (
                <div
                  key={note.id}
                  className="group relative flex items-center rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300"
                >
                  {/* Main clickable area for note content */}
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 p-2 text-left min-w-0"
                    onClick={() => {
                      if (note.type === 'SLIDES' && note.slideId) {
                        onOpenSlides?.({ mode: 'preview', slideId: note.slideId });
                        return;
                      }
                      if (!note.outputId) return;
                      onSelectOutput(note.outputId);
                    }}
                    disabled={!note.outputId}
                  >
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded-md border flex-shrink-0"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    >
                      {getToolIcon(note.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Typography
                        variant="small"
                        className="font-medium text-gray-900 leading-snug truncate text-[11px]"
                      >
                        {note.title}
                      </Typography>
                      <Typography
                        variant="small"
                        className="text-[10px] text-gray-500 font-medium leading-tight truncate"
                      >
                        {note.meta}
                      </Typography>
                    </div>
                  </button>

                  {/* Menu button - separate from main button to fix click issues */}
                  <div
                    className="flex-shrink-0 pr-1"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Menu placement="bottom-end">
                      <MenuHandler>
                        <IconButton
                          variant="text"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 min-w-[28px] rounded-full hover:bg-gray-200 text-gray-500 transition-opacity"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <MoreHorizIcon fontSize="small" />
                        </IconButton>
                      </MenuHandler>
                      <MenuList className="p-1 min-w-[140px]" style={{ zIndex: LAYER_LEVELS.dropdown }}>
                        {onSelectOutputFullscreen && note.outputId && (
                          <MenuItem
                            onClick={() => onSelectOutputFullscreen(note.outputId!)}
                            className="flex items-center gap-2 py-2 px-3 text-xs"
                          >
                            <OpenInFullIcon className="h-3.5 w-3.5" />
                            <span>放大查看</span>
                          </MenuItem>
                        )}
                        <MenuItem
                          onClick={() => handleConvertToSource(note.id)}
                          className="flex items-center gap-2 py-2 px-3 text-xs"
                        >
                          <ConvertIcon className="h-3.5 w-3.5" />
                          <span>转换为来源</span>
                        </MenuItem>
                        <MenuItem
                          onClick={() => handleCopyNote()}
                          className="flex items-center gap-2 py-2 px-3 text-xs"
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                          <span>复制内容</span>
                        </MenuItem>
                        <MenuItem
                          onClick={() => handleDeleteNote(note.id)}
                          className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <DeleteIcon className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error State */}
        {outputsError && (
          <div className="flex items-center gap-2 mt-2">
            <Typography variant="small" color="red" className="text-[11px]">
              {outputsError}
            </Typography>
            <Button
              variant="text"
              size="sm"
              onClick={onRetryOutputs}
              className="px-2 py-1 h-6 min-h-0 text-[11px] text-gray-800"
            >
              重试
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <Button
        variant="filled"
        fullWidth
        size="sm"
        className="flex items-center justify-center gap-2 rounded-full py-2 bg-slate-900 text-xs normal-case"
        onClick={handleOpenNoteEditor}
      >
        <AddIcon style={{ fontSize: 16 }} />
        添加笔记
      </Button>

      {/* Tool Config Dialog */}
      <Dialog
        open={toolConfigOpen}
        handler={handleToolConfigClose}
        size="xs"
        className="rounded-xl overflow-hidden"
      >
        <DialogHeader className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500">
              {activeToolType && getToolIcon(activeToolType)}
            </div>
            <Typography variant="h6" color="blue-gray" className="text-sm font-semibold">
              自定义{activeToolType && resolveTypeLabel(activeToolType, typeLabelMap)}
            </Typography>
          </div>
          <IconButton variant="text" size="sm" onClick={handleToolConfigClose} className="rounded-full">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </DialogHeader>

        <DialogBody className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {toolConfigLoading ? (
            <div className="flex flex-col gap-3">
              <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {/* Quantity Selection */}
              {(toolConfig?.quantity_options || !toolConfig) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    数量
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {(toolConfig?.quantity_options || [
                      { id: 'less', label: '更少', is_default: false },
                      { id: 'standard', label: '标准（默认）', is_default: true },
                      { id: 'more', label: '更多', is_default: false },
                    ]).map((option) => (
                      <Button
                        key={option.id}
                        variant={configQuantity === option.id ? 'filled' : 'outlined'}
                        size="sm"
                        onClick={() => setConfigQuantity(option.id)}
                        className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                          configQuantity === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                        }`}
                      >
                         {configQuantity === option.id && option.is_default && <span className="mr-1">✓</span>}
                         {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty Selection */}
              {(toolConfig?.difficulty_options || (!toolConfig && activeToolType !== 'FAQ' && activeToolType !== 'TIMELINE' && activeToolType !== 'MINDMAP' && activeToolType !== 'BRIEFING')) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    难度等级
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {(toolConfig?.difficulty_options || [
                      { id: 'easy', label: '简单', is_default: false },
                      { id: 'medium', label: '中等（默认）', is_default: true },
                      { id: 'hard', label: '困难', is_default: false },
                    ]).map((option) => (
                      <Button
                        key={option.id}
                        variant={configDifficulty === option.id ? 'filled' : 'outlined'}
                        size="sm"
                        onClick={() => setConfigDifficulty(option.id)}
                        className={`rounded-full px-3 py-1.5 normal-case font-normal border-gray-200 ${
                          configDifficulty === option.id ? 'bg-slate-900 text-white' : 'text-gray-700'
                        }`}
                      >
                         {configDifficulty === option.id && option.is_default && <span className="mr-1">✓</span>}
                         {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Input */}
              {(toolConfig?.supports_topic !== false) && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
                    主题应该是什么？
                  </Typography>
                  <Textarea
                    placeholder={toolConfig?.topic_placeholder || "示例提示\n• 限定特定来源或主题\n• 说明重点关注的方向\n• 提供具体的约束条件"}
                    value={configTopic}
                    onChange={(e) => setConfigTopic(e.target.value)}
                    className="!border-t-blue-gray-200 focus:!border-t-gray-900 min-h-[100px]"
                    labelProps={{
                      className: "before:content-none after:content-none",
                    }}
                  />
                </div>
              )}

              {/* Model Selection */}
              {!isDemo && (
                <div>
                  <Typography variant="small" className="mb-2 font-medium text-gray-700">
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
            </>
          )}
        </DialogBody>

        <DialogFooter className="p-4 pt-2">
          <Button
            variant="filled"
            fullWidth
            onClick={handleGenerateWithConfig}
            className="rounded-full bg-slate-900 normal-case"
          >
            生成
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Note Editor Dialog */}
      <Dialog
        open={noteEditorOpen}
        handler={handleCloseNoteEditor}
        size="sm"
        className="rounded-xl"
      >
        <DialogHeader className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700">
              <EditIcon fontSize="small" />
            </div>
            <Typography variant="h6" className="text-sm font-semibold text-slate-900">
              新建笔记
            </Typography>
          </div>
          <IconButton variant="text" size="sm" onClick={handleCloseNoteEditor} className="rounded-full">
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </DialogHeader>

        <DialogBody className="p-4">
          <Textarea
            autoFocus
            rows={8}
            placeholder="在此输入笔记内容..."
            value={noteEditorContent}
            onChange={(e) => setNoteEditorContent(e.target.value)}
            className="!border-t-blue-gray-200 focus:!border-t-gray-900"
            labelProps={{
              className: "before:content-none after:content-none",
            }}
          />
          <Typography variant="small" className="mt-2 text-xs text-gray-500">
            支持 Markdown 格式
          </Typography>
        </DialogBody>

        <DialogFooter className="flex justify-end gap-2 p-4">
          <Button
            variant="text"
            onClick={handleCloseNoteEditor}
            className="rounded-full text-gray-600 normal-case"
          >
            取消
          </Button>
          <Button
            variant="filled"
            onClick={handleSaveNote}
            disabled={!noteEditorContent.trim()}
            className="flex items-center gap-2 rounded-full bg-slate-900 normal-case"
          >
            <SaveIcon className="h-4 w-4" />
            保存笔记
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

export default memo(StudioPanel);
