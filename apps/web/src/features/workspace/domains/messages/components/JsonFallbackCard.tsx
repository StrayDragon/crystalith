import { useMemo } from 'react';

type JsonFallbackCardProps = {
  title: string;
  json: unknown;
};

export default function JsonFallbackCard({ title, json }: JsonFallbackCardProps) {
  const text = useMemo(() => {
    try {
      const rendered = JSON.stringify(json, null, 2) ?? '';
      const maxChars = 4000;
      if (rendered.length > maxChars) {
        return rendered.slice(0, maxChars) + '\n…';
      }
      return rendered;
    } catch {
      return String(json);
    }
  }, [json]);

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">{title}</div>
      <pre className="mt-2 text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/90 overflow-x-auto whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  );
}
