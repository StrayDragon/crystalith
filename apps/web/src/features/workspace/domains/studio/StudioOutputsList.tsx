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
  Cancel as CancelIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { copyToClipboard } from '../../../../shared/clipboard';
import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { LAYER_LEVELS } from '../../../../shared/layer';
import { SkeletonCard } from '../../shared/components/Skeleton';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import { getSlideIdFromOutput } from '../../shared/outputPayload';
import type { Citation, OutputItem, OutputTypeId } from '../../shared/types';
import { collectOutputCitations, formatStructuredOutputForCopy } from '../../shared/utils';
import { EXPORT_FORMAT_LABELS } from '../outputs/exporters';
import { useExport } from '../outputs/useExport';
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
  onRetryOutputJob?: (jobId: string) => void;
  onCancelOutputJob?: (jobId: string) => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSelectOutputFullscreen?: (outputId: number) => void;
  onConvertToSource?: (outputId: number) => void;
  onJumpToCitation?: (citation: Citation, citations: Citation[]) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
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
  citations: Citation[];
};

type PendingNote = {
  id: string;
  title: string;
  meta: string;
  type: OutputTypeId;
  status: 'queued' | 'running' | 'error' | 'cancelled';
  slideId?: number | null;
  queueJobId?: string;
};

type StudioListItem =
  | { kind: 'pending'; key: string; note: PendingNote }
  | { kind: 'output'; key: string; note: StudioNote };

export default function StudioOutputsList({
  outputs,
  outputQueueJobs,
  outputsLoading,
  outputsError,
  onRetryOutputs,
  onRetryOutputJob,
  onCancelOutputJob,
  onDeleteOutput,
  onSelectOutput,
  onSelectOutputFullscreen,
  onConvertToSource,
  onJumpToCitation: _onJumpToCitation,
  onOpenSlides,
  typeLabelMap,
}: StudioOutputsListProps) {
  const handleCopyNote = useCallback(
    async (note: StudioNote) => {
      if (!note.outputId) return;
      const output = outputs.find((item) => item.id === note.outputId);
      if (!output) return;
      const formatted = formatStructuredOutputForCopy(output);
      const text = formatted || output.prompt || note.title;
      await copyToClipboard(text);
    },
    [outputs],
  );

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

  const { isExporting, activeFormat, getSupportedFormats, exportOutput } = useExport();

  const outputNotes = useMemo<StudioNote[]>(
    () =>
      outputs.map((output) => ({
        id: `${output.id}`,
        outputId: output.id,
        slideId: getSlideIdFromOutput(output),
        title: resolveOutputTitle(output),
        meta: resolveNoteMeta(output),
        type: output.type,
        citations: collectOutputCitations(output.content),
      })),
    [outputs],
  );

  const pendingNotes = useMemo<PendingNote[]>(() => {
    const statusLabels = {
      queued: '排队中',
      running: '生成中',
      error: '生成失败',
      cancelled: '已取消',
    } satisfies Record<PendingNote['status'], string>;
    return outputQueueJobs
      .filter(
        (job) =>
          job.status === 'queued' ||
          job.status === 'running' ||
          job.status === 'error' ||
          job.status === 'cancelled',
      )
      .map((job) => {
        const typeLabel = resolveTypeLabel(job.type, typeLabelMap);
        const sourceLabel = job.sourceIds.length
          ? `基于 ${job.sourceIds.length} 个来源`
          : '未选择来源';
        const statusLabel = statusLabels[job.status as PendingNote['status']] || job.status;
        return {
          id: `pending-${job.id}`,
          title:
            job.status === 'error'
              ? `${typeLabel} 生成失败`
              : job.status === 'cancelled'
                ? `${typeLabel} 已取消`
                : `生成${typeLabel}...`,
          meta: `${sourceLabel} · ${statusLabel}`,
          type: job.type,
          status: job.status as PendingNote['status'],
          slideId: job.type === 'SLIDES' ? (job.draftId ?? null) : null,
          queueJobId: job.id,
        };
      });
  }, [outputQueueJobs, typeLabelMap]);

  const notes = outputNotes;
  const showSkeleton = outputsLoading && notes.length === 0 && pendingNotes.length === 0;
  const showEmpty = !outputsLoading && notes.length === 0 && pendingNotes.length === 0;

  const listItems = useMemo<StudioListItem[]>(
    () => [
      ...pendingNotes.map((note) => ({ kind: 'pending' as const, key: note.id, note })),
      ...notes.map((note) => ({ kind: 'output' as const, key: note.id, note })),
    ],
    [notes, pendingNotes],
  );

  return (
    <div className="flex-1 min-h-0 pr-1">
      {showSkeleton && (
        <div className="flex flex-col gap-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </div>
      )}

      {showEmpty && (
        <div className="p-4 text-center border border-dashed border-gray-300 dark:border-slate-600 rounded-xl bg-gray-100 dark:bg-slate-800">
          <Typography variant="small" className="text-gray-700 dark:text-slate-200 font-semibold">
            选择来源 → 点击工具卡片生成
          </Typography>
          <Typography
            variant="small"
            className="text-[11px] text-gray-500 dark:text-slate-400 mt-1"
          >
            生成后的内容会显示在这里，可继续转换为来源或导出。
          </Typography>
        </div>
      )}

      {!showSkeleton && !showEmpty && (
        <Virtuoso
          className="h-full"
          data={listItems}
          computeItemKey={(_index, item) => item.key}
          itemContent={(_index, item) => {
            if (item.kind === 'pending') {
              const note = item.note;
              const tone = resolveTone(note.type);
              const colors = TONE_COLORS[tone];
              const isError = note.status === 'error';
              const isCancelled = note.status === 'cancelled';
              const canOpenSlides = note.type === 'SLIDES' && note.slideId;

              const content = (
                <>
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-md border border-dashed flex-shrink-0 ${
                      isError
                        ? 'bg-red-50 border-red-300 text-red-500'
                        : isCancelled
                          ? 'bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500'
                          : ''
                    }`}
                    style={
                      !isError
                        ? {
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            color: colors.text,
                          }
                        : undefined
                    }
                  >
                    {isError ? (
                      <span className="text-xs font-bold">!</span>
                    ) : isCancelled ? (
                      <CancelIcon className="h-3 w-3" />
                    ) : (
                      <Spinner className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Typography
                      variant="small"
                      className={`font-medium leading-snug truncate ${
                        isError
                          ? 'text-red-700'
                          : isCancelled
                            ? 'text-gray-600 dark:text-slate-300'
                            : 'text-gray-900 dark:text-slate-100'
                      }`}
                    >
                      {note.title}
                    </Typography>
                    <Typography
                      variant="small"
                      className={`text-[10px] font-medium leading-tight ${
                        isError
                          ? 'text-red-500'
                          : isCancelled
                            ? 'text-gray-500 dark:text-slate-400'
                            : 'text-gray-600 dark:text-slate-300'
                      }`}
                    >
                      {note.meta}
                    </Typography>
                  </div>
                </>
              );

              if (canOpenSlides && !isError) {
                return (
                  <div
                    className={`flex items-center gap-2 p-2 rounded-lg border border-dashed mb-2 ux-slide-in ${
                      isCancelled
                        ? 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                        : ''
                    }`}
                    style={
                      !isCancelled
                        ? { backgroundColor: `${colors.bg}80`, borderColor: colors.border }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left transition-colors hover:bg-white/70 dark:hover:bg-slate-800 rounded"
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
                    {!isCancelled && onCancelOutputJob && note.queueJobId ? (
                      <button
                        type="button"
                        className="flex-shrink-0 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                        onClick={() => onCancelOutputJob(note.queueJobId!)}
                      >
                        取消
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg border border-dashed mb-2 ux-slide-in ${
                    isError
                      ? 'bg-red-50/80 border-red-200'
                      : isCancelled
                        ? 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                        : ''
                  }`}
                  style={
                    !isError && !isCancelled
                      ? { backgroundColor: `${colors.bg}80`, borderColor: colors.border }
                      : undefined
                  }
                >
                  {content}
                  {isError && onRetryOutputJob && note.queueJobId ? (
                    <button
                      type="button"
                      className="flex-shrink-0 rounded-md border border-red-300 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                      onClick={() => onRetryOutputJob(note.queueJobId!)}
                    >
                      重试
                    </button>
                  ) : null}
                  {!isError && !isCancelled && onCancelOutputJob && note.queueJobId ? (
                    <button
                      type="button"
                      className="flex-shrink-0 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                      onClick={() => onCancelOutputJob(note.queueJobId!)}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              );
            }

            const note = item.note;
            const tone = resolveTone(note.type);
            const colors = TONE_COLORS[tone];
            const output = note.outputId
              ? (outputs.find((candidate) => candidate.id === note.outputId) ?? null)
              : null;
            const exportFormats = output ? getSupportedFormats(output.type) : [];

            return (
              <div className="group relative flex items-center rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 mb-2 ux-slide-in">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 p-2 text-left min-w-0"
                  data-testid="studio-output-item"
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
                      className="font-medium text-gray-900 dark:text-slate-100 leading-snug truncate text-[11px]"
                    >
                      {note.title}
                    </Typography>
                    <Typography
                      variant="small"
                      className="text-[10px] text-gray-500 dark:text-slate-400 font-medium leading-tight truncate"
                    >
                      {note.meta}
                    </Typography>
                  </div>
                </button>

                <div className="flex-shrink-0 pr-1">
                  <Menu placement="bottom-end">
                    <MenuHandler>
                      <IconButton
                        variant="text"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 min-w-[28px] rounded-full hover:bg-gray-200 text-gray-500 dark:text-slate-400 transition-opacity"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    </MenuHandler>
                    <MenuList
                      className="p-1 min-w-[140px]"
                      style={{ zIndex: LAYER_LEVELS.dropdown }}
                    >
                      {onSelectOutputFullscreen && note.outputId && (
                        <MenuItem
                          onClick={() => onSelectOutputFullscreen(note.outputId!)}
                          className="flex items-center gap-2 py-2 px-3 text-xs"
                        >
                          <OpenInFullIcon className="h-3.5 w-3.5" />
                          <span>放大查看</span>
                        </MenuItem>
                      )}
                      {output &&
                        exportFormats.map((format) => (
                          <MenuItem
                            key={`${note.id}-${format}`}
                            onClick={() => {
                              void exportOutput(output, format);
                            }}
                            className="flex items-center justify-between gap-2 py-2 px-3 text-xs"
                            disabled={isExporting}
                          >
                            <span className="inline-flex items-center gap-2">
                              <DownloadIcon className="h-3.5 w-3.5" />
                              导出为 {EXPORT_FORMAT_LABELS[format]}
                            </span>
                            {isExporting && activeFormat === format ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : null}
                          </MenuItem>
                        ))}
                      <MenuItem
                        onClick={() => handleConvertToSource(note.id)}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                      >
                        <ConvertIcon className="h-3.5 w-3.5" />
                        <span>转换为来源</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => handleCopyNote(note)}
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
          }}
        />
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
            className="px-2 py-1 h-6 min-h-0 text-[11px] text-gray-800 dark:text-slate-200"
          >
            重试
          </Button>
        </div>
      )}
    </div>
  );
}
