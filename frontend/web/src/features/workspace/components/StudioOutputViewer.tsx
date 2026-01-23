import { useMemo, useState, useCallback } from 'react';
import {
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  IconButton,
  Typography,
  Tooltip,
} from '@material-tailwind/react';
import { MoreVert as MoreVertIcon, Delete as DeleteIcon } from '@mui/icons-material';

import type { OutputItem } from '../types';
import { formatRelativeTime } from '../utils';
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
}

function resolveOutputTitle(output: OutputItem): string {
  const content = output.content ?? {};
  const contentTitle = typeof (content as any).title === 'string' ? (content as any).title.trim() : '';
  if (contentTitle) return contentTitle;
  const promptTitle = output.prompt?.trim();
  if (promptTitle) return promptTitle;
  return `${output.type} 输出`;
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
  return `自动生成 · ${relative}`;
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
}: StudioOutputViewerProps) {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const selectedOutput = useMemo(() => {
    if (!selectedOutputId) return outputs[0] ?? null;
    return outputs.find((item) => item.id === selectedOutputId) ?? outputs[0] ?? null;
  }, [outputs, selectedOutputId]);

  const handleDelete = useCallback((outputId: number) => {
    if (outputId && onDeleteOutput) {
      const output = outputs.find((o) => o.id === outputId);
      if (output && window.confirm(`确定要删除「${resolveOutputTitle(output)}」吗？此操作不可撤销。`)) {
        onDeleteOutput(outputId);
        // If deleting currently selected, close viewer if no more outputs
        if (outputId === selectedOutputId && outputs.length <= 1) {
          onClose();
        }
      }
    }
    setActiveMenuId(null);
  }, [onDeleteOutput, outputs, selectedOutputId, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${isFullscreen ? 'p-0' : 'p-4 sm:p-6'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Studio 输出详情"
      onClick={onClose}
    >
      <div
        className={`flex flex-col overflow-hidden bg-white shadow-2xl transition-all ${
          isFullscreen
            ? 'h-full w-full rounded-none'
            : 'h-[85vh] w-[90vw] max-w-6xl rounded-2xl border border-gray-300'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
          <div className="flex flex-col min-w-0">
            <Typography variant="h6" className="text-lg font-semibold text-gray-900 truncate">
              {selectedOutput ? resolveOutputTitle(selectedOutput) : '暂无输出'}
            </Typography>
            <Typography variant="small" className="text-gray-600 font-normal">
              {selectedOutput ? resolveOutputMeta(selectedOutput) : '请先生成输出内容'}
            </Typography>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Tooltip content={isFullscreen ? '退出全屏' : '进入全屏'}>
              <IconButton
                variant="text"
                className="rounded-full"
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
                className="rounded-full"
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
          <aside className="flex flex-col w-64 border-r border-gray-200 bg-gray-100/50 p-3 flex-shrink-0">
            <Typography variant="small" className="mb-2 font-semibold text-gray-600 text-xs px-2">
              输出预览
            </Typography>
            {outputs.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-gray-300 rounded-lg">
                <Typography variant="small" className="text-gray-500">暂无输出</Typography>
              </div>
            ) : (
              <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                {outputs.map((output) => {
                  const isActive = output.id === selectedOutput?.id;
                  return (
                    <div
                      key={output.id}
                      className={`group relative flex items-center rounded-lg transition-colors ${
                        isActive ? 'bg-white shadow-sm border border-gray-300' : 'hover:bg-gray-200 border border-gray-200'
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
                          className={`truncate text-sm ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}
                        >
                          {resolveOutputTitle(output)}
                        </Typography>
                        <Typography variant="small" className="text-[10px] text-gray-500 mt-0.5 truncate">
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
                                className={`rounded-full w-7 h-7 text-gray-500 opacity-0 transition-opacity ${
                                  isActive || activeMenuId === output.id ? 'opacity-100' : 'group-hover:opacity-100'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(output.id);
                                }}
                              >
                                <MoreVertIcon style={{ fontSize: 16 }} />
                              </IconButton>
                            </MenuHandler>
                            <MenuList className="p-1 min-w-[120px]">
                              <MenuItem
                                onClick={() => handleDelete(output.id)}
                                className="flex items-center gap-2 text-red-500 hover:bg-red-50 hover:text-red-700 py-2"
                              >
                                <DeleteIcon style={{ fontSize: 16 }} />
                                <span className="text-xs font-medium">删除</span>
                              </MenuItem>
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
          <section className="flex-1 overflow-y-auto p-6 bg-white">
            {selectedOutput ? <OutputContent output={selectedOutput} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
