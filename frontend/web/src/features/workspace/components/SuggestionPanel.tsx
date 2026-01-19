import { useEffect, useState } from 'react';

import type { SuggestionItem } from '../types';
import SuggestionCard from './SuggestionCard';

interface SuggestionPanelProps {
  suggestions: SuggestionItem[];
  isBlocked: boolean;
  isLoading: boolean;
  error: string;
  onSelectSuggestion: (text: string) => void;
  onRefresh: () => void;
}

export default function SuggestionPanel({
  suggestions,
  isBlocked,
  isLoading,
  error,
  onSelectSuggestion,
  onRefresh,
}: SuggestionPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isRefreshing) return undefined;
    const timeout = window.setTimeout(() => setIsRefreshing(false), 700);
    return () => window.clearTimeout(timeout);
  }, [isRefreshing]);

  const showEmpty = !isLoading && suggestions.length === 0 && !error;

  return (
    <section className="SuggestionPanel" aria-label="建议问题">
      <div className="SuggestionPanel__header">
        <div>
          <div className="SuggestionPanel__title">建议问题</div>
          <div className="SuggestionPanel__subtitle">基于当前内容自动生成</div>
        </div>
        <div className="SuggestionPanel__actions">
          <button
            type="button"
            className="SuggestionRefreshButton"
            onClick={() => {
              if (isBlocked) return;
              setIsRefreshing(true);
              onRefresh();
            }}
            disabled={isBlocked || isLoading}
            aria-label="刷新建议问题"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className={`SuggestionRefreshIcon ${isRefreshing || isLoading ? 'isSpinning' : ''}`}
            >
              <path
                d="M4.5 12a7.5 7.5 0 0 1 12.7-5.3l1.3-1.2V9h-4l2-1.9A5.5 5.5 0 1 0 6.5 12h-2Z"
                fill="currentColor"
              />
              <path
                d="M19.5 12a7.5 7.5 0 0 1-12.7 5.3l-1.3 1.2V15h4l-2 1.9A5.5 5.5 0 1 0 17.5 12h2Z"
                fill="currentColor"
              />
            </svg>
            刷新
          </button>
        </div>
      </div>
      {isBlocked ? (
        <div className="SuggestionEmpty">请先创建笔记本后查看建议问题。</div>
      ) : error ? (
        <div className="SuggestionEmpty">
          {error}
          <button type="button" className="WorkspaceLinkButton" onClick={onRefresh}>
            重试
          </button>
        </div>
      ) : isLoading ? (
        <div className="SuggestionSkeletonList" aria-label="加载建议">
          <div className="SuggestionSkeletonItem" />
          <div className="SuggestionSkeletonItem" />
          <div className="SuggestionSkeletonItem isShort" />
        </div>
      ) : showEmpty ? (
        <div className="SuggestionEmpty">暂无建议问题。</div>
      ) : (
        <ul className="SuggestionList" role="list">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.question}-${suggestion.type}`}>
              <SuggestionCard suggestion={suggestion} onSelect={onSelectSuggestion} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
