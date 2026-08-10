import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  IconButton,
  Textarea,
  Typography,
} from '@material-tailwind/react';
import {
  Add as AddIcon,
  Build as ToolsIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import type { Citation, OutputItem, OutputTypeId, WorkspaceTool } from '../../shared/types';
import StudioOutputsList from './StudioOutputsList';
import StudioToolsGrid from './StudioToolsGrid';

interface StudioPanelProps {
  tools: WorkspaceTool[];
  toolsLoading?: boolean;
  toolsError?: string;
  outputs: OutputItem[];
  outputQueueJobs: OutputQueueJob[];
  outputsLoading: boolean;
  outputsError: string;
  onRetryOutputs: () => void;
  onRetryOutputJob?: (jobId: string) => void;
  onCancelOutputJob?: (jobId: string) => void;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
    queueJobId?: string | null;
  }) => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSelectOutputFullscreen?: (outputId: number) => void;
  onSaveNote?: (content: string) => void | Promise<void>;
  onConvertToSource?: (outputId: number) => void;
  onJumpToCitation?: (citation: Citation, citations: Citation[]) => void;
  isConnected: boolean;
  isFullscreen?: boolean;
  hasSelectedSources: boolean;
}

/* ── ToolsPopover: rendered via Portal to escape overflow clipping ── */
interface ToolsPopoverProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  tools: WorkspaceTool[];
  toolsLoading?: boolean;
  toolsError?: string;
  onGenerateOutput: (type?: OutputTypeId, modelId?: string | null) => void;
  onOpenSlides?: (options?: {
    mode: 'config' | 'preview';
    slideId?: number | null;
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | 'cancelled' | null;
    queueJobId?: string | null;
  }) => void;
  isConnected: boolean;
  isFullscreen?: boolean;
  hasSelectedSources: boolean;
}

function ToolsPopover({
  open,
  onToggle,
  onClose,
  tools,
  toolsLoading,
  toolsError,
  onGenerateOutput,
  onOpenSlides,
  isConnected,
  isFullscreen,
  hasSelectedSources,
}: ToolsPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const { style: backdropLayerStyle } = useLayer('popover');
  const { style: popoverLayerStyle } = useLayer('popover', 1);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right,
        minWidth: '280px',
        width: 'max-content',
        maxWidth: '360px',
        animation: 'slideUp 150ms ease-out',
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        {...tid(TestIds.studioGenerate)}
        className={`w-full flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition-all border ${
          open
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
        }`}
      >
        <ToolsIcon sx={{ fontSize: 14 }} />
        <span>生成</span>
      </button>

      {open &&
        createPortal(
          <>
            {/* Click-outside backdrop */}
            <button
              type="button"
              className="fixed inset-0"
              style={backdropLayerStyle}
              onClick={onClose}
              aria-label="关闭工具面板"
              tabIndex={-1}
            />
            {/* Popover panel — fixed positioning to escape overflow clipping */}
            <div
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl p-3"
              style={{ ...popoverStyle, ...popoverLayerStyle }}
              {...tid(TestIds.studioToolsPopover)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  选择工具
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors text-xs"
                  aria-label="关闭工具面板"
                >
                  ✕
                </button>
              </div>
              <StudioToolsGrid
                tools={tools}
                toolsLoading={toolsLoading}
                toolsError={toolsError}
                onGenerateOutput={onGenerateOutput}
                onOpenSlides={onOpenSlides}
                isConnected={isConnected}
                isFullscreen={isFullscreen}
                hasSelectedSources={hasSelectedSources}
              />
            </div>
          </>,
          document.body,
        )}
    </>
  );
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
  onRetryOutputJob,
  onCancelOutputJob,
  onGenerateOutput,
  onOpenSlides,
  onDeleteOutput,
  onSelectOutput,
  onSelectOutputFullscreen,
  onSaveNote,
  onConvertToSource,
  onJumpToCitation,
  isConnected,
  isFullscreen = false,
  hasSelectedSources,
}: StudioPanelProps) {
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteEditorContent, setNoteEditorContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const noteEditorBodyRef = useRef<HTMLDivElement | null>(null);

  const handleToggleToolsPopover = useCallback(() => {
    setToolsPopoverOpen((prev) => !prev);
  }, []);

  const handleCloseToolsPopover = useCallback(() => {
    setToolsPopoverOpen(false);
  }, []);

  const typeLabelMap = useMemo(() => {
    const map = new Map<OutputTypeId, string>();
    tools.forEach((tool) => {
      map.set(tool.outputType, tool.label);
    });
    return map;
  }, [tools]);

  const handleOpenNoteEditor = useCallback(() => {
    setNoteEditorContent('');
    setNoteEditorOpen(true);
  }, []);

  const handleCloseNoteEditor = useCallback(() => {
    setNoteEditorOpen(false);
    setNoteEditorContent('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    const trimmed = noteEditorContent.trim();
    if (!trimmed || !onSaveNote || noteSaving) return;
    setNoteSaving(true);
    try {
      await onSaveNote(trimmed);
      handleCloseNoteEditor();
    } catch {
      // Error toast/state handled by caller; keep dialog open for retry.
    } finally {
      setNoteSaving(false);
    }
  }, [noteEditorContent, onSaveNote, noteSaving, handleCloseNoteEditor]);

  useEffect(() => {
    if (!noteEditorOpen) return;

    const timer = setTimeout(() => {
      noteEditorBodyRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [noteEditorOpen]);

  return (
    <div
      className={`flex flex-1 flex-col gap-3 p-3 sm:p-4 min-h-0 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}
      {...tid(TestIds.studioPanel)}
    >
      {!hasSelectedSources ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          未选择来源，无法生成输出。请先在左侧勾选来源。
        </div>
      ) : null}

      {/* ── Outputs list — takes all remaining space ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <StudioOutputsList
          outputs={outputs}
          outputQueueJobs={outputQueueJobs}
          outputsLoading={outputsLoading}
          outputsError={outputsError}
          onRetryOutputs={onRetryOutputs}
          onRetryOutputJob={onRetryOutputJob}
          onCancelOutputJob={onCancelOutputJob}
          onDeleteOutput={onDeleteOutput}
          onSelectOutput={onSelectOutput}
          onSelectOutputFullscreen={onSelectOutputFullscreen}
          onConvertToSource={onConvertToSource}
          onJumpToCitation={onJumpToCitation}
          onOpenSlides={onOpenSlides}
          typeLabelMap={typeLabelMap}
        />
      </div>

      {/* ── Bottom action buttons ── */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <Button
          variant="filled"
          fullWidth
          size="sm"
          className="flex items-center justify-center gap-2 rounded-full py-2 bg-slate-900 text-xs normal-case"
          {...tid(TestIds.studioAddNote)}
          onClick={handleOpenNoteEditor}
        >
          <AddIcon style={{ fontSize: 16 }} />
          添加笔记
        </Button>

        {/* ── Generate tools trigger ── */}
        <ToolsPopover
          open={toolsPopoverOpen}
          onToggle={handleToggleToolsPopover}
          onClose={handleCloseToolsPopover}
          tools={tools}
          toolsLoading={toolsLoading}
          toolsError={toolsError}
          onGenerateOutput={(type, modelId) => {
            onGenerateOutput(type, modelId);
            handleCloseToolsPopover();
          }}
          onOpenSlides={(options) => {
            onOpenSlides?.(options);
            handleCloseToolsPopover();
          }}
          isConnected={isConnected}
          isFullscreen={isFullscreen}
          hasSelectedSources={hasSelectedSources}
        />
      </div>

      {/* ── Note editor dialog ── */}
      <Dialog
        open={noteEditorOpen}
        handler={handleCloseNoteEditor}
        size="sm"
        className="rounded-xl"
        data-testid={TestIds.noteEditorDialog}
      >
        <DialogHeader className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700">
              <EditIcon fontSize="small" />
            </div>
            <Typography variant="h6" className="text-sm font-semibold text-slate-900">
              新建笔记
            </Typography>
          </div>
          <IconButton
            variant="text"
            size="sm"
            onClick={handleCloseNoteEditor}
            className="rounded-full"
          >
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </DialogHeader>

        <DialogBody className="p-4">
          <div ref={noteEditorBodyRef}>
            <Textarea
              rows={8}
              placeholder="在此输入笔记内容..."
              value={noteEditorContent}
              onChange={(e) => {
                setNoteEditorContent(e.target.value);
              }}
              className="!border-t-blue-gray-200 focus:!border-t-gray-900"
              labelProps={{
                className: 'before:content-none after:content-none',
              }}
            />
          </div>
          <Typography variant="small" className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            支持 Markdown 格式
          </Typography>
        </DialogBody>

        <DialogFooter className="flex justify-end gap-2 p-4">
          <Button
            variant="text"
            onClick={handleCloseNoteEditor}
            className="rounded-full text-gray-600 dark:text-slate-300 normal-case"
          >
            取消
          </Button>
          <Button
            variant="filled"
            onClick={() => {
              void handleSaveNote();
            }}
            disabled={!noteEditorContent.trim() || noteSaving || !onSaveNote}
            className="flex items-center gap-2 rounded-full bg-slate-900 normal-case"
          >
            <SaveIcon className="h-4 w-4" />
            {noteSaving ? '保存中…' : '保存笔记'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

export default memo(StudioPanel);
