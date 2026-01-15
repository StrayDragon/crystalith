import type { Suggestion } from '../types';
import SuggestionTypeTag from './SuggestionTypeTag';

interface SuggestionCardProps {
  suggestion: Suggestion;
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
      onClick={() => onSelect(suggestion.text)}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabled ? '请先创建笔记本' : suggestion.text}
    >
      <div className="SuggestionCard__title">{suggestion.text}</div>
      <div className="SuggestionCard__meta">
        <SuggestionTypeTag type={suggestion.type} />
      </div>
    </button>
  );
}
