interface CitationHighlightProps {
  active: boolean;
}

export default function CitationHighlight({ active }: CitationHighlightProps) {
  return (
    <span
      className={`CitationHighlight ${active ? 'isActive' : ''}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        focusable="false"
        aria-hidden="true"
        className="CitationHighlight__icon"
      >
        <path
          d="M12 3l3 6 6.5.9-4.7 4.6 1.1 6.5-5.9-3.1-5.9 3.1 1.1-6.5L2.5 9.9 9 9z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
