import { useState } from 'react';

import type { Citation } from '../../types';
import CitationTooltip from './CitationTooltip';

interface CitationMarkProps {
  index: number;
  citation: Citation;
  onHover: (chunkId: number | null) => void;
  onJump: (chunkId: number | null) => void;
}

export default function CitationMark({ index, citation, onHover, onJump }: CitationMarkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const chunkId = citation.chunkId ?? null;
  const pageLabel = citation.pageNumber ? `第 ${citation.pageNumber} 页` : '页码未知';

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

  return (
    <span className="CitationMarkWrapper">
      <button
        type="button"
        role="button"
        tabIndex={0}
        className="CitationMark"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={handleJump}
        aria-label={`查看引用 ${index}，来源 ${citation.sourceTitle}，${pageLabel}`}
      >
        [{index}]
      </button>
      {isOpen ? <CitationTooltip citation={citation} /> : null}
    </span>
  );
}
