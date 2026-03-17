import { useMemo } from "react";

export type BarChartItem = {
  label: string;
  value: number;
};

type BarChartCardProps = {
  title: string;
  unit?: string | null;
  items: BarChartItem[];
};

export default function BarChartCard({ title, unit = null, items }: BarChartCardProps) {
  const maxValue = useMemo(() => {
    const values = items.map((item) => (Number.isFinite(item.value) ? item.value : 0));
    const max = values.length ? Math.max(...values) : 0;
    return max > 0 ? max : 1;
  }, [items]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</div>
      <div className="mt-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-slate-300">No data</div>
        ) : (
          items.map((item) => {
            const ratio = Number.isFinite(item.value) ? item.value / maxValue : 0;
            const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
            return (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-28 text-[11px] text-gray-700 dark:text-slate-200 truncate">
                  {item.label}
                </div>
                <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-600 dark:bg-blue-400"
                    style={{ width }}
                  />
                </div>
                <div className="w-16 text-[11px] text-gray-600 dark:text-slate-300 tabular-nums text-right">
                  {item.value}
                  {unit ? ` ${unit}` : ""}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
