import type {
  ExtractorInfo,
  NotebookExtractorsPolicyView as NotebookExtractorsPolicy,
  PatchNotebookExtractorPolicy as PatchNotebookExtractorsPolicyRequest,
} from '@crystalith/shared';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { copyToClipboard } from '../../../../../shared/clipboard';
import { useLayer } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import { toast } from '../../../../../shared/toast';
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap';

interface ExtractorPolicyDialogProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  isLoading?: boolean;
  extractors: ExtractorInfo[];
  policy: NotebookExtractorsPolicy | null;
  fallbackEnabled?: boolean | null;
  onPatchPolicy?: (patch: PatchNotebookExtractorsPolicyRequest) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}

function labelForMode(mode: string): string {
  switch (mode) {
    case 'custom':
      return '自定义';
    default:
      return '遵循全局';
  }
}

export default function ExtractorPolicyDialog({
  open,
  onClose,
  isConnected,
  isLoading = false,
  extractors,
  policy,
  fallbackEnabled = null,
  onPatchPolicy,
  onRefresh,
}: ExtractorPolicyDialogProps) {
  const { style: modalStyle } = useLayer('modal');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: onClose,
  });

  const mode = policy?.mode ?? 'inherit_global';
  const enabledSet = useMemo(
    () => new Set(policy?.enabledExtractors ?? []),
    [policy?.enabledExtractors],
  );

  const sortedExtractors = useMemo(() => {
    return [...extractors].toSorted((a, b) => {
      const ap = a.priority ?? 10_000;
      const bp = b.priority ?? 10_000;
      if (ap !== bp) return ap - bp;
      return a.type.localeCompare(b.type);
    });
  }, [extractors]);

  const usableCount = useMemo(() => {
    return extractors.filter((ext) => ext.enabled && ext.available).length;
  }, [extractors]);

  const handleCopy = useCallback(async (value: string) => {
    await copyToClipboard(value);
    toast.success('已复制到剪贴板');
  }, []);

  const canMutate = Boolean(isConnected && onPatchPolicy && !isLoading && !isSaving);

  const handleSetMode = useCallback(
    async (nextMode: 'inherit_global' | 'custom') => {
      if (!canMutate) return;
      if (mode === nextMode) return;
      setIsSaving(true);
      try {
        await onPatchPolicy?.({ mode: nextMode });
        toast.success(`已切换为：${labelForMode(nextMode)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '更新失败';
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [canMutate, mode, onPatchPolicy],
  );

  const handleToggleExtractor = useCallback(
    async (extractorType: string) => {
      if (!canMutate) return;
      if (mode !== 'custom') return;
      const next = new Set(enabledSet);
      if (next.has(extractorType)) {
        next.delete(extractorType);
      } else {
        next.add(extractorType);
      }
      const nextList = Array.from(next).toSorted((a: string, b: string) => a.localeCompare(b));
      setIsSaving(true);
      try {
        await onPatchPolicy?.({ enabledExtractors: nextList });
      } catch (error) {
        const message = error instanceof Error ? error.message : '更新失败';
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [canMutate, enabledSet, mode, onPatchPolicy],
  );

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isSaving) return;
    try {
      await onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '刷新失败';
      toast.error(message);
    }
  }, [isSaving, onRefresh]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="提取器设置"
      {...tid(TestIds.sourcesExtractorDialog)}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭提取器设置"
        tabIndex={-1}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 ux-modal-in overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-slate-100">
              网页提取器
            </div>
            <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400">
              模式：{labelForMode(mode)} · 可用：{usableCount}/{extractors.length}
              {fallbackEnabled == null ? '' : ` · 回退：${fallbackEnabled ? '开启' : '关闭'}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={!onRefresh || isSaving}
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

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {!isConnected ? (
            <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                未连接到后端
              </div>
              <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                暂无法获取或修改提取器设置。
              </div>
            </div>
          ) : null}

          <div className="mb-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-2">策略</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSetMode('inherit_global')}
                disabled={!canMutate}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  mode === 'inherit_global'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                遵循全局
              </button>
              <button
                type="button"
                onClick={() => void handleSetMode('custom')}
                disabled={!canMutate}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  mode === 'custom'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                自定义
              </button>
              {isSaving ? (
                <div className="text-[11px] text-gray-500 dark:text-slate-400">保存中…</div>
              ) : null}
            </div>
            <div className="mt-2 text-[11px] text-gray-600 dark:text-slate-400">
              说明：插件的安装/禁用由运维控制；此处仅影响 notebook 维度的启用集合。
            </div>
          </div>

          {isLoading && extractors.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-700 dark:text-slate-200">
              加载中…
            </div>
          ) : null}

          <div className="space-y-2">
            {sortedExtractors.map((ext) => {
              const desiredEnabled = mode === 'custom' ? enabledSet.has(ext.type) : ext.enabled;
              const toggleDisabled = !canMutate || mode !== 'custom';

              const enabledTone = ext.enabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200';
              const availableTone = ext.available
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';

              return (
                <div
                  key={ext.type}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {ext.displayName}
                        </div>
                        <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          <span className="font-mono">{ext.type}</span>
                        </div>
                        <div
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${enabledTone}`}
                        >
                          {ext.enabled ? 'enabled' : 'disabled'}
                        </div>
                        <div
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${availableTone}`}
                        >
                          {ext.available ? 'available' : 'unavailable'}
                        </div>
                        {ext.requiresApiKey ? (
                          <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                            需要 API Key
                          </div>
                        ) : null}
                        {ext.requiresService ? (
                          <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                            需要服务
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                        {ext.description}
                      </div>

                      {ext.pluginId ? (
                        <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                          plugin: <span className="font-mono">{ext.pluginId}</span>
                        </div>
                      ) : null}

                      {ext.errorCode ? (
                        <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-400">
                          errorCode: <span className="font-mono">{ext.errorCode}</span>
                          {ext.message ? ` · ${ext.message}` : ''}
                        </div>
                      ) : null}

                      {ext.recoveryHint ? (
                        <div className="mt-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold text-gray-800 dark:text-slate-200">
                              恢复提示
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleCopy(ext.recoveryHint ?? '')}
                              className="px-2 py-1 rounded-md text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1"
                            >
                              <ContentCopyIcon sx={{ fontSize: 14 }} />
                              复制
                            </button>
                          </div>
                          <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-700 dark:text-slate-300">
                            {ext.recoveryHint}
                          </pre>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-shrink-0">
                      <label
                        className={`flex items-center gap-2 text-[11px] ${toggleDisabled ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={desiredEnabled}
                          disabled={toggleDisabled}
                          onChange={() => void handleToggleExtractor(ext.type)}
                          className="h-4 w-4"
                        />
                        <span className="text-gray-700 dark:text-slate-200">
                          {mode === 'custom' ? '启用' : '（切换到自定义后可修改）'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
