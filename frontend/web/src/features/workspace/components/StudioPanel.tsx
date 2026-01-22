import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Stack,
  CircularProgress,
  Chip,
  Paper,
  Skeleton,
  Grid,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
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
} from '@mui/icons-material';

import { getToolConfig, type ToolConfigResponse, type ToolConfigOption } from '../api';
import { ModelSelector } from './ModelSelector';
import type { OutputItem, OutputTypeId, WorkspaceTool } from '../types';
import { formatRelativeTime } from '../utils';

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
  }[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSaveNote?: (content: string) => void;
  onConvertToSource?: (outputId: number) => void;
  isDemo: boolean;
}

type StudioTone = 'slate' | 'blue' | 'green' | 'rose' | 'amber' | 'teal' | 'indigo';

type StudioNote = {
  id: string;
  outputId?: number;
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
};

const DEFAULT_TYPE_LABELS: Record<OutputTypeId, string> = {
  FAQ: '闪卡',
  GUIDE: '指南',
  TIMELINE: '时间轴',
  MINDMAP: '思维导图',
  QUIZ: '测验',
  BRIEFING: '报告',
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
    default:
      return 'slate';
  }
}

function resolveTypeLabel(type: OutputTypeId, labels: Map<OutputTypeId, string>) {
  return labels.get(type) ?? DEFAULT_TYPE_LABELS[type];
}

function getToolIcon(type: OutputTypeId) {
  // Use 'small' fontSize which is configured to 14px in theme
  switch (type) {
    case 'MINDMAP':
      return <MindmapIcon fontSize="small" />;
    case 'BRIEFING':
      return <BriefingIcon fontSize="small" />;
    case 'FAQ':
      return <FAQIcon fontSize="small" />;
    case 'QUIZ':
      return <QuizIcon fontSize="small" />;
    case 'GUIDE':
      return <GuideIcon fontSize="small" />;
    case 'TIMELINE':
      return <TimelineIcon fontSize="small" />;
    default:
      return <SaveIcon fontSize="small" />;
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
  onDeleteOutput,
  onSelectOutput,
  onSaveNote,
  onConvertToSource,
  isDemo,
}: StudioPanelProps) {
  const [noteMenuAnchor, setNoteMenuAnchor] = useState<null | HTMLElement>(null);
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
    setActiveToolType(toolType);
    setToolConfigOpen(true);
    // Reset config
    setConfigQuantity('standard');
    setConfigDifficulty('medium');
    setConfigTopic('');
    setConfigModelId(null);
    setToolConfig(null);
  }, []);

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

  const handleNoteMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, noteId: string) => {
    event.stopPropagation();
    setNoteMenuAnchor(event.currentTarget);
    setActiveNoteId(noteId);
  }, []);

  const handleNoteMenuClose = useCallback(() => {
    setNoteMenuAnchor(null);
    setActiveNoteId(null);
  }, []);

  const handleCopyNote = useCallback(() => {
    // TODO: Implement copy to clipboard
    handleNoteMenuClose();
  }, [handleNoteMenuClose]);

  const handleDeleteNote = useCallback(() => {
    if (!activeNoteId) {
      handleNoteMenuClose();
      return;
    }
    // activeNoteId is the output.id as string
    const outputId = parseInt(activeNoteId, 10);
    if (!isNaN(outputId)) {
      if (!window.confirm('确定要删除此输出吗？此操作不可撤销。')) {
        handleNoteMenuClose();
        return;
      }
      onDeleteOutput(outputId);
    }
    handleNoteMenuClose();
  }, [activeNoteId, handleNoteMenuClose, onDeleteOutput]);

  const handleConvertToSource = useCallback(() => {
    if (!activeNoteId) {
      handleNoteMenuClose();
      return;
    }
    const outputId = parseInt(activeNoteId, 10);
    if (!isNaN(outputId) && onConvertToSource) {
      onConvertToSource(outputId);
    }
    handleNoteMenuClose();
  }, [activeNoteId, handleNoteMenuClose, onConvertToSource]);

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
        };
      });
  }, [outputQueueJobs, typeLabelMap]);

  const notes = outputNotes.length > 0 ? outputNotes : isDemo ? DEMO_NOTES : [];
  const showSkeleton = outputsLoading && notes.length === 0 && pendingNotes.length === 0;
  const showEmpty = !outputsLoading && notes.length === 0 && pendingNotes.length === 0;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.5, sm: 2 }, minHeight: 0 }}>
      {/* Tools Grid */}
      {toolsLoading ? (
        <Grid container spacing={0.75}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 6 }} key={i}>
              <Skeleton variant="rounded" height={32} sx={{ borderRadius: 1.5 }} />
            </Grid>
          ))}
        </Grid>
      ) : toolsError ? (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'error.50',
            borderColor: 'error.200',
          }}
        >
          <Typography variant="caption" color="error">
            {toolsError}
          </Typography>
        </Paper>
      ) : tools.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderRadius: 2,
            bgcolor: 'grey.50',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            暂无可用工具
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={0.75}>
          {tools.map((tool, index) => {
          const isDisabled = !tool.enabled || !tool.outputType;
          const tone = tool.tone as StudioTone || 'slate';
          const colors = TONE_COLORS[tone];

          return (
            <Grid size={{ xs: 6 }} key={tool.id}>
                <Button
                  fullWidth
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onGenerateOutput(tool.outputType);
                  }}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.625,
                    minHeight: 32,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: colors.border,
                    bgcolor: colors.bg,
                    color: colors.text,
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    transition: 'all 0.2s',
                    animation: `fadeIn 0.35s ease ${index * 40}ms both`,
                    '@keyframes fadeIn': {
                      from: { opacity: 0, transform: 'translateY(6px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                      transform: 'translateY(-1px)',
                    },
                    '&.Mui-disabled': {
                      bgcolor: colors.bg,
                      borderColor: colors.border,
                      color: alpha(colors.text, 0.5),
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: 1,
                      bgcolor: colors.icon,
                      border: '1px solid',
                      borderColor: colors.border,
                      flexShrink: 0,
                    }}
                  >
                    {getToolIcon(tool.outputType)}
                  </Box>
                  <Stack alignItems="flex-start" spacing={0.125} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {tool.label}
                    </Typography>
                    {tool.badge && (
                      <Chip
                        label={tool.badge}
                        size="small"
                        sx={{
                          height: 12,
                          fontSize: '0.5rem',
                          fontWeight: 600,
                          bgcolor: 'grey.900',
                          color: 'white',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    )}
                  </Stack>
                  {/* Config button - click to open config dialog */}
                  <IconButton
                    size="small"
                    onClick={(e) => handleToolConfigOpen(e, tool.outputType)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: alpha(colors.text, 0.08),
                      '&:hover': {
                        bgcolor: alpha(colors.text, 0.2),
                      },
                    }}
                  >
                    <EditIcon sx={{ fontSize: 10 }} />
                  </IconButton>
                </Button>
            </Grid>
          );
        })}
        </Grid>
      )}

      {/* Notes Section */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* Loading Skeleton */}
        {showSkeleton && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={40} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={40} width="70%" sx={{ borderRadius: 2 }} />
          </Stack>
        )}

        {/* Empty State */}
        {showEmpty && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              textAlign: 'center',
              borderStyle: 'dashed',
              borderRadius: 2.5,
              bgcolor: 'grey.50',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              暂无笔记
            </Typography>
          </Paper>
        )}

        {/* Notes List */}
        {!showSkeleton && !showEmpty && (
          <Stack spacing={0.75}>
            {/* Pending Notes */}
            {pendingNotes.map((note) => {
              const tone = resolveTone(note.type);
              const colors = TONE_COLORS[tone];
              const typeLabel = resolveTypeLabel(note.type, typeLabelMap);
              const isError = note.status === 'error';

              return (
                <Paper
                  key={note.id}
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    p: 0.75,
                    borderRadius: 2,
                    borderStyle: 'dashed',
                    bgcolor: isError ? alpha('#fef2f2', 0.8) : alpha(colors.bg, 0.5),
                    borderColor: isError ? 'error.200' : undefined,
                  }}
                >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 1.5,
                        bgcolor: isError ? 'error.50' : colors.bg,
                        border: '1px dashed',
                        borderColor: isError ? 'error.300' : colors.border,
                        color: isError ? 'error.main' : colors.text,
                        flexShrink: 0,
                      }}
                    >
                      {isError ? (
                        <Typography sx={{ fontSize: 12, lineHeight: 1 }}>!</Typography>
                      ) : (
                        <CircularProgress size={12} sx={{ color: 'inherit' }} />
                      )}
                    </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      fontWeight={500}
                      noWrap
                      sx={{
                        fontSize: '0.6875rem',
                        lineHeight: 1.3,
                        color: isError ? 'error.main' : 'text.primary',
                      }}
                    >
                      {note.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        fontSize: '0.5625rem',
                        lineHeight: 1.2,
                        color: isError ? 'error.light' : 'text.secondary',
                      }}
                    >
                      {note.meta}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}

            {/* Completed Notes */}
            {notes.map((note) => {
              const tone = resolveTone(note.type);
              const colors = TONE_COLORS[tone];
              const typeLabel = resolveTypeLabel(note.type, typeLabelMap);

              return (
                <Paper
                  key={note.id}
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'grey.300',
                      bgcolor: 'grey.50',
                      '& .note-menu': { opacity: 1 },
                    },
                  }}
                >
                  <Button
                    fullWidth
                    onClick={() => {
                      if (!note.outputId) return;
                      onSelectOutput(note.outputId);
                    }}
                    disabled={!note.outputId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      p: 0.75,
                      textTransform: 'none',
                      justifyContent: 'flex-start',
                      color: 'text.primary',
                      minHeight: 32,
                      '&:hover': { bgcolor: 'transparent' },
                    }}
                  >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: 1.5,
                          bgcolor: colors.bg,
                          border: '1px solid',
                          borderColor: colors.border,
                          color: colors.text,
                          flexShrink: 0,
                        }}
                      >
                        {getToolIcon(note.type)}
                      </Box>
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Typography variant="caption" fontWeight={500} noWrap sx={{ fontSize: '0.6875rem', lineHeight: 1.3 }}>
                        {note.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.5625rem', lineHeight: 1.2 }}>
                        {note.meta}
                      </Typography>
                    </Box>
                  </Button>
                  <IconButton
                    size="small"
                    className="note-menu"
                    onClick={(e) => handleNoteMenuOpen(e, note.id)}
                    sx={{
                      mr: 0.5,
                      width: 22,
                      height: 22,
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </Paper>
              );
            })}
          </Stack>
        )}

        {/* Error State */}
        {outputsError && (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="error" sx={{ fontSize: '0.6875rem' }}>
              {outputsError}
            </Typography>
            <Button size="small" onClick={onRetryOutputs} sx={{ minWidth: 'auto', fontSize: '0.6875rem' }}>
              重试
            </Button>
          </Stack>
        )}
      </Box>

      {/* Actions */}
      <Button
        variant="contained"
        fullWidth
        size="small"
        startIcon={<AddIcon fontSize="small" />}
        onClick={handleOpenNoteEditor}
        sx={{ borderRadius: 5, py: 0.75, fontSize: '0.6875rem' }}
      >
        添加笔记
      </Button>

      {/* Note Context Menu */}
      <Menu
        anchorEl={noteMenuAnchor}
        open={Boolean(noteMenuAnchor)}
        onClose={handleNoteMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 140, borderRadius: 2 },
          },
        }}
      >
        <MenuItem onClick={handleConvertToSource} sx={{ fontSize: '0.75rem' }}>
          <ListItemIcon>
            <ConvertIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>转换为来源</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyNote} sx={{ fontSize: '0.75rem' }}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>复制内容</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteNote} sx={{ fontSize: '0.75rem', color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>删除</ListItemText>
        </MenuItem>
      </Menu>

      {/* Tool Config Dialog - Like image 3 */}
      <Dialog
        open={toolConfigOpen}
        onClose={handleToolConfigClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'primary.50',
                color: 'primary.main',
              }}
            >
              {activeToolType && getToolIcon(activeToolType)}
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>
              自定义{activeToolType && resolveTypeLabel(activeToolType, typeLabelMap)}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleToolConfigClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {toolConfigLoading ? (
            <Stack spacing={2}>
              <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
            </Stack>
          ) : (
            <>
              {/* Quantity Selection */}
              {(toolConfig?.quantity_options || !toolConfig) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    数量
                  </Typography>
                  <ToggleButtonGroup
                    value={configQuantity}
                    exclusive
                    onChange={(_, value) => value && setConfigQuantity(value)}
                    size="small"
                    sx={{ gap: 1, flexWrap: 'wrap', '& .MuiToggleButton-root': { borderRadius: 5, px: 2, py: 0.5, border: '1px solid', borderColor: 'divider' } }}
                  >
                    {(toolConfig?.quantity_options || [
                      { id: 'less', label: '更少', is_default: false },
                      { id: 'standard', label: '标准（默认）', is_default: true },
                      { id: 'more', label: '更多', is_default: false },
                    ]).map((option) => (
                      <ToggleButton key={option.id} value={option.id}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          {configQuantity === option.id && option.is_default && <span>✓</span>}
                          <span>{option.label}</span>
                        </Stack>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}

              {/* Difficulty Selection - only show if tool has difficulty options */}
              {(toolConfig?.difficulty_options || (!toolConfig && activeToolType !== 'FAQ' && activeToolType !== 'TIMELINE' && activeToolType !== 'MINDMAP' && activeToolType !== 'BRIEFING')) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    难度等级
                  </Typography>
                  <ToggleButtonGroup
                    value={configDifficulty}
                    exclusive
                    onChange={(_, value) => value && setConfigDifficulty(value)}
                    size="small"
                    sx={{ gap: 1, flexWrap: 'wrap', '& .MuiToggleButton-root': { borderRadius: 5, px: 2, py: 0.5, border: '1px solid', borderColor: 'divider' } }}
                  >
                    {(toolConfig?.difficulty_options || [
                      { id: 'easy', label: '简单', is_default: false },
                      { id: 'medium', label: '中等（默认）', is_default: true },
                      { id: 'hard', label: '困难', is_default: false },
                    ]).map((option) => (
                      <ToggleButton key={option.id} value={option.id}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          {configDifficulty === option.id && option.is_default && <span>✓</span>}
                          <span>{option.label}</span>
                        </Stack>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}

              {/* Topic Input */}
              {(toolConfig?.supports_topic !== false) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    主题应该是什么？
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder={toolConfig?.topic_placeholder || "示例提示\n• 限定特定来源或主题\n• 说明重点关注的方向\n• 提供具体的约束条件"}
                    value={configTopic}
                    onChange={(e) => setConfigTopic(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
              )}

              {/* Model Selection */}
              {!isDemo && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    AI 模型
                  </Typography>
                  <ModelSelector
                    value={configModelId}
                    onChange={setConfigModelId}
                    capability="chat"
                    label="选择生成模型"
                    size="small"
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            onClick={handleGenerateWithConfig}
            sx={{ borderRadius: 5, px: 4 }}
          >
            生成
          </Button>
        </DialogActions>
      </Dialog>

      {/* Note Editor Dialog */}
      <Dialog
        open={noteEditorOpen}
        onClose={handleCloseNoteEditor}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'primary.50',
                color: 'primary.main',
              }}
            >
              <EditIcon fontSize="small" />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>
              新建笔记
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleCloseNoteEditor}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            multiline
            rows={8}
            fullWidth
            placeholder="在此输入笔记内容..."
            value={noteEditorContent}
            onChange={(e) => setNoteEditorContent(e.target.value)}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                fontSize: '0.875rem',
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            支持 Markdown 格式
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseNoteEditor} sx={{ borderRadius: 5 }}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNote}
            disabled={!noteEditorContent.trim()}
            startIcon={<SaveIcon fontSize="small" />}
            sx={{ borderRadius: 5, px: 3 }}
          >
            保存笔记
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default memo(StudioPanel);
