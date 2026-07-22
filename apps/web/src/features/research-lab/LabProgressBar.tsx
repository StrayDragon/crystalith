import { useEffect, useRef, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import type { LabMetrics, LabPhase } from './fake/types';
import { LAB_PHASE_LABELS } from './fake/types';

const PHASE_PROGRESS: Record<LabPhase, number> = {
  idle: 0,
  decompose: 14,
  explore: 36,
  evaluate: 55,
  integrate: 72,
  awaiting_confirm: 84,
  completed: 100,
  failed: 100,
};

export default function LabProgressBar({
  phase,
  metrics,
  activityLog,
}: {
  phase: LabPhase;
  metrics: LabMetrics;
  activityLog: string[];
}) {
  const pct = PHASE_PROGRESS[phase] ?? 0;
  const failed = phase === 'failed';
  const latest = activityLog.slice(-4);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={rootRef}
      className="relative mx-2 min-w-0 max-w-xl flex-1"
      {...tid(TestIds.researchLabProgress)}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-0.5 py-0.5 text-left hover:bg-gray-50"
        aria-expanded={detailsOpen}
        title={detailsOpen ? '收起进度详情' : '点击查看进度详情'}
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
        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-gray-500">{pct}%</span>
      </button>

      {detailsOpen ? (
        <div className="absolute left-0 right-0 top-full z-[100] pt-2">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[11px] shadow-xl">
            <div className="grid grid-cols-4 gap-2 text-gray-600">
              <div>
                <div className="text-[9px] uppercase text-gray-400">Token</div>
                <div className="font-mono font-semibold text-gray-800">
                  {metrics.tokensUsed.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-gray-400">来源</div>
                <div className="font-mono font-semibold text-gray-800">
                  {metrics.sourcesRetrieved}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-gray-400">待处理</div>
                <div className="font-mono font-semibold text-gray-800">{metrics.pendingNodes}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-gray-400">用时</div>
                <div className="font-mono font-semibold text-gray-800">
                  {Math.floor(metrics.elapsedSec / 60)}:
                  {String(metrics.elapsedSec % 60).padStart(2, '0')}
                </div>
              </div>
            </div>
            {latest.length > 0 ? (
              <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-1.5 text-gray-500">
                {latest.map((line) => (
                  <li key={line} className="truncate">
                    · {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
