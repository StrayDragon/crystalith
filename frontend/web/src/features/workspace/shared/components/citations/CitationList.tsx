import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Citation } from '../../types';
import CitationItem from './CitationItem';

interface CitationGroup {
  sourceTitle: string;
  citations: Citation[];
}

interface CitationListProps {
  citations: Citation[];
  selectedCitationIds: Set<string>;
  highlightedChunkIds: Set<number>;
  jumpToCitationChunkId: number | null;
  onToggleCitation: (citationId: string) => void;
  onCitationHover: (chunkId: number | null) => void;
}

export default function CitationList({
  citations,
  selectedCitationIds,
  highlightedChunkIds,
  jumpToCitationChunkId,
  onToggleCitation,
  onCitationHover,
}: CitationListProps) {
  const [expandedCitationIds, setExpandedCitationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const citationRefs = useRef(new Map<number, HTMLLIElement | null>());

  const groups = useMemo<CitationGroup[]>(() => {
    const grouped = new Map<string, CitationGroup>();
    for (const citation of citations) {
      const title = citation.sourceTitle || '未知来源';
      if (!grouped.has(title)) {
        grouped.set(title, { sourceTitle: title, citations: [] });
      }
      grouped.get(title)?.citations.push(citation);
    }
    return Array.from(grouped.values());
  }, [citations]);

  const setCitationRef = useCallback(
    (chunkId: number) => (node: HTMLLIElement | null) => {
      citationRefs.current.set(chunkId, node);
    },
    [],
  );

  useEffect(() => {
    if (jumpToCitationChunkId == null) return;
    const node = citationRefs.current.get(jumpToCitationChunkId);
    if (!node) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [jumpToCitationChunkId]);

  function toggleExpanded(citationId: string) {
    setExpandedCitationIds((prev) => {
      const next = new Set(prev);
      if (next.has(citationId)) {
        next.delete(citationId);
      } else {
        next.add(citationId);
      }
      return next;
    });
  }

  return (
    <div className="CitationGroups">
      {groups.map((group) => (
        <div key={group.sourceTitle} className="CitationGroup">
          <div className="CitationGroupHeader">
            <div className="CitationGroupTitle">
              <span className="CitationGroupIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <path
                    d="M13 3v5h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 11h8M8 15h8M8 19h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="CitationGroupName">{group.sourceTitle}</span>
            </div>
            <span className="CitationGroupCount">{group.citations.length} 条引用</span>
          </div>
          <ul className="CitationGroupList">
            {group.citations.map((citation) => {
              const chunkId = citation.chunkId ?? null;
              const isHighlighted =
                chunkId != null && highlightedChunkIds.has(chunkId);
              const isExpanded = expandedCitationIds.has(citation.id);
              return (
                <CitationItem
                  key={citation.id}
                  ref={chunkId != null ? setCitationRef(chunkId) : undefined}
                  citation={citation}
                  isSelected={selectedCitationIds.has(citation.id)}
                  isHighlighted={isHighlighted}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleCitation(citation.id)}
                  onToggleExpand={() => toggleExpanded(citation.id)}
                  onHover={onCitationHover}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
