import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../shared/layer';
import { TestIds, tid } from '../../shared/testids';
import type { ForkDraft, PrunePreview } from './fake/graphMutations';

export function LabForkDialog({
  open,
  draft,
  edgeLabel,
  onChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  draft: ForkDraft;
  edgeLabel: string;
  onChange: (next: ForkDraft) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { style: modalStyle } = useLayer('modal', 2);
  if (!open) return null;
  const canSubmit = draft.title.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ ...modalStyle, backgroundColor: 'rgb(15 23 42 / 0.45)' }}
      {...tid(TestIds.researchLabForkDialog)}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="lab-fork-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) onConfirm();
        }}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="lab-fork-title" className="text-sm font-semibold text-slate-900">
            创建分叉研究节点
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            沿边「{edgeLabel}」新建支路，确认后汇入唯一结论并触发重塑。
          </p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400">
            标题 *
            <input
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs"
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              autoFocus
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400">
            研究问题 / 检索 query
            <textarea
              className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              value={draft.query}
              onChange={(e) => onChange({ ...draft, query: e.target.value })}
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400">
            摘要说明
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              value={draft.summary}
              onChange={(e) => onChange({ ...draft, summary: e.target.value })}
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#0f766e' }}
          >
            确认分叉
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function LabPruneDialog({
  open,
  preview,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  preview: PrunePreview | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { style: modalStyle } = useLayer('modal', 2);
  if (!open || !preview) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ ...modalStyle, backgroundColor: 'rgb(15 23 42 / 0.45)' }}
      {...tid(TestIds.researchLabPruneDialog)}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="lab-prune-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onConfirm();
        }}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="lab-prune-title" className="text-sm font-semibold text-slate-900">
            确认剪枝
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            将淡化「{preview.targetTitle}
            」及仅由其独占的下游支路；共享下游保留。图谱仍贯通到唯一结论。
          </p>
        </div>
        <div className="space-y-3 px-4 py-3 text-xs text-slate-700">
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-red-700/80">
              将淡化的节点
            </div>
            {preview.fadedTitles.length === 0 ? (
              <p className="text-slate-500">无额外下游（仅淡化本节点）</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {preview.fadedTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {preview.keepsFailedMerge
              ? '保留到结论的「汇入」边（弱化显示）；该支路视为汇入失败，不参与有效结论。'
              : '拓扑保留；节点标为已剪枝并淡化显示。'}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            {...tid(TestIds.researchLabPruneCancel)}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-w-[7rem] rounded-lg px-4 py-2 text-xs font-semibold shadow-sm"
            style={{ backgroundColor: '#b91c1c', color: '#ffffff' }}
            {...tid(TestIds.researchLabPruneConfirm)}
          >
            确认剪枝
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Escape to close when open — small helper for parents if needed. */
export function useDialogEscape(open: boolean, onCancel: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
}
