import { forwardRef } from 'react';

import type { Citation } from '../../types';
import CitationHighlight from './CitationHighlight';

interface CitationItemProps {
  citation: Citation;
  isSelected: boolean;
  isHighlighted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleExpand: () => void;
  onHover: (chunkId: number | null) => void;
}

const CitationItem = forwardRef<HTMLLIElement, CitationItemProps>(
  (
    {
      citation,
      isSelected,
      isHighlighted,
      isExpanded,
      onToggle,
      onToggleExpand,
      onHover,
    },
    ref,
  ) => {
    const chunkId = citation.chunkId ?? null;
    const shouldClamp = citation.snippet.length > 140;
    const pageLabel = citation.pageNumber ? `第 ${citation.pageNumber} 页` : '页码未知';

    return (
      <li
        ref={ref}
        className={`CitationItem ${isHighlighted ? 'isHighlighted' : ''}`}
        data-chunk-id={chunkId ?? undefined}
        onMouseEnter={() => onHover(chunkId)}
        onMouseLeave={() => onHover(null)}
      >
        <CitationHighlight active={isHighlighted} />
        <input
          type="checkbox"
          className="WorkspaceCheckbox CitationCheckbox"
          checked={isSelected}
          onChange={onToggle}
          aria-label={`选择引用：${citation.sourceTitle} #${citation.chunkIndex}`}
          name={`citation-${citation.id ?? citation.chunkId ?? 'item'}`}
        />
        <div className="CitationContent">
          <div className="CitationMeta">
            <span>{pageLabel}</span>
            <span>#{citation.chunkIndex}</span>
          </div>
          <div
            className={`CitationSnippet ${isExpanded ? 'isExpanded' : ''}`}
          >
            {citation.snippet || '暂无片段'}
          </div>
          {shouldClamp ? (
            <button
              type="button"
              className="CitationExpand"
              onClick={onToggleExpand}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '收起' : '展开'}
            </button>
          ) : null}
        </div>
      </li>
    );
  },
);

CitationItem.displayName = 'CitationItem';

export default CitationItem;
