import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  IconButton,
  Textarea,
  Tooltip,
  Typography,
} from '@material-tailwind/react';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  UnfoldLess as CollapseIcon,
  UnfoldMore as ExpandIcon,
} from '@mui/icons-material';

import type { Citation, OutputItem, OutputTypeId, WorkspaceTool } from '../../shared/types';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import StudioOutputsList from './StudioOutputsList';
import StudioToolsGrid from './StudioToolsGrid';

const TOOLS_COLLAPSED_KEY = 'crystalith:studio-tools-collapsed';

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
    queueStatus?: 'queued' | 'running' | 'error' | 'done' | null;
    queueJobId?: string | null;
  }) => void;
  onDeleteOutput: (outputId: number) => void;
  onSelectOutput: (outputId: number) => void;
  onSelectOutputFullscreen?: (outputId: number) => void;
  onSaveNote?: (content: string) => void;
  onConvertToSource?: (outputId: number) => void;
  onJumpToCitation?: (citation: Citation, citations: Citation[]) => void;
  isConnected: boolean;
  isFullscreen?: boolean;
  hasSelectedSources: boolean;
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

  // ─── Tools area collapsible state ───
  const [toolsCollapsed, setToolsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(TOOLS_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(TOOLS_COLLAPSED_KEY, String(toolsCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [toolsCollapsed]);

  // Single click does nothing (task 4.4); only double-click toggles

  const handleToolsTitleDoubleClick = useCallback(() => {
    setToolsCollapsed((prev) => !prev);
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

  const handleSaveNote = useCallback(() => {
    if (noteEditorContent.trim() && onSaveNote) {
      onSaveNote(noteEditorContent.trim());
    }
    handleCloseNoteEditor();
  }, [noteEditorContent, onSaveNote, handleCloseNoteEditor]);

  return (
    <div className={`flex flex-1 flex-col gap-3 p-3 sm:p-4 min-h-0 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
      {!hasSelectedSources ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          未选择来源，无法生成输出。请先在左侧勾选来源。
        </div>
      ) : null}

      {/* ── Tools area with collapsible header ── */}
      <div className="flex flex-col flex-shrink-0">
        {/* Tools title bar — double-click to collapse/expand */}
        <div
          className="flex items-center gap-1.5 py-1.5 select-none group"
          onDoubleClick={handleToolsTitleDoubleClick}
        >
          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            工具
          </span>
          <Tooltip content={toolsCollapsed ? '双击展开工具区' : '双击收纳工具区'}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToolsCollapsed((prev) => !prev);
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
              aria-label={toolsCollapsed ? '展开工具区' : '收纳工具区'}
            >
              {toolsCollapsed ? (
                <ExpandIcon sx={{ fontSize: 14 }} />
              ) : (
                <CollapseIcon sx={{ fontSize: 14 }} />
              )}
            </button>
          </Tooltip>
          {toolsCollapsed && (
            <span className="text-[9px] text-gray-300 dark:text-slate-600 ml-auto">
              双击展开
            </span>
          )}
        </div>

        {/* Tools grid — animated collapse/expand */}
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            maxHeight: toolsCollapsed ? 0 : 500,
            opacity: toolsCollapsed ? 0 : 1,
          }}
        >
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
      </div>

      {/* ── Outputs list — expands to fill when tools are collapsed ── */}
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

      <Button
        variant="filled"
        fullWidth
        size="sm"
        className="flex items-center justify-center gap-2 rounded-full py-2 bg-slate-900 text-xs normal-case flex-shrink-0"
        onClick={handleOpenNoteEditor}
      >
        <AddIcon style={{ fontSize: 16 }} />
        添加笔记
      </Button>

      <Dialog
        open={noteEditorOpen}
        handler={handleCloseNoteEditor}
        size="sm"
        className="rounded-xl"
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
