import type { SuggestionType } from '../types';

const TYPE_LABELS: Record<SuggestionType, string> = {
  factual: '事实性',
  analytical: '分析性',
  comparative: '比较性',
  creative: '创意性',
  deep_dive: '深入探索',
};

interface SuggestionTypeTagProps {
  type: SuggestionType;
}

export default function SuggestionTypeTag({ type }: SuggestionTypeTagProps) {
  const label = TYPE_LABELS[type];
  return (
    <span
      className={`SuggestionTypeTag SuggestionTypeTag--${type}`}
      aria-label={`问题类型：${label}`}
    >
      {label}
    </span>
  );
}
