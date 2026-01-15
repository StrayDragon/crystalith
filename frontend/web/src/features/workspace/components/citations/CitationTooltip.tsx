import type { Citation } from '../../types';

interface CitationTooltipProps {
  citation: Citation;
}

export default function CitationTooltip({ citation }: CitationTooltipProps) {
  const pageLabel = citation.pageNumber ? `第 ${citation.pageNumber} 页` : '页码未知';
  const chunkLabel = `#${citation.chunkIndex}`;

  return (
    <div className="CitationTooltip" role="tooltip">
      <div className="CitationTooltip__title">{citation.sourceTitle}</div>
      <div className="CitationTooltip__meta">
        {pageLabel} · {chunkLabel}
      </div>
      <div className="CitationTooltip__snippet">{citation.snippet || '暂无片段'}</div>
    </div>
  );
}
