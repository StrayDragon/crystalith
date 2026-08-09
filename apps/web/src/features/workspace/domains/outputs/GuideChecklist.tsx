import { useEffect, useMemo, useState } from 'react';

import { CollapsibleSection, ProgressIndicator } from './StudioPrimitives';

export interface GuideModule {
  title?: string | null;
  objective?: { text?: string | null } | null;
  keyPoints?: Array<{ text?: string | null }> | null;
}

interface GuideChecklistProps {
  modules: GuideModule[];
  className?: string;
}

export default function GuideChecklist({ modules, className }: GuideChecklistProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const moduleKeyCounts = new Map<string, number>();

  useEffect(() => {
    setCompleted(new Set());
  }, [modules]);

  const progress = useMemo(() => {
    const total = modules.length;
    const done = completed.size;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, percent };
  }, [completed, modules.length]);

  if (modules.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-slate-400">暂无指南内容。</div>;
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">学习进度</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">
              已完成 {progress.done} / {progress.total}
            </div>
          </div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums dark:text-slate-100">
            {progress.percent}%
          </div>
        </div>
        <div className="mt-3">
          <ProgressIndicator current={progress.done} total={progress.total} label="总体进度" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {modules.map((module, index) => {
          const isDone = completed.has(index);
          const keyPoints = module.keyPoints ?? [];
          // intentionally || — empty objective text is missing
          // oxlint-disable-next-line typescript/prefer-nullish-coalescing
          const summary = module.objective?.text || '';
          const moduleKeyBase = JSON.stringify({
            title: module.title ?? '',
            objective: summary,
            keyPoints: keyPoints.map((point) => point.text ?? ''),
          });
          const moduleKeyOrdinal = moduleKeyCounts.get(moduleKeyBase) ?? 0;
          moduleKeyCounts.set(moduleKeyBase, moduleKeyOrdinal + 1);
          const moduleKey = `${moduleKeyBase}:${moduleKeyOrdinal}`;
          const pointKeyCounts = new Map<string, number>();
          return (
            <CollapsibleSection
              key={moduleKey}
              id={`guide-module-${index}`}
              // intentionally || — empty title is missing
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing
              title={module.title || `模块 ${index + 1}`}
              summary={summary}
              defaultOpen={index === 0}
              headerRight={
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => {
                      setCompleted((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) {
                          next.delete(index);
                        } else {
                          next.add(index);
                        }
                        return next;
                      });
                    }}
                    name={`guide-module-${index}-done`}
                    // intentionally || — empty title is missing
                    // oxlint-disable-next-line typescript/prefer-nullish-coalescing
                    aria-label={`${module.title || `模块 ${index + 1}`} 完成状态`}
                  />
                  {isDone ? '已完成' : '未完成'}
                </label>
              }
            >
              {summary ? (
                <div className="mb-3 text-sm text-gray-700 dark:text-slate-200">
                  目标：{summary}
                </div>
              ) : null}
              {keyPoints.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-slate-200">
                  {keyPoints.map((point) => {
                    const baseKey = point.text ?? '';
                    const ordinal = pointKeyCounts.get(baseKey) ?? 0;
                    pointKeyCounts.set(baseKey, ordinal + 1);
                    const pointKey = `${baseKey || 'point'}:${ordinal}`;
                    return (
                      <li key={pointKey}>
                        {/* intentionally || — empty string is missing */}
                        {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing */}
                        {point.text || '要点'}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm text-gray-500 dark:text-slate-400">暂无要点。</div>
              )}
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
