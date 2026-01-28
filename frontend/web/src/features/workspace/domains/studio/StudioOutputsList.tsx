import { useCallback, useMemo } from 'react';
import {
  Button,
  IconButton,
  Menu,
  MenuHandler,
  MenuItem,
  MenuList,
  Spinner,
  Typography,
} from '@material-tailwind/react';
import {
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  DriveFileMove as ConvertIcon,
  MoreHoriz as MoreHorizIcon,
  OpenInFull as OpenInFullIcon,
} from '@mui/icons-material';

import type { OutputItem, OutputTypeId } from '../../shared/types';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { LAYER_LEVELS } from '../../../../shared/layer';
import {
  getToolIcon,
  resolveNoteMeta,
  resolveOutputTitle,
  resolveTone,
  resolveTypeLabel,
  TONE_COLORS,
} from './studioUtils';

interface StudioOutputsListProps {
  outputs: OutputItem[];
  outputQueueJobs: OutputQueueJob[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSelectOutputFullscreen?: (outputId: number) => void;
  onConvertToSource?: (outputId: number) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
    queueJobId?: string | null;
  }) => void;
  typeLabelMap: Map<OutputTypeId, string>;
}

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

export default function StudioOutputsList({
  outputs,
  outputQueueJobs,
  outputsLoading,
  outputsError,
  onRetryOutputs,
  onDeleteOutput,
  onSelectOutput,
  onSelectOutputFullscreen,
  onConvertToSource,
  onOpenSlides,
  typeLabelMap,
}: StudioOutputsListProps) {
  const handleCopyNote = useCallback(() => {
    // TODO: Implement copy to clipboard
  }, []);

  const handleDeleteNote = useCallback(
    (id: string) => {
      if (!id) return;
      const outputId = parseInt(id, 10);
      if (!isNaN(outputId)) {
        onDeleteOutput(outputId);
      }
    },
    [onDeleteOutput],
  );

  const handleConvertToSource = useCallback(
    (id: string) => {
      if (!id) return;
      const outputId = parseInt(id, 10);
      if (!isNaN(outputId) && onConvertToSource) {
        onConvertToSource(outputId);
      }
    },
    [onConvertToSource],
  );

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

  const notes = outputNotes;
  const showSkeleton = outputsLoading && notes.length === 0 && pendingNotes.length === 0;
  const showEmpty = !outputsLoading && notes.length === 0 && pendingNotes.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      {showSkeleton && (
        <div className="flex flex-col gap-2">
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-10 w-2/3 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      )}

      {showEmpty && (
        <div className="p-4 text-center border border-dashed border-gray-300 rounded-xl bg-gray-100">
          <Typography variant="small" className="text-gray-600 font-medium">
            暂无笔记
          </Typography>
        </div>
      )}

      {!showSkeleton && !showEmpty && (
        <div className="flex flex-col gap-2">
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

          {notes.map((note) => {
            const tone = resolveTone(note.type);
            const colors = TONE_COLORS[tone];

            return (
              <div
                key={note.id}
                className="group relative flex items-center rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300"
              >
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
                      <ConfirmPopover
                        message="确定要删除此输出吗？此操作不可撤销。"
                        onConfirm={() => handleDeleteNote(note.id)}
                        placement="left"
                      >
                        <MenuItem className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700">
                          <DeleteIcon className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </MenuItem>
                      </ConfirmPopover>
                    </MenuList>
                  </Menu>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
  );
}
