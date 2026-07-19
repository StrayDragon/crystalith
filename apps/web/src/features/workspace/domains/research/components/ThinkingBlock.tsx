import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { type CSSProperties } from 'react';

import { TypewriterText } from './TypewriterText';

interface ThinkingBlockProps {
  item: {
    type: string;
    message: string;
    timestamp: number;
    iteration?: number;
    queries?: string[];
  };
  isLatest: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onTypewriterComplete: () => void;
}

const THINKING_BLOCK_VISIBILITY_STYLE: CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '120px 80px',
};

const typeStyles: Record<string, { bg: string; border: string }> = {
  start: { bg: 'bg-blue-50', border: 'border-blue-200' },
  planning: { bg: 'bg-blue-50', border: 'border-blue-200' },
  reasoning: { bg: 'bg-purple-50', border: 'border-purple-200' },
  plan_generated: { bg: 'bg-indigo-50', border: 'border-indigo-200' },
  searching: { bg: 'bg-cyan-50', border: 'border-cyan-200' },
  search_complete: { bg: 'bg-teal-50', border: 'border-teal-200' },
  search_result: { bg: 'bg-teal-50', border: 'border-teal-200' },
  analyzing: { bg: 'bg-amber-50', border: 'border-amber-200' },
  analysis_complete: { bg: 'bg-orange-50', border: 'border-orange-200' },
  insight: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
  decision: { bg: 'bg-rose-50', border: 'border-rose-200' },
  new_iteration: { bg: 'bg-violet-50', border: 'border-violet-200' },
  generating_report: { bg: 'bg-green-50', border: 'border-green-200' },
  report_complete: { bg: 'bg-emerald-50', border: 'border-emerald-200' },
  waiting_user: { bg: 'bg-gray-50', border: 'border-gray-200' },
  completed: { bg: 'bg-green-50', border: 'border-green-200' },
  connection: { bg: 'bg-gray-50', border: 'border-gray-200' },
};

export function ThinkingBlock({
  item,
  isLatest,
  isCollapsed,
  onToggle,
  onTypewriterComplete,
}: ThinkingBlockProps) {
  const style = typeStyles[item.type] || { bg: 'bg-gray-50', border: 'border-gray-200' };

  // Collapsed view - show first line (which includes emoji from backend)
  if (isCollapsed && !isLatest) {
    return (
      <button
        onClick={onToggle}
        className={`w-full text-left text-sm p-2 rounded-lg border ${style.bg} ${style.border} hover:brightness-95 transition-all flex items-center gap-2 group`}
        style={THINKING_BLOCK_VISIBILITY_STYLE}
      >
        <span className="text-gray-600 truncate flex-1 text-xs">
          {item.message.split('\n')[0].slice(0, 50)}...
        </span>
        <KeyboardArrowDownIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
      </button>
    );
  }

  const content = (
    <div className="flex-1 min-w-0">
      <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
        {isLatest ? (
          <TypewriterText text={item.message} speed={20} onComplete={onTypewriterComplete} />
        ) : (
          item.message
        )}
      </p>
      {/* Display search queries if present */}
      {item.queries && item.queries.length > 0 && (
        <div className="mt-2 space-y-1">
          {(() => {
            const queryCounts = new Map<string, number>();
            return item.queries.map((query) => {
              const ordinal = queryCounts.get(query) ?? 0;
              queryCounts.set(query, ordinal + 1);
              const queryKey = `${query}:${ordinal}`;
              return (
                <div
                  key={queryKey}
                  className="flex items-start gap-2 text-xs bg-white/50 rounded px-2 py-1.5 border border-gray-200/50"
                >
                  <SearchIcon className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{query}</span>
                </div>
              );
            });
          })()}
        </div>
      )}
      {item.iteration && <p className="text-xs text-gray-400 mt-1">第 {item.iteration} 轮</p>}
    </div>
  );

  if (!isLatest) {
    return (
      <button
        type="button"
        className={`w-full text-left text-sm p-3 rounded-lg border ${style.bg} ${style.border} transition-all cursor-pointer hover:brightness-95`}
        style={THINKING_BLOCK_VISIBILITY_STYLE}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`text-sm p-3 rounded-lg border ${style.bg} ${style.border} transition-all`}
      style={THINKING_BLOCK_VISIBILITY_STYLE}
    >
      {content}
    </div>
  );
}
