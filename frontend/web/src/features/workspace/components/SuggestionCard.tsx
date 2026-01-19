import type { SuggestionItem } from '../types';
import SuggestionTypeTag from './SuggestionTypeTag';

interface SuggestionCardProps {
  suggestion: SuggestionItem;
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function SuggestionCard({
  suggestion,
  onSelect,
  disabled = false,
}: SuggestionCardProps) {
  return (
    <button
      type="button"
      className="SuggestionCard"
      onClick={() => onSelect(suggestion.question)}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabled ? '请先创建笔记本' : suggestion.question}
    >
      <div className="SuggestionCard__title">{suggestion.question}</div>
      <div className="SuggestionCard__meta">
        <SuggestionTypeTag type={suggestion.type} />
      </div>
    </button>
  );
}
