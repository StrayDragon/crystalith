import { useMemo, useState } from 'react';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressIndicator({ current, total, label = '进度' }: ProgressIndicatorProps) {
  const { clampedCurrent, clampedTotal, percent } = useMemo(() => {
    const safeTotal = Math.max(0, total);
    const safeCurrent = safeTotal === 0 ? 0 : Math.min(Math.max(current, 0), safeTotal);
    const safePercent = safeTotal === 0 ? 0 : Math.round((safeCurrent / safeTotal) * 100);
    return {
      clampedCurrent: safeCurrent,
      clampedTotal: safeTotal,
      percent: safePercent,
    };
  }, [current, total]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span className="font-medium text-gray-600 dark:text-slate-300">{label}</span>
        <span className="tabular-nums">
          {clampedCurrent}/{clampedTotal}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gray-900 transition-all dark:bg-sky-400"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = true,
  headerRight,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = id ? `${id}-content` : undefined;

  return (
    <section
      id={id}
      className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="flex flex-1 flex-col items-start gap-1 text-left"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500 dark:border-slate-600 dark:text-slate-300">
              {open ? '−' : '+'}
            </span>
            <span className="truncate">{title}</span>
          </div>
          {summary ? (
            <div className="text-xs text-gray-500 line-clamp-2 dark:text-slate-400">{summary}</div>
          ) : null}
        </button>
        {headerRight ? <div className="pt-1">{headerRight}</div> : null}
      </div>
      {open ? (
        <div id={contentId} className="px-4 pb-4 text-sm text-gray-700 dark:text-slate-200">
          {children}
        </div>
      ) : null}
    </section>
  );
}
