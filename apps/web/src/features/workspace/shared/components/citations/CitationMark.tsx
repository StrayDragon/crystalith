import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../../shared/layer';
import type { Citation } from '../../types';

interface CitationMarkProps {
  index: number;
  citation: Citation;
  onHover: (chunkId: number | null) => void;
  onJump: (chunkId: number | null) => void;
}

export default function CitationMark({ index, citation, onHover, onJump }: CitationMarkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const chunkId = citation.chunkId ?? null;
  const pageLabel = citation.pageNumber ? `第 ${citation.pageNumber} 页` : null;
  const { style: tooltipStyle } = useLayer('tooltip');

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 280;
      const tooltipHeight = 120; // estimated max height
      const gap = 6;

      let top = rect.bottom + gap;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      // Ensure tooltip stays within viewport horizontally
      const minLeft = 8;
      const maxLeft = window.innerWidth - tooltipWidth - 8;
      if (left < minLeft) {
        left = minLeft;
      } else if (left > maxLeft) {
        left = maxLeft;
      }

      // If tooltip would go below viewport, show above the button
      if (top + tooltipHeight > window.innerHeight - 8) {
        top = rect.top - tooltipHeight - gap;
      }

      // Ensure tooltip doesn't go above viewport
      if (top < 8) {
        top = 8;
      }

      setPosition({ top, left });
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  function handleOpen() {
    setIsOpen(true);
    onHover(chunkId);
  }

  function handleClose() {
    setIsOpen(false);
    onHover(null);
  }

  function handleJump() {
    onJump(chunkId);
  }

  const tooltip =
    isOpen && position ? (
      <div
        className="fixed w-[280px] max-w-[90vw] rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-xl pointer-events-none"
        style={{
          ...tooltipStyle,
          top: position.top,
          left: position.left,
        }}
        role="tooltip"
      >
        <div className="text-xs font-semibold truncate text-gray-900">{citation.sourceTitle}</div>
        {pageLabel && (
          <div className="text-[10px] font-medium mt-0.5 text-gray-500">{pageLabel}</div>
        )}
        {citation.snippet && (
          <div className="text-[11px] font-medium mt-1.5 line-clamp-3 leading-relaxed text-gray-500">
            {citation.snippet}
          </div>
        )}
      </div>
    ) : null;

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] font-semibold text-gray-500 transition hover:text-gray-800 cursor-pointer"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={handleJump}
        aria-label={`查看引用 ${index}，来源 ${citation.sourceTitle}，${pageLabel ?? '页码未知'}`}
      >
        [{index}]
      </button>
      {tooltip && createPortal(tooltip, document.body)}
    </span>
  );
}
