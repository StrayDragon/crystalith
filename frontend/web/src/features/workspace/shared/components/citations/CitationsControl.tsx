import { useCallback, useMemo, useState } from "react";
import { FormatQuote as QuoteIcon } from "@mui/icons-material";

import CitationPopover from "./CitationPopover";
import CitationDrawer from "./CitationDrawer";
import type { Citation } from "../../types";

interface CitationsControlProps {
  citations: Citation[];
  onCitationHover?: (chunkId: number | null) => void;
  onLocateSource?: (citation: Citation) => void;
  onOpenSource?: (citation: Citation) => void;
  elevated?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}

export default function CitationsControl({
  citations,
  onCitationHover,
  onLocateSource,
  onOpenSource,
  elevated = false,
  triggerLabel,
  triggerClassName,
}: CitationsControlProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [selected, setSelected] = useState<Citation | null>(null);

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

  const handleSelectCitation = useCallback((citation: Citation) => {
    setSelected(citation);
  }, []);

  if (!citations || citations.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
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
        onJumpToCitation={(citation) => {
          handleSelectCitation(citation);
        }}
        onCitationHover={onCitationHover}
        onLocateSource={onLocateSource}
        elevated={elevated}
      />

      <CitationDrawer
        open={selected != null}
        citation={selected}
        onClose={() => setSelected(null)}
        onLocateSource={(citation) => onLocateSource?.(citation)}
        onOpenSource={(citation) => onOpenSource?.(citation)}
        elevated={elevated}
      />
    </>
  );
}
