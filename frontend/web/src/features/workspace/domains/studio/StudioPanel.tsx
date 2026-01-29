import { memo, useCallback, useMemo, useState } from 'react';
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
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

import type { OutputItem, OutputTypeId, WorkspaceTool } from '../../shared/types';
import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
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
  isConnected: boolean;
  isFullscreen?: boolean;
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
  isConnected,
  isFullscreen = false,
}: StudioPanelProps) {
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteEditorContent, setNoteEditorContent] = useState('');

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
      <StudioToolsGrid
        tools={tools}
        toolsLoading={toolsLoading}
        toolsError={toolsError}
        onGenerateOutput={onGenerateOutput}
        onOpenSlides={onOpenSlides}
        isConnected={isConnected}
        isFullscreen={isFullscreen}
      />

      <StudioOutputsList
        outputs={outputs}
        outputQueueJobs={outputQueueJobs}
        outputsLoading={outputsLoading}
        outputsError={outputsError}
        onRetryOutputs={onRetryOutputs}
        onDeleteOutput={onDeleteOutput}
        onSelectOutput={onSelectOutput}
        onSelectOutputFullscreen={onSelectOutputFullscreen}
        onConvertToSource={onConvertToSource}
        onOpenSlides={onOpenSlides}
        typeLabelMap={typeLabelMap}
      />

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
