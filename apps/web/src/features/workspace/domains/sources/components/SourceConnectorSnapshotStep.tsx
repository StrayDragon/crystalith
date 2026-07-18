import type { ConnectorBindingRead, SnapshotEntry } from './source-connector-types';
import { titleForEntry } from './source-connector-utils';

export interface SourceConnectorSnapshotStepProps {
  binding: ConnectorBindingRead | null;
  snapshotEntries: SnapshotEntry[];
  filteredEntries: SnapshotEntry[];
  snapshotFilter: string;
  busy: boolean;
  onLoadSnapshot: () => void;
  onSnapshotFilterChange: (value: string) => void;
}

export function SourceConnectorSnapshotStep({
  binding,
  snapshotEntries,
  filteredEntries,
  snapshotFilter,
  busy,
  onLoadSnapshot,
  onSnapshotFilterChange,
}: SourceConnectorSnapshotStepProps) {
  if (!binding) {
    return <div className="text-sm text-gray-700 dark:text-slate-200">尚未创建 binding。</div>;
  }
  const count = snapshotEntries.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-600 dark:text-slate-400">共 {count} 项</div>
        <button
          type="button"
          onClick={() => void onLoadSnapshot()}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
        >
          刷新快照
        </button>
      </div>

      <label className="block">
        <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">过滤</div>
        <input
          className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
          value={snapshotFilter}
          onChange={(e) => onSnapshotFilterChange(e.target.value)}
          placeholder="按路径包含匹配"
        />
      </label>

      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="max-h-[45vh] overflow-y-auto">
          {filteredEntries.map((entry) => {
            const title = titleForEntry(entry);
            return (
              <div
                key={entry.relativePath}
                className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-gray-900 dark:text-slate-100 truncate">
                      {entry.relativePath}
                    </div>
                    {title ? (
                      <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400 truncate">
                        {title}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {Number.isFinite(entry.sizeBytes) ? `${entry.sizeBytes} B` : ''}
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-gray-500 dark:text-slate-500 truncate">
                  {entry.modifiedAt}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
