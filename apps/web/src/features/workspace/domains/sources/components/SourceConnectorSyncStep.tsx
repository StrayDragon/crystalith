import type { ImportResultItem, SyncCheckResult } from './source-connector-types';
import { safeArray } from './source-connector-utils';
import { SourceConnectorImportResultList } from './SourceConnectorImportResultList';

export interface SourceConnectorSyncStepProps {
  syncCheck: SyncCheckResult | null;
  applyResults: ImportResultItem[];
}

export function SourceConnectorSyncStep({ syncCheck, applyResults }: SourceConnectorSyncStepProps) {
  const candidates = syncCheck?.candidates;
  const added = safeArray(candidates?.added);
  const updated = safeArray(candidates?.updated);
  const missing = safeArray(candidates?.missing);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">sync_check</div>
        <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          added: {added.length} · updated: {updated.length} · missing: {missing.length}
        </div>
        {syncCheck ? (
          <div className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
            id: <span className="font-mono">{syncCheck.id}</span>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-gray-600 dark:text-slate-400">
            点击右下角「执行 sync_check」加载候选变更。
          </div>
        )}
      </div>

      {syncCheck ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: '新增', items: added },
            { label: '更新', items: updated },
            { label: '缺失', items: missing },
          ].map((group) => (
            <div
              key={group.label}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200">
                {group.label}（{group.items.length}）
              </div>
              <div className="max-h-[35vh] overflow-y-auto">
                {group.items.map((item: any) => (
                  <div
                    key={`${group.label}-${item.relativePath}`}
                    className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="text-xs font-mono text-gray-900 dark:text-slate-100 truncate">
                      {item.relativePath}
                    </div>
                    {item.reason ? (
                      <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400 truncate">
                        {item.reason}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <SourceConnectorImportResultList results={applyResults} title="应用结果" />
    </div>
  );
}
