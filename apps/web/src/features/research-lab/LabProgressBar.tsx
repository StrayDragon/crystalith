import { useEffect, useRef, useState } from 'react';

import { useLayer } from '../../shared/layer';
import { TestIds, tid } from '../../shared/testids';
import type { LabPhase } from '../research-lab-demo/fake/types';
import { LAB_PHASE_LABELS } from '../research-lab-demo/fake/types';
import { formatProgressTime, type LabProgressLedgerItem } from './labProgressLedger';

export type LabProgressBarProps = {
  phase: LabPhase;
  /** Real % from searches + research-node completion (never PHASE_PROGRESS). */
  progressPct: number;
  searchesUsed: number;
  maxSearches: number;
  researchDone: number;
  researchTotal: number;
  events: LabProgressLedgerItem[];
  onSelectNodeId?: (nodeId: string) => void;
};

export default function LabProgressBar({
  phase,
  progressPct,
  searchesUsed,
  maxSearches,
  researchDone,
  researchTotal,
  events,
  onSelectNodeId,
}: LabProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progressPct));
  const failed = phase === 'failed';
  const latestHeadline =
    [...events].reverse().find((e) => e.headline)?.headline ?? LAB_PHASE_LABELS[phase];
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { style: layerStyle } = useLayer('dropdown');

  useEffect(() => {
    if (!detailsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setDetailsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [detailsOpen]);

  const timeline = events.slice(-40).reverse();

  return (
    <div
      ref={rootRef}
      className="relative mx-2 min-w-0 flex-1"
      {...tid(TestIds.researchLabProgress)}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-0.5 py-0.5 text-left hover:bg-gray-50"
        aria-expanded={detailsOpen}
        title={detailsOpen ? '收起进度详情' : '点击查看进度账本'}
        onClick={() => setDetailsOpen((v) => !v)}
      >
        <span className="w-[4.5rem] shrink-0 truncate text-[11px] font-medium text-gray-700">
          {LAB_PHASE_LABELS[phase]}
        </span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-200/80">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              failed
                ? 'bg-rose-500'
                : pct >= 100
                  ? 'bg-blue-600'
                  : 'bg-gradient-to-r from-blue-500 to-sky-400'
            }`}
            style={{ width: `${pct}%` }}
          />
          {pct > 0 && pct < 100 && !failed ? (
            <div
              className="absolute inset-y-0 w-16 animate-pulse bg-white/30"
              style={{ left: `calc(${pct}% - 2rem)` }}
            />
          ) : null}
        </div>
        <span className="hidden min-w-0 max-w-[10rem] truncate text-[10px] text-gray-500 sm:inline">
          {latestHeadline}
        </span>
        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-gray-500">{pct}%</span>
      </button>

      {detailsOpen ? (
        <div className="absolute left-0 right-0 top-full pt-2" style={layerStyle}>
          <div
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[11px] shadow-xl"
            {...tid(TestIds.researchLabProgressLedger)}
          >
            <div className="grid grid-cols-3 gap-2 text-gray-600">
              <div>
                <div className="text-[9px] uppercase text-gray-400">事件</div>
                <div className="font-mono font-semibold text-gray-800">{events.length}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-gray-400">检索预算</div>
                <div className="font-mono font-semibold text-gray-800">
                  {searchesUsed}/{maxSearches}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-gray-400">支路</div>
                <div className="font-mono font-semibold text-gray-800">
                  {researchDone}/{researchTotal}
                </div>
              </div>
            </div>
            {timeline.length > 0 ? (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto border-t border-gray-100 pt-1.5 text-gray-600">
                {timeline.map((ev) => (
                  <li key={ev.id} className="flex gap-2">
                    <span className="w-[3.6rem] shrink-0 font-mono text-[9px] text-gray-400">
                      {formatProgressTime(ev.at)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-gray-400">{ev.kind}</span>
                      {ev.headline ? ` · ${ev.headline}` : ''}
                      {ev.nodeId && onSelectNodeId ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNodeId(ev.nodeId!);
                            }}
                          >
                            {ev.nodeId}
                          </button>
                        </>
                      ) : ev.nodeId ? (
                        <span className="text-gray-400"> · {ev.nodeId}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-t border-gray-100 pt-1.5 text-gray-400">暂无进度事件</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
