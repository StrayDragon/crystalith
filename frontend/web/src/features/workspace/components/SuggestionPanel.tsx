import { useEffect, useMemo, useState } from 'react';

import type { Suggestion } from '../types';
import SuggestionCard from './SuggestionCard';

type SuggestionVariant = 'notebook' | 'followup';

const SUGGESTION_LIMIT = 4;

const SUGGESTION_POOLS: Record<SuggestionVariant, Suggestion[]> = {
  notebook: [
    {
      id: 'notebook-core',
      text: '这份资料的核心结论是什么？',
      type: 'factual',
    },
    {
      id: 'notebook-assumptions',
      text: '有哪些关键假设或限制需要注意？',
      type: 'analytical',
    },
    {
      id: 'notebook-compare',
      text: '与类似方案相比优势和不足是什么？',
      type: 'comparative',
    },
    {
      id: 'notebook-creative',
      text: '可以衍生出哪些可落地的应用场景？',
      type: 'creative',
    },
    {
      id: 'notebook-deep-dive',
      text: '深入探索：有哪些值得继续追问的问题？',
      type: 'deep_dive',
    },
  ],
  followup: [
    {
      id: 'followup-deep',
      text: '深入探索：还缺少哪些证据支撑？',
      type: 'deep_dive',
    },
    {
      id: 'followup-alt',
      text: '换个视角看，这个结论是否成立？',
      type: 'analytical',
    },
    {
      id: 'followup-compare',
      text: '有哪些点适合做对比表或时间线？',
      type: 'comparative',
    },
    {
      id: 'followup-actions',
      text: '可以拆解成哪些具体行动项？',
      type: 'factual',
    },
    {
      id: 'followup-risks',
      text: '有哪些反例或风险需要验证？',
      type: 'analytical',
    },
  ],
};

interface SuggestionPanelProps {
  variant: SuggestionVariant;
  contextKey: string | number | null;
  isBlocked: boolean;
  onSelectSuggestion: (text: string) => void;
}

function rotateSuggestions(items: Suggestion[], offset: number): Suggestion[] {
  if (!items.length) return items;
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export default function SuggestionPanel({
  variant,
  contextKey,
  isBlocked,
  onSelectSuggestion,
}: SuggestionPanelProps) {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const suggestions = useMemo(() => {
    const pool = SUGGESTION_POOLS[variant] ?? [];
    const rotated = rotateSuggestions(pool, refreshSeed);
    return rotated.slice(0, SUGGESTION_LIMIT);
  }, [variant, refreshSeed]);

  useEffect(() => {
    setRefreshSeed(0);
  }, [variant, contextKey]);

  useEffect(() => {
    if (!isRefreshing) return undefined;
    const timeout = window.setTimeout(() => setIsRefreshing(false), 700);
    return () => window.clearTimeout(timeout);
  }, [isRefreshing]);

  const title = variant === 'followup' ? '继续探索' : '建议问题';
  const subtitle =
    variant === 'followup'
      ? '基于当前对话生成后续问题'
      : '基于笔记本内容自动生成';

  return (
    <section className="SuggestionPanel" aria-label="建议问题">
      <div className="SuggestionPanel__header">
        <div>
          <div className="SuggestionPanel__title">{title}</div>
          <div className="SuggestionPanel__subtitle">{subtitle}</div>
        </div>
        <div className="SuggestionPanel__actions">
          <button
            type="button"
            className="SuggestionRefreshButton"
            onClick={() => {
              if (isBlocked) return;
              setIsRefreshing(true);
              setRefreshSeed((prev) => prev + 1);
            }}
            disabled={isBlocked}
            aria-label="刷新建议问题"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className={`SuggestionRefreshIcon ${isRefreshing ? 'isSpinning' : ''}`}
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
      ) : (
        <ul className="SuggestionList" role="list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <SuggestionCard suggestion={suggestion} onSelect={onSelectSuggestion} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
