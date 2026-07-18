import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';

import { api } from '../../../../../api/eden';
import { useLayer } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import { toast } from '../../../../../shared/toast';
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap';
import type {
  ConnectorBindingRead,
  ImportScope,
  ImportScopeApplyResponse,
  JsonDictInput,
  Snapshot,
  SourceConnectorDescriptor,
  SourceConnectorsListResponse,
  SyncCheckResult,
} from './source-connector-types';
import {
  buildDirectories,
  normalizeConfigValue,
  safeArray,
  schemaProperties,
  schemaRequired,
  type ConnectorDialogStep,
} from './source-connector-utils';
import { SourceConnectorConfigStep } from './SourceConnectorConfigStep';
import { SourceConnectorScopeStep } from './SourceConnectorScopeStep';
import { SourceConnectorSelectStep } from './SourceConnectorSelectStep';
import { SourceConnectorSnapshotStep } from './SourceConnectorSnapshotStep';
import { SourceConnectorSyncStep } from './SourceConnectorSyncStep';

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
  const [connectionConfig, setConnectionConfig] = useState<JsonDictInput>({});
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
  const { data, error, isLoading, mutate } = useSWR<SourceConnectorsListResponse>(
    canQuery ? ['workspace/source-connectors', notebookId] : null,
    async () => {
      const { data: response, error: fetchErr } = await api.v2
        .notebooks({ nid: notebookId! }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connectors'].get();
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      return response as SourceConnectorsListResponse;
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
      const { data: created, error: createErr } = await api.v2
        .notebooks({ nid: notebookId }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connectors']({ connectorId: selectedConnector.connectorId })
        .bindings.post({ connectionConfig });
      if (createErr)
        throw new Error(
          typeof createErr === 'string'
            ? createErr
            : typeof createErr === 'string'
              ? createErr
              : '',
        );
      if (!created) throw new Error('创建绑定失败');
      setBinding(created as ConnectorBindingRead);
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
      const { data: snap, error: snapErr } = await api.v2
        .notebooks({ nid: notebookId }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connector-bindings']({ bindingId: binding.id })
        .snapshot.post();
      if (snapErr)
        throw new Error(
          typeof snapErr === 'string' ? snapErr : typeof snapErr === 'string' ? snapErr : '',
        );
      if (!snap) throw new Error('加载快照失败');
      setSnapshot(snap as Snapshot);
      toast.success(`快照已加载：${safeArray((snap as Snapshot).entries).length} 项`);
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
      const { data: result, error: importErr } = await api.v2
        .notebooks({ nid: notebookId }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connector-bindings']({ bindingId: binding.id }) // eslint-disable-next-line no-unexpected-multiline
        ['import-scope'].post(scopePayload);
      if (importErr)
        throw new Error(
          typeof importErr === 'string'
            ? importErr
            : typeof importErr === 'string'
              ? importErr
              : '',
        );
      if (!result) throw new Error('导入失败');
      setBinding((result as ImportScopeApplyResponse).binding);
      setImportResult(result as ImportScopeApplyResponse);
      await onSourcesChanged?.();
      toast.success(
        `导入完成：新增 ${safeArray((result as ImportScopeApplyResponse).importedSourceIds).length} · 复用 ${safeArray((result as ImportScopeApplyResponse).reusedSourceIds).length}`,
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
      const { data: result, error: syncErr } = await api.v2
        .notebooks({ nid: notebookId }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connector-bindings']({ bindingId: binding.id }) // eslint-disable-next-line no-unexpected-multiline
        ['sync-check'].post();
      if (syncErr)
        throw new Error(
          typeof syncErr === 'string' ? syncErr : typeof syncErr === 'string' ? syncErr : '',
        );
      if (!result) throw new Error('同步检查失败');
      setSyncCheck(result as SyncCheckResult);
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
      const { data: result, error: applyErr } = await api.v2
        .notebooks({ nid: notebookId }) // eslint-disable-next-line no-unexpected-multiline
        ['source-connector-bindings']({ bindingId: binding.id }) // eslint-disable-next-line no-unexpected-multiline
        ['sync-check'].apply.post({ syncCheckId: syncCheck.id });
      if (applyErr)
        throw new Error(
          typeof applyErr === 'string' ? applyErr : typeof applyErr === 'string' ? applyErr : '',
        );
      if (!result) throw new Error('同步应用失败');
      setBinding((result as ImportScopeApplyResponse).binding);
      setSyncApplyResult(result as ImportScopeApplyResponse);
      await onSourcesChanged?.();
      toast.success(
        `同步应用完成：新增 ${safeArray((result as ImportScopeApplyResponse).importedSourceIds).length} · 复用 ${safeArray((result as ImportScopeApplyResponse).reusedSourceIds).length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '同步应用失败';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [binding, busy, notebookId, onSourcesChanged, syncCheck]);

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
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1"
            >
              <ArrowBackIcon sx={{ fontSize: 16 }} />
              返回
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
              onLoadSnapshot={handleLoadSnapshot}
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
