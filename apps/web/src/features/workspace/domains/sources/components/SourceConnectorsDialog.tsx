import type { JsonMetadata } from '@crystalith/shared';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';

import { api } from '../../../../../api/eden';
import { parseServerError } from '../../../../../api/parseServerError';
import { useLayer } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import { toast } from '../../../../../shared/toast';
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap';
import type {
  SourceConnectorsListResponse,
  ConnectorBindingRead,
  ImportResultItem,
  ImportScope,
  ImportScopeApplyResponse,
  Snapshot,
  SnapshotEntry,
  SourceConnectorDescriptor,
  SyncCheckResult,
  SyncCandidate,
} from './source-connector-types';
import {
  buildDirectories,
  formatSnapshotTimestamp,
  isRecord,
  normalizeConfigValue,
  safeArray,
  schemaProperties,
  schemaRequired,
  titleForEntry,
  type ConnectorDialogStep,
} from './source-connector-utils';

function SourceConnectorImportResultList({
  results,
  title,
}: {
  results: ImportResultItem[];
  title: string;
}) {
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

function SourceConnectorSelectStep({
  isConnected,
  notebookId,
  error,
  isLoading,
  connectors,
  selectedConnectorId,
  onSelectConnector,
}: {
  isConnected: boolean;
  notebookId?: number;
  error: unknown;
  isLoading: boolean;
  connectors: SourceConnectorDescriptor[];
  selectedConnectorId: string;
  onSelectConnector: (connectorId: string) => void;
}) {
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
            onClick={() => {
              onSelectConnector(connector.connectorId);
            }}
            {...tid(`${TestIds.sourcesConnectorsOption}-${connector.connectorId}`)}
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
                  {/* intentionally || — empty description falls back to id */}
                  {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing */}
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

function SourceConnectorConfigStep({
  selectedConnector,
  configProps,
  configRequired,
  connectionConfig,
  onUpdateConfig,
}: {
  selectedConnector: SourceConnectorDescriptor | null;
  configProps: Record<string, unknown>;
  configRequired: Set<string>;
  connectionConfig: JsonMetadata;
  onUpdateConfig: (key: string, next: unknown, typeHint?: string) => void;
}) {
  if (!selectedConnector) {
    return (
      <div className="text-sm text-gray-700 dark:text-slate-200">未选择连接器，请返回上一页。</div>
    );
  }

  const props = configProps;
  const required = configRequired;
  const keys = Object.keys(props).toSorted((a, b) => a.localeCompare(b));
  if (!keys.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">无需配置</div>
        <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          此连接器没有可配置项，点击「创建绑定」继续。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const rawField = props[key];
        const field = isRecord(rawField) ? rawField : {};
        const typeHint = typeof field.type === 'string' ? field.type : undefined;
        const label =
          typeof field.title === 'string' && field.title.trim() ? field.title.trim() : key;
        const description =
          typeof field.description === 'string' && field.description.trim()
            ? field.description.trim()
            : null;
        const enumValues = Array.isArray(field.enum) ? field.enum : null;
        const isRequired = required.has(key);
        const current = connectionConfig[key];

        if (enumValues) {
          return (
            <label key={key} className="block">
              <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                {label}
                {isRequired ? <span className="text-rose-600"> *</span> : null}
              </div>
              {description ? (
                <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                  {description}
                </div>
              ) : null}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
                value={typeof current === 'string' ? current : ''}
                onChange={(e) => {
                  onUpdateConfig(key, e.target.value, typeHint);
                }}
              >
                <option value="">请选择…</option>
                {enumValues.map((v: unknown) => {
                  const text = String(v);
                  return (
                    <option key={text} value={text}>
                      {text}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        }

        if (typeHint === 'boolean') {
          return (
            <label
              key={key}
              className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => {
                  onUpdateConfig(key, e.target.checked, typeHint);
                }}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {label}
                  {isRequired ? <span className="text-rose-600"> *</span> : null}
                </div>
                {description ? (
                  <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                    {description}
                  </div>
                ) : null}
              </div>
            </label>
          );
        }

        const inputType = typeHint === 'integer' || typeHint === 'number' ? 'number' : 'text';
        return (
          <label key={key} className="block">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200">
              {label}
              {isRequired ? <span className="text-rose-600"> *</span> : null}
            </div>
            {description ? (
              <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
                {description}
              </div>
            ) : null}
            <input
              type={inputType}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
              value={typeof current === 'string' ? current : ''}
              onChange={(e) => {
                onUpdateConfig(key, e.target.value, typeHint);
              }}
              placeholder={key}
              {...tid(`${TestIds.sourcesConnectorsConfigField}-${key}`)}
            />
          </label>
        );
      })}
    </div>
  );
}

function SourceConnectorSnapshotStep({
  binding,
  snapshotEntries,
  filteredEntries,
  snapshotFilter,
  busy,
  onLoadSnapshot,
  onSnapshotFilterChange,
}: {
  binding: ConnectorBindingRead | null;
  snapshotEntries: SnapshotEntry[];
  filteredEntries: SnapshotEntry[];
  snapshotFilter: string;
  busy: boolean;
  onLoadSnapshot: () => void;
  onSnapshotFilterChange: (value: string) => void;
}) {
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
          onClick={() => {
            onLoadSnapshot();
          }}
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
          onChange={(e) => {
            onSnapshotFilterChange(e.target.value);
          }}
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
                  {formatSnapshotTimestamp(entry.modifiedAt)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SourceConnectorScopeStep({
  snapshotEntries,
  scopeDirectories,
  scopeFiles,
  directories,
  selectedDirs,
  selectedFiles,
  importResults,
  onSelectedDirsChange,
  onSelectedFilesChange,
}: {
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
}) {
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
                  checked={selectedDirs[dir] ?? false}
                  onChange={(e) => {
                    onSelectedDirsChange((prev) => ({ ...prev, [dir]: e.target.checked }));
                  }}
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
                  checked={selectedFiles[entry.relativePath] ?? false}
                  onChange={(e) => {
                    onSelectedFilesChange((prev) => ({
                      ...prev,
                      [entry.relativePath]: e.target.checked,
                    }));
                  }}
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

function SourceConnectorSyncStep({
  syncCheck,
  applyResults,
}: {
  syncCheck: SyncCheckResult | null;
  applyResults: ImportResultItem[];
}) {
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
                {group.items.map((item: SyncCandidate) => (
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

interface SourceConnectorsDialogProps {
  open: boolean;
  onClose: () => void;
  notebookId?: number;
  isConnected: boolean;
  onSourcesChanged?: () => Promise<void> | void;
}

export default function SourceConnectorsDialog({
  open,
  onClose,
  notebookId,
  isConnected,
  onSourcesChanged,
}: SourceConnectorsDialogProps) {
  const { style: modalStyle } = useLayer('modal');
  const modalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: onClose,
  });

  const [step, setStep] = useState<ConnectorDialogStep>('select');
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>('');
  const [connectionConfig, setConnectionConfig] = useState<JsonMetadata>({});
  const [binding, setBinding] = useState<ConnectorBindingRead | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotFilter, setSnapshotFilter] = useState('');
  const [selectedDirs, setSelectedDirs] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [importResult, setImportResult] = useState<ImportScopeApplyResponse | null>(null);
  const [syncCheck, setSyncCheck] = useState<SyncCheckResult | null>(null);
  const [syncApplyResult, setSyncApplyResult] = useState<ImportScopeApplyResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('select');
    setSelectedConnectorId('');
    setConnectionConfig({});
    setBinding(null);
    setSnapshot(null);
    setSnapshotFilter('');
    setSelectedDirs({});
    setSelectedFiles({});
    setImportResult(null);
    setSyncCheck(null);
    setSyncApplyResult(null);
    setBusy(false);
  }, [open]);

  const canQuery = Boolean(open && notebookId && isConnected);
  const { data, error, isLoading, mutate } = useSWR<SourceConnectorsListResponse, Error>(
    canQuery ? ['workspace/source-connectors', notebookId] : null,
    async (): Promise<SourceConnectorsListResponse> => {
      const notebook = api.v2.notebooks({ nid: notebookId! });
      const { data: response, error: fetchErr } = await notebook['source-connectors'].get();
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      if (!response) throw new Error('无法获取连接器列表');
      return response;
    },
    { revalidateOnFocus: false },
  );

  const connectors = useMemo(() => safeArray(data?.connectors), [data?.connectors]);
  const selectedConnector = useMemo<SourceConnectorDescriptor | null>(() => {
    const normalized = selectedConnectorId.trim();
    if (!normalized) return null;
    return connectors.find((item) => item.connectorId === normalized) ?? null;
  }, [connectors, selectedConnectorId]);

  const snapshotEntries = useMemo(() => safeArray(snapshot?.entries), [snapshot?.entries]);
  const directories = useMemo(() => buildDirectories(snapshotEntries), [snapshotEntries]);
  const filteredEntries = useMemo(() => {
    const query = snapshotFilter.trim().toLowerCase();
    if (!query) return snapshotEntries;
    return snapshotEntries.filter((entry) => entry.relativePath.toLowerCase().includes(query));
  }, [snapshotEntries, snapshotFilter]);

  const scopeDirectories = useMemo(
    () => Object.keys(selectedDirs).filter((key) => selectedDirs[key]),
    [selectedDirs],
  );
  const scopeFiles = useMemo(
    () => Object.keys(selectedFiles).filter((key) => selectedFiles[key]),
    [selectedFiles],
  );
  const scopePayload: ImportScope = useMemo(
    () => ({
      includeDirectories: scopeDirectories.length ? scopeDirectories : null,
      includeFiles: scopeFiles.length ? scopeFiles : null,
    }),
    [scopeDirectories, scopeFiles],
  );

  const handleBack = useCallback(() => {
    if (busy) return;
    setImportResult(null);
    setSyncCheck(null);
    setSyncApplyResult(null);
    if (step === 'config') setStep('select');
    else if (step === 'snapshot') setStep('config');
    else if (step === 'scope') setStep('snapshot');
    else if (step === 'sync') setStep('scope');
  }, [busy, step]);

  const handleRefreshConnectors = useCallback(async () => {
    if (!canQuery || busy) return;
    try {
      await mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : '刷新失败';
      toast.error(message);
    }
  }, [busy, canQuery, mutate]);

  const handleCreateBinding = useCallback(async () => {
    if (!notebookId || !selectedConnector) return;
    if (busy) return;
    setBusy(true);
    setImportResult(null);
    setSyncCheck(null);
    setSyncApplyResult(null);
    try {
      const notebook = api.v2.notebooks({ nid: notebookId });
      const connector = notebook['source-connectors']({
        connectorId: selectedConnector.connectorId,
      });
      const { data: created, error: createErr } = await connector.bindings.post({
        connectionConfig,
      });
      if (createErr)
        throw new Error(
          typeof createErr === 'string'
            ? createErr
            : typeof createErr === 'string'
              ? createErr
              : '',
        );
      if (!created) throw new Error('创建绑定失败');
      setBinding(created);
      setSnapshot(null);
      setSelectedDirs({});
      setSelectedFiles({});
      setStep('snapshot');
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建绑定失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [busy, connectionConfig, notebookId, selectedConnector]);

  const handleLoadSnapshot = useCallback(async () => {
    if (!notebookId || !binding) return;
    if (busy) return;
    setBusy(true);
    setImportResult(null);
    setSyncCheck(null);
    setSyncApplyResult(null);
    try {
      const notebook = api.v2.notebooks({ nid: notebookId });
      const bindingApi = notebook['source-connector-bindings']({ bindingId: binding.id });
      const { data: snap, error: snapErr } = await bindingApi.snapshot.post();
      if (snapErr)
        throw new Error(
          typeof snapErr === 'string' ? snapErr : typeof snapErr === 'string' ? snapErr : '',
        );
      if (!snap) throw new Error('加载快照失败');
      setSnapshot(snap);
      toast.success(`快照已加载：${safeArray(snap.entries).length} 项`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载快照失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, notebookId]);

  useEffect(() => {
    if (!open) return;
    if (step !== 'snapshot') return;
    if (!binding) return;
    if (snapshot) return;
    void handleLoadSnapshot();
  }, [binding, handleLoadSnapshot, open, snapshot, step]);

  const handleApplyImportScope = useCallback(async () => {
    if (!notebookId || !binding) return;
    if (busy) return;
    if (!scopeDirectories.length && !scopeFiles.length) {
      toast.warning('请选择至少一个目录或文件。');
      return;
    }
    setBusy(true);
    setImportResult(null);
    setSyncCheck(null);
    setSyncApplyResult(null);
    try {
      const notebook = api.v2.notebooks({ nid: notebookId });
      const bindingApi = notebook['source-connector-bindings']({ bindingId: binding.id });
      const { data: result, error: importErr } =
        await bindingApi['import-scope'].post(scopePayload);
      if (importErr)
        throw new Error(
          typeof importErr === 'string'
            ? importErr
            : typeof importErr === 'string'
              ? importErr
              : '',
        );
      if (!result) throw new Error('导入失败');
      setBinding(result.binding);
      setImportResult(result);
      await onSourcesChanged?.();
      toast.success(
        `导入完成：新增 ${safeArray(result.importedSourceIds).length} · 复用 ${safeArray(result.reusedSourceIds).length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [
    binding,
    busy,
    notebookId,
    onSourcesChanged,
    scopeDirectories.length,
    scopeFiles.length,
    scopePayload,
  ]);

  const handleRunSyncCheck = useCallback(async () => {
    if (!notebookId || !binding) return;
    if (busy) return;
    setBusy(true);
    setSyncCheck(null);
    setSyncApplyResult(null);
    try {
      const notebook = api.v2.notebooks({ nid: notebookId });
      const bindingApi = notebook['source-connector-bindings']({ bindingId: binding.id });
      const { data: result, error: syncErr } = await bindingApi['sync-check'].post();
      if (syncErr)
        throw new Error(
          typeof syncErr === 'string' ? syncErr : typeof syncErr === 'string' ? syncErr : '',
        );
      if (!result) throw new Error('同步检查失败');
      setSyncCheck(result);
      toast.success('同步检查完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步检查失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, notebookId]);

  const handleApplySyncCheck = useCallback(async () => {
    if (!notebookId || !binding || !syncCheck) return;
    if (busy) return;
    setSyncApplyResult(null);
    try {
      const notebook = api.v2.notebooks({ nid: notebookId });
      const bindingApi = notebook['source-connector-bindings']({ bindingId: binding.id });
      const { data: result, error: applyErr } = await bindingApi['sync-check'].apply.post({
        syncCheckId: syncCheck.id,
      });
      if (applyErr) throw new Error(parseServerError(applyErr).message);
      if (!result) throw new Error('同步应用失败');
      setBinding(result.binding);
      setSyncApplyResult(result);
      await onSourcesChanged?.();
      toast.success(
        `同步应用完成：新增 ${safeArray(result.importedSourceIds).length} · 复用 ${safeArray(result.reusedSourceIds).length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步应用失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, notebookId, onSourcesChanged, syncCheck]);

  const handleUnbind = useCallback(async () => {
    if (!binding) return;
    if (busy) return;
    const ok = window.confirm(
      `确定解除绑定 #${binding.id}？\n\n已导入的来源不会删除，仅移除连接器绑定关系。`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { error: delErr } = await api.v2['source-connector-bindings']({
        id: binding.id,
      }).delete();
      if (delErr) throw new Error(typeof delErr === 'string' ? delErr : '解除绑定失败');
      setBinding(null);
      setSnapshot(null);
      setSelectedDirs({});
      setSelectedFiles({});
      setImportResult(null);
      setSyncCheck(null);
      setSyncApplyResult(null);
      setStep('config');
      toast.success('已解除连接器绑定');
    } catch (error) {
      const message = error instanceof Error ? error.message : '解除绑定失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [binding, busy]);

  const configSchema = selectedConnector?.connectionConfigSchema ?? null;
  const configProps = useMemo(() => schemaProperties(configSchema), [configSchema]);
  const configRequired = useMemo(() => schemaRequired(configSchema), [configSchema]);

  const handleUpdateConfig = useCallback((key: string, next: unknown, typeHint?: string) => {
    setConnectionConfig((prev) => ({
      ...prev,
      [key]: normalizeConfigValue(next, typeHint),
    }));
  }, []);

  const importResults = useMemo(() => safeArray(importResult?.results), [importResult?.results]);
  const syncApplyResults = useMemo(
    () => safeArray(syncApplyResult?.results),
    [syncApplyResult?.results],
  );

  const renderHeader = useMemo(() => {
    const title =
      step === 'select'
        ? '连接器'
        : step === 'config'
          ? '连接参数'
          : step === 'snapshot'
            ? '快照预览'
            : step === 'scope'
              ? '选择导入范围'
              : '同步检查';

    return (
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</div>
          <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
            {selectedConnector ? `连接器：${selectedConnector.displayName}` : ''}
            {binding ? ` · binding #${binding.id}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshConnectors()}
            disabled={!canQuery || busy}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center text-gray-700 dark:text-slate-200"
            aria-label="刷新"
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-700 dark:text-slate-200"
            aria-label="关闭"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    );
  }, [binding, busy, canQuery, handleRefreshConnectors, onClose, selectedConnector, step]);

  const footer = useMemo(() => {
    const showBack = step !== 'select';
    const nextDisabled =
      busy ||
      (step === 'select' ? !selectedConnectorId.trim() : false) ||
      (step === 'snapshot' ? !snapshot : false);

    const nextLabel =
      step === 'select'
        ? '下一步'
        : step === 'config'
          ? '创建绑定'
          : step === 'snapshot'
            ? '选择范围'
            : step === 'scope'
              ? '同步检查'
              : '完成';

    const handleNext = () => {
      if (busy) return;
      if (step === 'select') setStep('config');
      else if (step === 'config') void handleCreateBinding();
      else if (step === 'snapshot') setStep('scope');
      else if (step === 'scope') setStep('sync');
      else onClose();
    };

    return (
      <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              {...tid(TestIds.sourcesConnectorsBack)}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1"
            >
              <ArrowBackIcon sx={{ fontSize: 16 }} />
              返回
            </button>
          ) : null}
          {binding ? (
            <button
              type="button"
              onClick={() => void handleUnbind()}
              disabled={busy}
              {...tid(TestIds.sourcesConnectorsUnbind)}
              className="px-3 py-1.5 rounded-lg text-xs border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60 flex items-center gap-1"
            >
              <LinkOffIcon sx={{ fontSize: 16 }} />
              解除绑定
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {step === 'snapshot' ? (
            <button
              type="button"
              onClick={() => void handleLoadSnapshot()}
              disabled={busy || !binding}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              重新加载快照
            </button>
          ) : null}
          {step === 'scope' ? (
            <button
              type="button"
              onClick={() => void handleApplyImportScope()}
              disabled={busy || !binding}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-900 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
            >
              导入所选范围
            </button>
          ) : null}
          {step === 'sync' ? (
            <>
              <button
                type="button"
                onClick={() => void handleRunSyncCheck()}
                disabled={busy || !binding}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                执行 sync_check
              </button>
              <button
                type="button"
                onClick={() => void handleApplySyncCheck()}
                disabled={busy || !binding || !syncCheck}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-900 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
              >
                应用新增/更新
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            {...(step === 'config'
              ? tid(TestIds.sourcesConnectorsCreateBinding)
              : tid(TestIds.sourcesConnectorsNext))}
            className="px-4 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    );
  }, [
    binding,
    busy,
    handleApplyImportScope,
    handleBack,
    handleCreateBinding,
    handleLoadSnapshot,
    handleRunSyncCheck,
    handleApplySyncCheck,
    handleUnbind,
    onClose,
    selectedConnectorId,
    snapshot,
    step,
    syncCheck,
  ]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="连接器"
      tabIndex={-1}
      {...tid(TestIds.sourcesConnectorsDialog)}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 ux-modal-in overflow-hidden"
      >
        {renderHeader}

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {step === 'select' && (
            <SourceConnectorSelectStep
              isConnected={isConnected}
              notebookId={notebookId}
              error={error}
              isLoading={isLoading}
              connectors={connectors}
              selectedConnectorId={selectedConnectorId}
              onSelectConnector={setSelectedConnectorId}
            />
          )}
          {step === 'config' && (
            <SourceConnectorConfigStep
              selectedConnector={selectedConnector}
              configProps={configProps}
              configRequired={configRequired}
              connectionConfig={connectionConfig}
              onUpdateConfig={handleUpdateConfig}
            />
          )}
          {step === 'snapshot' && (
            <SourceConnectorSnapshotStep
              binding={binding}
              snapshotEntries={snapshotEntries}
              filteredEntries={filteredEntries}
              snapshotFilter={snapshotFilter}
              busy={busy}
              onLoadSnapshot={() => {
                void handleLoadSnapshot();
              }}
              onSnapshotFilterChange={setSnapshotFilter}
            />
          )}
          {step === 'scope' && (
            <SourceConnectorScopeStep
              snapshotEntries={snapshotEntries}
              scopeDirectories={scopeDirectories}
              scopeFiles={scopeFiles}
              directories={directories}
              selectedDirs={selectedDirs}
              selectedFiles={selectedFiles}
              importResults={importResults}
              onSelectedDirsChange={setSelectedDirs}
              onSelectedFilesChange={setSelectedFiles}
            />
          )}
          {step === 'sync' && (
            <SourceConnectorSyncStep syncCheck={syncCheck} applyResults={syncApplyResults} />
          )}
        </div>

        {footer}
      </div>
    </div>,
    document.body,
  );
}
