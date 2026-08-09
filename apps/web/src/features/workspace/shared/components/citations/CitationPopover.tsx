import { MyLocation as LocateIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useEffect, useRef, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import type { Citation } from '../../types';
import { countUniqueCitationSources, formatCitationScopeLabel } from './citationLabels';

interface CitationPopoverProps {
  /** 引用列表 */
  citations: Citation[];
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 锚点位置（直接传入 DOMRect） */
  anchorRect: DOMRect | null;
  /** 定位到来源回调（在来源列表中高亮） */
  onLocateSource?: (citation: Citation) => void;
  /** 打开来源详情回调 */
  onOpenSource?: (citation: Citation) => void;
  /** 是否提升 z-index（用于从 modal 中打开时） */
  elevated?: boolean;
}

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 400;
const GAP = 8;

type Placement = 'bottom' | 'top';

interface PopoverPosition {
  x: number;
  y: number;
  placement: Placement;
}

/**
 * 计算 popover 位置，自动检测边界并调整
 */
function calculatePosition(anchorRect: DOMRect): PopoverPosition {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // 默认在按钮下方
  let x = anchorRect.left + anchorRect.width / 2;
  let y = anchorRect.bottom;
  let placement: Placement = 'bottom';

  // 检查下方空间是否足够
  const spaceBelow = viewportHeight - anchorRect.bottom - GAP;
  const spaceAbove = anchorRect.top - GAP;

  // 如果下方空间不足且上方空间更大，则显示在上方
  if (spaceBelow < POPOVER_MAX_HEIGHT && spaceAbove > spaceBelow) {
    y = anchorRect.top;
    placement = 'top';
  }

  // 水平边界检查
  const halfWidth = POPOVER_WIDTH / 2;
  if (x - halfWidth < GAP) {
    x = halfWidth + GAP;
  } else if (x + halfWidth > viewportWidth - GAP) {
    x = viewportWidth - halfWidth - GAP;
  }

  return { x, y, placement };
}

export default function CitationPopover({
  citations,
  isOpen,
  onClose,
  anchorRect,
  onLocateSource,
  onOpenSource,
  elevated = false,
}: CitationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { style: popoverStyle } = useLayer('modal', elevated ? 8 : 2);

  // 计算位置（带边界检测）
  const position = useMemo(() => {
    if (!anchorRect) return null;
    return calculatePosition(anchorRect);
  }, [anchorRect]);

  const scopeLabel = useMemo(
    () => formatCitationScopeLabel(countUniqueCitationSources(citations), citations.length),
    [citations],
  );

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target;
      if (popoverRef.current && !(target instanceof Node && popoverRef.current.contains(target))) {
        onClose();
      }
    }

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleLocateSource = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, citation: Citation) => {
      e.preventDefault();
      e.stopPropagation();
      // Blur + close BEFORE locate: jumpToSource used to re-render Chat while
      //「查看引用」still had focus, and Virtuoso scrollTo'd that button into view.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose();
      const target = citation;
      requestAnimationFrame(() => {
        onLocateSource?.(target);
      });
    },
    [onLocateSource, onClose],
  );

  const handleOpenSource = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>, citation: Citation) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose();
      const target = citation;
      requestAnimationFrame(() => {
        onOpenSource?.(target);
      });
    },
    [onOpenSource, onClose],
  );

  const handleRowActivate = useCallback(
    (citation: Citation) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose();
      const target = citation;
      requestAnimationFrame(() => {
        if (onLocateSource) {
          onLocateSource(target);
        } else {
          onOpenSource?.(target);
        }
      });
    },
    [onLocateSource, onOpenSource, onClose],
  );

  if (!isOpen || !position) return null;

  // 根据 placement 决定 transform
  const transform =
    position.placement === 'bottom' ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))';

  const popover = (
    <div className="fixed inset-0 pointer-events-none" style={popoverStyle}>
      <div
        ref={popoverRef}
        className="absolute w-[320px] max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          transform,
          maxHeight: POPOVER_MAX_HEIGHT,
        }}
        role="dialog"
        aria-label={`引用详情：${scopeLabel}`}
        {...tid(TestIds.citationPopover)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <span className="text-sm font-semibold text-gray-900">引用详情 ({scopeLabel})</span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
            aria-label="关闭"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Citation List */}
        <ul className="overflow-y-auto p-2" style={{ maxHeight: POPOVER_MAX_HEIGHT - 52 }}>
          {citations.map((citation, index) => {
            const pageLabel = citation.pageNumber ? `第 ${citation.pageNumber} 页` : null;

            return (
              <li
                key={citation.id}
                className="flex gap-2 p-2.5 rounded-lg transition-colors hover:bg-gray-50 group min-w-0"
              >
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-start gap-3 text-left bg-transparent"
                  onClick={() => {
                    handleRowActivate(citation);
                  }}
                >
                  {/* Index Badge */}
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    {index + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="text-xs font-semibold text-gray-900 truncate">
                      {citation.sourceName}
                    </div>
                    {pageLabel && (
                      <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                        {pageLabel}
                      </div>
                    )}
                    {citation.snippet && (
                      <div className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {citation.snippet}
                      </div>
                    )}
                  </div>
                </button>

                {/* Actions — stay in-card; no second-level drawer */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2 self-start">
                  {onLocateSource && (
                    <button
                      type="button"
                      className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors opacity-70 group-hover:opacity-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        handleLocateSource(e, citation);
                      }}
                      aria-label={`定位来源：${citation.sourceName}`}
                      title="定位来源"
                    >
                      <LocateIcon style={{ fontSize: 14 }} />
                    </button>
                  )}
                  {onOpenSource && (
                    <button
                      type="button"
                      className="w-6 h-6 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors opacity-70 group-hover:opacity-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        handleOpenSource(e, citation);
                      }}
                      aria-label={`打开来源：${citation.sourceName}`}
                      title="打开来源"
                    >
                      <OpenInNewIcon style={{ fontSize: 14 }} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return createPortal(popover, document.body);
}
