import { useEffect, useMemo, useState } from 'react';

import { CollapsibleSection, ProgressIndicator } from './StudioPrimitives';

export interface GuideModule {
  title?: string | null;
  objective?: { text?: string | null } | null;
  key_points?: Array<{ text?: string | null }> | null;
}

interface GuideChecklistProps {
  modules: GuideModule[];
  className?: string;
}

export default function GuideChecklist({ modules, className }: GuideChecklistProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

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
    return <div className="text-sm text-gray-500">暂无指南内容。</div>;
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">学习进度</div>
            <div className="text-xs text-gray-500">已完成 {progress.done} / {progress.total}</div>
          </div>
          <div className="text-sm font-semibold text-gray-900 tabular-nums">{progress.percent}%</div>
        </div>
        <div className="mt-3">
          <ProgressIndicator current={progress.done} total={progress.total} label="总体进度" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {modules.map((module, index) => {
          const isDone = completed.has(index);
          const keyPoints = module.key_points ?? [];
          const summary = module.objective?.text || '';
          return (
            <CollapsibleSection
              key={`module-${index}`}
              id={`guide-module-${index}`}
              title={module.title || `模块 ${index + 1}`}
              summary={summary}
              defaultOpen={index === 0}
              headerRight={(
                <label className="flex items-center gap-2 text-xs text-gray-600">
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
                  />
                  {isDone ? '已完成' : '未完成'}
                </label>
              )}
            >
              {summary ? (
                <div className="mb-3 text-sm text-gray-700">目标：{summary}</div>
              ) : null}
              {keyPoints.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-gray-700">
                  {keyPoints.map((point, pointIndex) => (
                    <li key={`${index}-${pointIndex}`}>{point.text || '要点'}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">暂无要点。</div>
              )}
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
