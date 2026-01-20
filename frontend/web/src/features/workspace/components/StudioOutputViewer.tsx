import { useMemo } from 'react';

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
}: StudioOutputViewerProps) {
  const selectedOutput = useMemo(() => {
    if (!selectedOutputId) return outputs[0] ?? null;
    return outputs.find((item) => item.id === selectedOutputId) ?? outputs[0] ?? null;
  }, [outputs, selectedOutputId]);

  if (!isOpen) return null;

  return (
    <div
      className={`StudioViewerOverlay ${isFullscreen ? 'isFullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Studio 输出详情"
      onClick={onClose}
    >
      <div
        className={`StudioViewer ${isFullscreen ? 'isFullscreen' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="StudioViewerHeader">
          <div className="StudioViewerHeading">
            <div className="StudioViewerTitle">
              {selectedOutput ? resolveOutputTitle(selectedOutput) : '暂无输出'}
            </div>
            <div className="StudioViewerMeta">
              {selectedOutput ? resolveOutputMeta(selectedOutput) : '请先生成输出内容'}
            </div>
          </div>
          <div className="StudioViewerActions">
            <button
              type="button"
              className="StudioViewerAction"
              aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
              onClick={onToggleFullscreen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M7 9V7h2M17 9V7h-2M7 15v2h2M17 15v2h-2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="StudioViewerAction"
              aria-label="关闭"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M7 7l10 10M17 7L7 17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="StudioViewerBody">
          <aside className="StudioViewerSidebar">
            <div className="StudioViewerSidebarTitle">输出预览</div>
            {outputs.length === 0 ? (
              <div className="StudioViewerEmpty">暂无输出</div>
            ) : (
              <div className="StudioViewerPreviewList" role="list">
                {outputs.map((output) => {
                  const isActive = output.id === selectedOutput?.id;
                  return (
                    <button
                      key={output.id}
                      type="button"
                      className={`StudioViewerPreviewItem ${isActive ? 'isActive' : ''}`}
                      onClick={() => onSelectOutput(output.id)}
                      aria-current={isActive}
                    >
                      <span className="StudioViewerPreviewTitle">
                        {resolveOutputTitle(output)}
                      </span>
                      <span className="StudioViewerPreviewMeta">
                        {resolveOutputMeta(output)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
          <section className="StudioViewerContent">
            {selectedOutput ? <OutputContent output={selectedOutput} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
