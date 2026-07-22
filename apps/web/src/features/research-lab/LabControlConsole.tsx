import type { ResearchConclusionStatus } from '@crystalith/shared';
import { DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import { useCallback, useEffect, useRef, useState, type PointerEvent as PtrEvent } from 'react';

import { useLayer } from '../../shared/layer';
import { TestIds, tid } from '../../shared/testids';
import { LAB_PHASES, LAB_PHASE_LABELS, type LabPhase } from './fake/types';
import type { LabController } from './fake/useLabController';

const STATUS_OPTIONS: Array<ResearchConclusionStatus | 'none'> = [
  'none',
  'clear',
  'partial',
  'missing',
  'pending',
  'pruned',
];

const POS_KEY = 'crystalith.research-lab.console-pos';

function readPos(): { x: number; y: number } {
  try {
    const raw = sessionStorage.getItem(POS_KEY);
    if (!raw) return { x: 16, y: -1 };
    const p = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  } catch {
    /* ignore */
  }
  return { x: 16, y: -1 };
}

function persistPos(pos: { x: number; y: number }) {
  try {
    sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

/** Draggable floating Fake demo console — workspace-styled. */
export default function LabControlConsole({ lab }: { lab: LabController }) {
  const { style: layerStyle } = useLayer('popover');
  const collapsed = !lab.consoleOpen;
  const [pos, setPos] = useState(readPos);
  const dragRef = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pos.y >= 0) return;
    // Default: bottom-left once we know viewport
    const y = Math.max(16, window.innerHeight - (collapsed ? 56 : 420));
    const next = { x: 16, y };
    setPos(next);
    persistPos(next);
  }, [pos.y, collapsed]);

  const onPointerDown = useCallback(
    (e: PtrEvent) => {
      if (e.button !== 0) return;
      const el = panelRef.current;
      if (!el) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        ox: e.clientX,
        oy: e.clientY,
        sx: pos.x,
        sy: pos.y < 0 ? el.getBoundingClientRect().top : pos.y,
      };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: PtrEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.max(8, Math.min(window.innerWidth - 80, d.sx + (e.clientX - d.ox)));
    const ny = Math.max(8, Math.min(window.innerHeight - 48, d.sy + (e.clientY - d.oy)));
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback((e: PtrEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    setPos((p) => {
      persistPos(p);
      return p;
    });
  }, []);

  return (
    <div
      ref={panelRef}
      className="fixed flex w-[300px] max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      style={{
        ...layerStyle,
        left: pos.x,
        top: pos.y < 0 ? undefined : pos.y,
        bottom: pos.y < 0 ? 16 : undefined,
      }}
      {...tid(TestIds.researchLabConsole)}
    >
      <div
        className="flex cursor-grab items-center gap-1.5 border-b border-gray-100 bg-gray-50/80 px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        {...tid(TestIds.researchLabConsoleDrag)}
      >
        <DragIndicatorIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
        <div className="min-w-0 flex-1 text-[11px] font-semibold text-gray-800">
          试验控制台
          <span className="ml-1 font-normal text-gray-400">· Fake</span>
        </div>
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={(e) => {
            e.stopPropagation();
            lab.setConsoleOpen(!lab.consoleOpen);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </div>

      {collapsed ? null : (
        <div className="space-y-3 overflow-y-auto px-3 py-2 text-xs">
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              场景
            </div>
            <div className="flex flex-col gap-1">
              {lab.scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => lab.setScenarioId(s.id)}
                  className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    lab.scenarioId === s.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{s.shortLabel}</div>
                  <div
                    className={`truncate text-[10px] ${
                      lab.scenarioId === s.id ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              阶段跳转
            </div>
            <div className="grid grid-cols-2 gap-1">
              {LAB_PHASES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    lab.setPlaying(false);
                    lab.setPhase(p);
                  }}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    lab.phase === p
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {LAB_PHASE_LABELS[p]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => lab.startFromIdle()}
              className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-blue-700"
            >
              播放全程
            </button>
            <button
              type="button"
              onClick={() => lab.setPlaying(!lab.playing)}
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] hover:bg-gray-50"
            >
              {lab.playing ? '暂停' : '继续播放'}
            </button>
            <button
              type="button"
              onClick={() => lab.reset()}
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] hover:bg-gray-50"
            >
              重置
            </button>
          </section>

          <section>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              播放间隔 {lab.playbackMs}ms
              <input
                type="range"
                min={500}
                max={3000}
                step={100}
                value={lab.playbackMs}
                onChange={(e) => lab.setPlaybackMs(Number(e.target.value))}
                className="mt-1 w-full accent-blue-600"
              />
            </label>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              强制研究节点结论态
            </div>
            <select
              className="h-8 w-full rounded-md border border-gray-200 bg-white px-2"
              value={lab.forceStatus ?? 'none'}
              onChange={(e) => {
                const v = e.target.value as ResearchConclusionStatus | 'none';
                lab.setForceStatus(v === 'none' ? null : v);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'none' ? '跟随场景' : s}
                </option>
              ))}
            </select>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              指标覆盖（可选）
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['tokensUsed', 'Token'],
                  ['sourcesRetrieved', '来源'],
                  ['pendingNodes', '待处理'],
                  ['elapsedSec', '秒'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-[10px] text-gray-500">
                  {label}
                  <input
                    type="number"
                    className="mt-0.5 h-7 w-full rounded border border-gray-200 px-1.5 text-[11px]"
                    value={lab.metricsOverride?.[key] ?? ''}
                    placeholder="自动"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        const next = { ...lab.metricsOverride };
                        delete next[key];
                        lab.setMetricsOverride(Object.keys(next).length ? next : null);
                        return;
                      }
                      lab.setMetricsOverride({
                        ...lab.metricsOverride,
                        [key]: Number(raw),
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-700"
              onClick={() => lab.setMetricsOverride(null)}
            >
              清除指标覆盖
            </button>
          </section>

          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              选中节点
            </div>
            <select
              className="h-8 w-full rounded-md border border-gray-200 bg-white px-2"
              value={lab.selectedNodeId ?? ''}
              onChange={(e) => lab.setSelectedNodeId(e.target.value || null)}
            >
              <option value="">（无）</option>
              {lab.derived.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[10px] leading-relaxed text-gray-500">
            当前：{lab.scenario.shortLabel} · {LAB_PHASE_LABELS[lab.phase as LabPhase]} · 节点{' '}
            {lab.derived.nodes.length} · 边 {lab.derived.edges.length}
            {lab.confirmChoice ? ` · 确认选择：${lab.confirmChoice}` : ''}
            <div className="mt-1 text-gray-400">布局/连线请用画布左下角「画布」设置</div>
          </section>
        </div>
      )}
    </div>
  );
}
