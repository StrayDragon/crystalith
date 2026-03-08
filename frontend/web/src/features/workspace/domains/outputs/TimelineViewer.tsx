import { useEffect, useState } from "react";

export interface TimelineEvent {
  date?: string | null;
  event?: string | null;
  description?: string | null;
}

interface TimelineViewerProps {
  events: TimelineEvent[];
  className?: string;
}

export default function TimelineViewer({ events, className }: TimelineViewerProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setExpanded(new Set());
  }, [events]);

  if (events.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-slate-400">暂无时间轴内容。</div>;
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {events.map((item, index) => {
          const isOpen = expanded.has(index);
          return (
            <div key={`event-${index}`} className="relative pl-6">
              <span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-gray-900 dark:bg-sky-400" />
              <span className="absolute left-[5px] top-5 h-full w-px bg-gray-200 dark:bg-slate-600" />
              <button
                type="button"
                className="flex w-full flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                onClick={() => {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) {
                      next.delete(index);
                    } else {
                      next.add(index);
                    }
                    return next;
                  });
                }}
              >
                <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {item.date || "时间"}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {item.event || "事件"}
                </div>
                {isOpen ? (
                  <div className="text-sm text-gray-600 dark:text-slate-300">
                    {item.description || "暂无描述"}
                  </div>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
