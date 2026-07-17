import { FormatQuote as QuoteIcon } from '@mui/icons-material';
import { useCallback, useMemo, useState } from 'react';

import type { Citation } from '../../types';
import CitationPopover from './CitationPopover';

interface CitationsControlProps {
  citations: Citation[];
  onLocateSource?: (citation: Citation) => void;
  onOpenSource?: (citation: Citation) => void;
  elevated?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}

export default function CitationsControl({
  citations,
  onLocateSource,
  onOpenSource,
  elevated = false,
  triggerLabel,
  triggerClassName,
}: CitationsControlProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const countLabel = useMemo(() => citations.length, [citations.length]);
  const ariaLabel = triggerLabel ?? `查看全部 ${countLabel} 条引用`;

  const handleOpenPopover = useCallback((rect: DOMRect) => {
    setAnchorRect(rect);
    setPopoverOpen(true);
  }, []);

  const handleClosePopover = useCallback(() => {
    setPopoverOpen(false);
    setAnchorRect(null);
  }, []);

  if (!citations || citations.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer'
        }
        onClick={(e) => handleOpenPopover(e.currentTarget.getBoundingClientRect())}
        aria-label={ariaLabel}
      >
        <QuoteIcon style={{ fontSize: 14 }} />
        查看引用 ({citations.length})
      </button>

      <CitationPopover
        citations={citations}
        isOpen={popoverOpen}
        onClose={handleClosePopover}
        anchorRect={anchorRect}
        onLocateSource={onLocateSource}
        onOpenSource={onOpenSource}
        elevated={elevated}
      />
    </>
  );
}
