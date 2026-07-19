import type { SourceConnectorDescriptor } from './source-connector-types';
import { safeArray } from './source-connector-utils';

export interface SourceConnectorSelectStepProps {
  isConnected: boolean;
  notebookId?: number;
  error: unknown;
  isLoading: boolean;
  connectors: SourceConnectorDescriptor[];
  selectedConnectorId: string;
  onSelectConnector: (connectorId: string) => void;
}

export function SourceConnectorSelectStep({
  isConnected,
  notebookId,
  error,
  isLoading,
  connectors,
  selectedConnectorId,
  onSelectConnector,
}: SourceConnectorSelectStepProps) {
  if (!isConnected) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
        <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">未连接到后端</div>
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          暂无法获取连接器列表。
        </div>
      </div>
    );
  }

  if (!notebookId) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
        <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          未选择 notebook
        </div>
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          请先创建或选择 notebook。
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/20 px-4 py-3">
        <div className="text-sm font-semibold text-red-800 dark:text-red-200">加载失败</div>
        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error instanceof Error ? error.message : '无法获取连接器列表'}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-gray-700 dark:text-slate-200">加载中…</div>;
  }

  if (!connectors.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          暂无可用连接器
        </div>
        <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          请安装并启用官方连接器插件（例如 Obsidian / Local Directory），或检查插件加载诊断。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connectors.map((connector) => {
        const selected = connector.connectorId === selectedConnectorId;
        const diags = safeArray(connector.diagnostics);
        return (
          <button
            key={connector.connectorId}
            type="button"
            onClick={() => onSelectConnector(connector.connectorId)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
              selected
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{connector.displayName}</div>
                <div className="mt-0.5 text-[11px] opacity-80 truncate">
                  {connector.description || connector.connectorId}
                </div>
              </div>
              <div className="text-[10px] opacity-80 whitespace-nowrap">
                snapshot:{connector.capabilities?.supportsSnapshot ? '✓' : '×'} · sync:
                {connector.capabilities?.supportsSyncCheck ? '✓' : '×'}
              </div>
            </div>
            {diags.length ? (
              <div
                className={`mt-2 text-[11px] ${selected ? 'text-white/80' : 'text-amber-700 dark:text-amber-300'}`}
              >
                {diags.slice(0, 2).map((d) => (
                  <div key={`${connector.connectorId}-${d.errorCode}`} className="truncate">
                    [{d.errorCode}] {d.message}
                  </div>
                ))}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
