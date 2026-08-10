import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Map as MapIcon,
  Tune as TuneIcon,
  SwapHoriz as SwapHorizIcon,
  SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import { useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import {
  LAB_EDGE_PATH_PRESETS,
  LAB_LAYOUT_ALGORITHMS,
  type LabEdgePathPreset,
  type LabLayoutAlgorithm,
  type LabLayoutDirection,
} from './model/types';

/**
 * Canvas settings chip — rendered beside xyflow Controls (same Panel row).
 */
export default function LabCanvasSettings({
  direction,
  onDirection,
  algorithm,
  onAlgorithm,
  edgePathPreset,
  onEdgePathPreset,
  showMiniMap,
  onShowMiniMap,
}: {
  direction: LabLayoutDirection;
  onDirection: (d: LabLayoutDirection) => void;
  algorithm: LabLayoutAlgorithm;
  onAlgorithm: (a: LabLayoutAlgorithm) => void;
  edgePathPreset: LabEdgePathPreset;
  onEdgePathPreset: (p: LabEdgePathPreset) => void;
  showMiniMap: boolean;
  onShowMiniMap: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col items-start" {...tid(TestIds.researchLabCanvasSettings)}>
      {open ? (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-10 w-[min(280px,calc(100vw-6rem))] rounded-xl border border-gray-200 bg-white p-2 shadow-md">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              画布设置
            </span>
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onClick={() => setOpen(false)}
              aria-label="收起画布设置"
            >
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <div className="mb-1 text-[9px] font-medium text-gray-400">方向</div>
              <div
                className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                {...tid(TestIds.researchLabLayoutTb)}
              >
                <button
                  type="button"
                  title="上下布局（TB）"
                  onClick={() => onDirection('TB')}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                    direction === 'TB' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-white'
                  }`}
                >
                  <SwapVertIcon sx={{ fontSize: 15 }} />
                </button>
                <button
                  type="button"
                  title="左右布局（LR）"
                  onClick={() => onDirection('LR')}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                    direction === 'LR' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-white'
                  }`}
                  {...tid(TestIds.researchLabLayoutLr)}
                >
                  <SwapHorizIcon sx={{ fontSize: 15 }} />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[9px] font-medium text-gray-400">布局</div>
              <div
                className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                {...tid(TestIds.researchLabLayoutAlgorithm)}
              >
                {LAB_LAYOUT_ALGORITHMS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.title}
                    onClick={() => onAlgorithm(a.id)}
                    className={`h-7 rounded-md px-2 text-[10px] font-medium ${
                      algorithm === a.id
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-500 hover:bg-white'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[9px] font-medium text-gray-400">连线</div>
              <div
                className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                {...tid(TestIds.researchLabEdgePathPresets)}
              >
                {LAB_EDGE_PATH_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.title}
                    onClick={() => onEdgePathPreset(p.id)}
                    className={`h-7 rounded-md px-2 text-[10px] font-medium ${
                      edgePathPreset === p.id
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-500 hover:bg-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[9px] font-medium text-gray-400">叠加</div>
              <button
                type="button"
                title={showMiniMap ? '隐藏小地图' : '显示小地图'}
                onClick={() => onShowMiniMap(!showMiniMap)}
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium ${
                  showMiniMap
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-white'
                }`}
              >
                <MapIcon sx={{ fontSize: 13 }} />
                小地图
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex h-[34px] items-center gap-1 rounded-lg border px-2 text-[11px] font-medium shadow-sm transition-colors ${
          open
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        title="画布设置（方向 / 布局 / 连线）"
      >
        <TuneIcon sx={{ fontSize: 14 }} />
        画布
        {open ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
      </button>
    </div>
  );
}
