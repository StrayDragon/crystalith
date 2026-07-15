import {
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  IconButton,
  Typography,
  Tooltip,
} from '@material-tailwind/react';
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useMemo, useState, useCallback } from 'react';

import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { useLayer } from '../../../../shared/layer';
import CitationsControl from '../../shared/components/citations/CitationsControl';
import {
  exportOutputJsonDownload,
  exportOutputMarkdownDownload,
} from '../../shared/evidenceExport';
import { getOutputTitle } from '../../shared/outputPayload';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { Citation, OutputItem } from '../../shared/types';
import { collectOutputCitations, formatRelativeTime } from '../../shared/utils';
import OutputContent from './OutputContent';

interface StudioOutputViewerProps {
  outputs: OutputItem[];
  selectedOutputId: number | null;
  isOpen: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onSelectOutput: (outputId: number) => void;
  onDeleteOutput?: (outputId: number) => void;
  onJumpToCitation?: (citation: Citation, citations: Citation[]) => void;
  onCitationHover?: (chunkId: number | null) => void;
  onLocateSource?: (citation: Citation) => void;
  /** 是否提升 z-index（用于从其他 modal 如知识图谱中打开时） */
  elevated?: boolean;
}

function resolveOutputMeta(output: OutputItem): string {
  const count = output.chunkIds?.length ?? 0;
  const relative =
    formatRelativeTime(output.createdAtRaw ?? output.updatedAtRaw) ||
    output.createdAt ||
    output.updatedAt ||
    '刚刚';
  if (count > 0) {
    return `基于 ${count} 个来源 · ${relative}`;
  }
  return `未选择来源 · ${relative}`;
}

export default function StudioOutputViewer({
  outputs,
  selectedOutputId,
  isOpen,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  onSelectOutput,
  onDeleteOutput,
  onJumpToCitation,
  onCitationHover,
  onLocateSource,
  elevated = false,
}: StudioOutputViewerProps) {
  const notebookId = useWorkspaceStore((s) => s.activeNotebookId);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const selectedOutput = useMemo(() => {
    if (!selectedOutputId) return outputs[0] ?? null;
    return outputs.find((item) => item.id === selectedOutputId) ?? outputs[0] ?? null;
  }, [outputs, selectedOutputId]);
  const outputCitations = useMemo(
    () => (selectedOutput ? collectOutputCitations(selectedOutput.content) : []),
    [selectedOutput],
  );

  const handleDelete = useCallback(
    (outputId: number) => {
      if (outputId && onDeleteOutput) {
        onDeleteOutput(outputId);
        // If deleting currently selected, close viewer if no more outputs
        if (outputId === selectedOutputId && outputs.length <= 1) {
          onClose();
        }
      }
      setActiveMenuId(null);
    },
    [onDeleteOutput, outputs, selectedOutputId, onClose],
  );

  // 使用 slot 参数来提升 z-index（当从其他 modal 如知识图谱中打开时）
  const { style: modalStyle } = useLayer('modal', elevated ? 10 : 0);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm ${isFullscreen ? 'p-0' : 'p-4 sm:p-6'}`}
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Studio 输出详情"
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="关闭"
        tabIndex={-1}
      />
      {/* position:relative so this modal content stacks ABOVE the
           absolute inset-0 backdrop sibling; without it the backdrop
           captures all pointer events including scroll/click on content.
           See PROGRESS.v2.e2e.md K14. */}
      <div
        className={`relative flex flex-col overflow-hidden bg-white shadow-2xl transition-all dark:bg-slate-900 ${
          isFullscreen
            ? 'h-full w-full rounded-none'
            : 'h-[85vh] w-[90vw] max-w-6xl rounded-2xl border border-gray-300 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-slate-700">
          <div className="flex flex-col min-w-0">
            <Typography
              variant="h6"
              className="text-lg font-semibold text-gray-900 truncate dark:text-slate-100"
            >
              {selectedOutput ? getOutputTitle(selectedOutput) : '暂无输出'}
            </Typography>
            <Typography variant="small" className="text-gray-600 font-medium dark:text-slate-300">
              {selectedOutput ? resolveOutputMeta(selectedOutput) : '请先生成输出内容'}
            </Typography>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedOutput && notebookId ? (
              <Menu placement="bottom-end">
                <MenuHandler>
                  <Tooltip content="导出">
                    <IconButton
                      variant="text"
                      className="rounded-full text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      aria-label="导出"
                    >
                      <DownloadIcon style={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </MenuHandler>
                <MenuList className="p-1 min-w-[160px] dark:bg-slate-900 dark:border-slate-700">
                  <MenuItem
                    onClick={() =>
                      exportOutputMarkdownDownload({ notebookId, outputId: selectedOutput.id })
                    }
                    className="flex items-center gap-2 py-2 px-3 text-xs"
                  >
                    <span>导出 Markdown</span>
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      void exportOutputJsonDownload({ notebookId, outputId: selectedOutput.id })
                    }
                    className="flex items-center gap-2 py-2 px-3 text-xs"
                  >
                    <span>导出 JSON</span>
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : null}
            <Tooltip content={isFullscreen ? '退出全屏' : '进入全屏'}>
              <IconButton
                variant="text"
                className="rounded-full text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={onToggleFullscreen}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
                  <path
                    d="M7 9V7h2M17 9V7h-2M7 15v2h2M17 15v2h-2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </IconButton>
            </Tooltip>
            <Tooltip content="关闭">
              <IconButton
                variant="text"
                className="rounded-full text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={onClose}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
                  <path
                    d="M7 7l10 10M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </IconButton>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <aside className="flex flex-col w-64 border-r border-gray-200 bg-gray-100/50 p-3 flex-shrink-0 dark:border-slate-700 dark:bg-slate-800/60">
            <Typography
              variant="small"
              className="mb-2 font-semibold text-gray-600 text-xs px-2 dark:text-slate-300"
            >
              输出预览
            </Typography>
            {outputs.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-gray-300 rounded-lg dark:border-slate-600">
                <Typography variant="small" className="text-gray-500 dark:text-slate-400">
                  暂无输出
                </Typography>
              </div>
            ) : (
              <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                {outputs.map((output) => {
                  const isActive = output.id === selectedOutput?.id;
                  return (
                    <div
                      key={output.id}
                      className={`group relative flex items-center rounded-lg transition-colors ${
                        isActive
                          ? 'bg-white shadow-sm border border-gray-300 dark:bg-slate-800 dark:border-slate-600'
                          : 'hover:bg-gray-200 border border-gray-200 dark:hover:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex-1 text-left p-2 min-w-0"
                        onClick={() => onSelectOutput(output.id)}
                        aria-current={isActive}
                      >
                        <Typography
                          variant="small"
                          className={`truncate text-sm ${isActive ? 'font-semibold text-gray-900 dark:text-slate-100' : 'font-medium text-gray-800 dark:text-slate-300'}`}
                        >
                          {getOutputTitle(output)}
                        </Typography>
                        <Typography
                          variant="small"
                          className="text-[10px] text-gray-500 font-medium mt-0.5 truncate dark:text-slate-400"
                        >
                          {resolveOutputMeta(output)}
                        </Typography>
                      </button>
                      {onDeleteOutput && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                          <Menu placement="bottom-end">
                            <MenuHandler>
                              <IconButton
                                variant="text"
                                size="sm"
                                className={`rounded-full w-7 h-7 text-gray-500 opacity-0 transition-opacity dark:text-slate-300 dark:hover:bg-slate-700 ${
                                  isActive || activeMenuId === output.id
                                    ? 'opacity-100'
                                    : 'group-hover:opacity-100'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(output.id);
                                }}
                              >
                                <MoreVertIcon style={{ fontSize: 16 }} />
                              </IconButton>
                            </MenuHandler>
                            <MenuList className="p-1 min-w-[120px] dark:bg-slate-900 dark:border-slate-700">
                              <ConfirmPopover
                                message={`确定要删除「${getOutputTitle(output)}」吗？此操作不可撤销。`}
                                onConfirm={() => handleDelete(output.id)}
                                placement="left"
                              >
                                <MenuItem className="flex items-center gap-2 text-red-500 hover:bg-red-50 hover:text-red-700 py-2 dark:hover:bg-red-500/20 dark:hover:text-red-300">
                                  <DeleteIcon style={{ fontSize: 16 }} />
                                  <span className="text-xs font-medium">删除</span>
                                </MenuItem>
                              </ConfirmPopover>
                            </MenuList>
                          </Menu>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
          <section className="flex-1 min-h-0 overflow-y-auto p-6 bg-white dark:bg-slate-900">
            {selectedOutput ? (
              <OutputContent
                output={selectedOutput}
                onDelete={onDeleteOutput ? (id) => handleDelete(id) : undefined}
              />
            ) : null}
            {outputCitations.length > 0 ? (
              <div className="mt-6 border-t border-gray-100 pt-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <Typography
                    variant="small"
                    className="text-xs font-semibold text-gray-600 dark:text-slate-300"
                  >
                    引用
                  </Typography>
                  <CitationsControl
                    citations={outputCitations}
                    onCitationHover={onCitationHover}
                    onLocateSource={onLocateSource}
                    onOpenSource={(citation) => onJumpToCitation?.(citation, outputCitations)}
                    elevated
                    triggerClassName="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
