/**
 * Dedup "reuse existing source?" dialog (W5) — replaces window.confirm in the
 * upload / URL import flows so the choice is styled and focus-trapped like
 * every other in-app dialog.
 */
import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../shared/layer';
import { useFocusTrap } from '../../../../shared/ui';
import type { DedupConfirmRequest } from './useSources';

export default function SourceDedupConfirmDialog({
  request,
  onResolve,
}: {
  request: DedupConfirmRequest | null;
  onResolve: (reuse: boolean) => void;
}) {
  const { style: modalStyle } = useLayer('modal');
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap({
    active: request !== null,
    containerRef: panelRef,
    onEscape: () => {
      onResolve(false);
    },
  });
  if (!request) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ ...modalStyle, backgroundColor: 'rgb(15 23 42 / 0.45)' }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭"
        onClick={() => {
          onResolve(false);
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label="检测到重复来源"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">检测到重复来源</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{request.existingName}</p>
        </div>
        <div className="px-4 py-3 text-xs text-slate-600">
          复用已有来源不会重复占用存储；选择「仍创建新来源」则保留两份独立副本。
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onResolve(false);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          >
            仍创建新来源
          </button>
          <button
            type="button"
            onClick={() => {
              onResolve(true);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            复用已有来源
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
