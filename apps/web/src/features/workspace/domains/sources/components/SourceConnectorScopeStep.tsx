import type { ImportResultItem, SnapshotEntry } from './source-connector-types';
import { SourceConnectorImportResultList } from './SourceConnectorImportResultList';

export interface SourceConnectorScopeStepProps {
  snapshotEntries: SnapshotEntry[];
  scopeDirectories: string[];
  scopeFiles: string[];
  directories: string[];
  selectedDirs: Record<string, boolean>;
  selectedFiles: Record<string, boolean>;
  importResults: ImportResultItem[];
  onSelectedDirsChange: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
  onSelectedFilesChange: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
}

export function SourceConnectorScopeStep({
  snapshotEntries,
  scopeDirectories,
  scopeFiles,
  directories,
  selectedDirs,
  selectedFiles,
  importResults,
  onSelectedDirsChange,
  onSelectedFilesChange,
}: SourceConnectorScopeStepProps) {
  if (!snapshotEntries.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-700 dark:text-slate-200">
        没有快照条目可选。请先在上一步加载快照。
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-gray-600 dark:text-slate-400">
        已选：目录 {scopeDirectories.length} · 文件 {scopeFiles.length}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200">
            目录
          </div>
          <div className="max-h-[40vh] overflow-y-auto">
            {directories.map((dir) => (
              <label
                key={dir}
                className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedDirs[dir])}
                  onChange={(e) =>
                    onSelectedDirsChange((prev) => ({ ...prev, [dir]: e.target.checked }))
                  }
                />
                <span className="text-xs font-mono text-gray-900 dark:text-slate-100 truncate">
                  {dir}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200">
            文件
          </div>
          <div className="max-h-[40vh] overflow-y-auto">
            {snapshotEntries.map((entry) => (
              <label
                key={entry.relativePath}
                className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-slate-800 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedFiles[entry.relativePath])}
                  onChange={(e) =>
                    onSelectedFilesChange((prev) => ({
                      ...prev,
                      [entry.relativePath]: e.target.checked,
                    }))
                  }
                />
                <span className="text-xs font-mono text-gray-900 dark:text-slate-100 truncate">
                  {entry.relativePath}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <SourceConnectorImportResultList results={importResults} title="导入结果" />
    </div>
  );
}
