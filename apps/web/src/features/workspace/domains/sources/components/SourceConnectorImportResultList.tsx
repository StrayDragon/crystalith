import type { ImportResultItem } from './source-connector-types';

export interface SourceConnectorImportResultListProps {
  results: ImportResultItem[];
  title: string;
}

export function SourceConnectorImportResultList({
  results,
  title,
}: SourceConnectorImportResultListProps) {
  if (!results.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200">
        {title}（{results.length}）
      </div>
      <div className="max-h-[30vh] overflow-y-auto">
        {results.map((item: ImportResultItem) => (
          <div
            key={`${item.relativePath}-${item.status}-${item.sourceId ?? 'none'}`}
            className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono text-gray-900 dark:text-slate-100 truncate">
                  {item.relativePath}
                </div>
                {item.diagnostic ? (
                  <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300 truncate">
                    [{item.diagnostic.errorCode}] {item.diagnostic.message}
                    {item.diagnostic.hint ? ` · ${item.diagnostic.hint}` : ''}
                  </div>
                ) : null}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
                {item.status}
                {item.sourceId ? ` #${item.sourceId}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
