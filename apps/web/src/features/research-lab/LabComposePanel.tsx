/**
 * Lab idle Compose — create a deep-research task (Eden ResearchRun or fixture playback).
 * Field shape mirrors ResearchCreate (topic + channels + sourceIds).
 */
import { Spinner } from '@material-tailwind/react';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../../api/eden';
import { parseServerError } from '../../api/parseServerError';
import { TestIds, tid } from '../../shared/testids';
import { LAB_COMPOSE_DEPTH_OPTIONS, labComposeDepthBudgetHint } from './labComposeDepth';
import {
  LAB_COMPOSE_BLOCK_MESSAGES,
  resolveLabComposeBlockReason,
  type LabComposeDraft,
} from './labComposeGate';

export type LabComposeMode = 'eden' | 'fixture';

export interface LabComposeSourceOption {
  id: number;
  filename: string;
  status: string;
}

export interface LabComposePanelProps {
  notebookId: number;
  mode: LabComposeMode;
  exampleTopic: string;
  draft: LabComposeDraft;
  onChange: (patch: Partial<LabComposeDraft>) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/** Neutral Eden example topic (no fixture / xlsx authority). */
export const EDEN_EXAMPLE_TOPIC =
  '请对比主流方案在延迟、召回与运维成本上的权衡，并给出可落地建议。';

export function labComposeDescription(mode: LabComposeMode): string {
  if (mode === 'eden') {
    return '填写主题与检索通道后开始。将创建真实 ResearchRun，并进入研究图与实时进度。';
  }
  return '填写主题与检索通道后开始。当前为演示回放（xlsx 选型 fixture）；接线后将创建真实 ResearchRun。';
}

export function labComposeHint(mode: LabComposeMode): string {
  if (mode === 'eden') {
    return '创建后进入研究图与 SSE 进度。';
  }
  return '演示：开始后将进入研究图回放；正式环境将创建 ResearchRun 任务。';
}

export function labComposeExampleLabel(mode: LabComposeMode): string {
  if (mode === 'eden') {
    return '填入示例主题';
  }
  return '填入示例主题（xlsx 选型）';
}

export default function LabComposePanel({
  notebookId,
  mode,
  exampleTopic,
  draft,
  onChange,
  onSubmit,
  submitting = false,
}: LabComposePanelProps) {
  const [sources, setSources] = useState<LabComposeSourceOption[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    setSourcesError('');
    void api.v2
      .notebooks({ nid: notebookId })
      .sources.get({ query: { offset: 0, limit: 200 } })
      .then((r) => {
        if (cancelled) return;
        if (r.error) {
          setSourcesError(parseServerError(r.error).message);
          setSources([]);
          return;
        }
        const items = (r.data?.items ?? []).map((s) => ({
          id: s.id,
          filename: s.filename,
          status: s.status,
        }));
        setSources(items);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSourcesError(error instanceof Error ? error.message : '加载来源失败');
        setSources([]);
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const readySources = useMemo(() => sources.filter((s) => s.status === 'ready'), [sources]);

  const block = resolveLabComposeBlockReason(draft);
  const canSubmit = block === null && !submitting;
  const description = labComposeDescription(mode);
  const hint = labComposeHint(mode);
  const exampleLabel = labComposeExampleLabel(mode);

  const toggleSource = (id: number) => {
    const set = new Set(draft.selectedSourceIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ selectedSourceIds: [...set] });
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-gray-50/90 px-4 py-8 backdrop-blur-[2px]"
      {...tid(TestIds.researchLabCompose)}
    >
      <div className="my-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-gray-900">新建深度研究</h1>
          <p className="text-[12px] leading-relaxed text-gray-500">{description}</p>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[11px] font-medium text-gray-700">研究主题</span>
          <textarea
            rows={4}
            value={draft.topic}
            placeholder="目标、范围、期望输出…"
            onChange={(e) => onChange({ topic: e.target.value })}
            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/25"
            {...tid(TestIds.researchLabComposeTopic)}
          />
          <button
            type="button"
            className="text-[11px] text-blue-600 hover:text-blue-700"
            onClick={() => onChange({ topic: exampleTopic })}
            {...tid(TestIds.researchLabComposeExample)}
          >
            {exampleLabel}
          </button>
        </label>

        <div className="mt-4 space-y-2">
          <span className="text-[11px] font-medium text-gray-700">检索通道</span>
          <label className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-[12px] text-gray-800">
            <input
              type="checkbox"
              checked={draft.useNotebookSources}
              onChange={(e) => onChange({ useNotebookSources: e.target.checked })}
              {...tid(TestIds.researchLabComposeUseSources)}
            />
            使用笔记本来源
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-[12px] text-gray-800">
            <input
              type="checkbox"
              checked={draft.allowWeb}
              onChange={(e) => onChange({ allowWeb: e.target.checked })}
              {...tid(TestIds.researchLabComposeAllowWeb)}
            />
            允许外网检索
          </label>
        </div>

        <div className="mt-4 space-y-2" {...tid(TestIds.researchLabComposeDepth)}>
          <span className="text-[11px] font-medium text-gray-700">研究深度</span>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50/80 p-1">
            {LAB_COMPOSE_DEPTH_OPTIONS.map((opt) => {
              const active = draft.depth === opt.value;
              const depthTid =
                opt.value === 'shallow'
                  ? TestIds.researchLabComposeDepthShallow
                  : opt.value === 'medium'
                    ? TestIds.researchLabComposeDepthMedium
                    : TestIds.researchLabComposeDepthDeep;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ depth: opt.value })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  {...tid(depthTid)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500">{labComposeDepthBudgetHint(draft.depth)}</p>
        </div>

        {draft.useNotebookSources ? (
          <div className="mt-4 space-y-2" {...tid(TestIds.researchLabComposeSourceList)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-gray-700">选择就绪来源</span>
              {sourcesLoading ? <Spinner className="h-3.5 w-3.5 text-blue-600" /> : null}
            </div>
            {sourcesError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                无法加载来源：{sourcesError}。可改用外网检索继续
                {mode === 'fixture' ? '演示' : ''}。
              </p>
            ) : null}
            {!sourcesLoading && !sourcesError && readySources.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                当前笔记本没有就绪来源。请先在工作区上传，或取消勾选「使用笔记本来源」。
              </p>
            ) : null}
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {readySources.map((s) => {
                const checked = draft.selectedSourceIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 text-[12px] hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleSource(s.id)}
                      />
                      <span className="min-w-0 truncate text-gray-800">{s.filename}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {block ? (
          <p className="mt-3 text-[11px] text-amber-800" {...tid(TestIds.researchLabComposeHint)}>
            {LAB_COMPOSE_BLOCK_MESSAGES[block]}
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-gray-400" {...tid(TestIds.researchLabComposeHint)}>
            {hint}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
            {...tid(TestIds.researchLabComposeSubmit)}
          >
            {submitting ? '创建中…' : '开始深度研究'}
          </button>
        </div>
      </div>
    </div>
  );
}
