import { FormatQuote as QuoteIcon } from '@mui/icons-material';
import { useCallback, useMemo, useState } from 'react';

import type { Citation } from '../../types';
import { countUniqueCitationSources, formatCitationScopeLabel } from './citationLabels';
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

  const chunkCount = citations.length;
  const sourceCount = useMemo(() => countUniqueCitationSources(citations), [citations]);
  const scopeLabel = useMemo(
    () => formatCitationScopeLabel(sourceCount, chunkCount),
    [sourceCount, chunkCount],
  );
  const ariaLabel = triggerLabel ?? `查看引用：${scopeLabel}`;

  const handleOpenPopover = useCallback((rect: DOMRect) => {
    setAnchorRect(rect);
    setPopoverOpen(true);
  }, []);

  const handleClosePopover = useCallback(() => {
    setPopoverOpen(false);
    setAnchorRect(null);
    // Prefer preventScroll if focus returns to the trigger later.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
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
        查看引用 ({scopeLabel})
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
