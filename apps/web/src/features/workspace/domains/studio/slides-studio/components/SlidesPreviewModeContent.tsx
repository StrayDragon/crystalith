import { Button, Textarea, Typography } from '@material-tailwind/react';

import { QUEUE_STATUS_LABELS } from '../constants';
import type { SlidesPreviewModeContentProps } from '../types';

export function SlidesPreviewModeContent({
  title,
  outlineTitle,
  draft,
  outlineItems,
  slidesEngine,
  queueStatus,
  showMarkdownEditor,
  onToggleMarkdownEditor,
  markdown,
  onMarkdownChange,
  selectionLabel,
}: SlidesPreviewModeContentProps) {
  const previewTitle = title.trim() || outlineTitle.trim() || draft?.title || '演示';
  const slideCount = outlineItems.length || draft?.outline?.slides?.length || 0;
  const outlinePreview = outlineItems.slice(0, 4);
  const queueLabel = queueStatus
    ? QUEUE_STATUS_LABELS[queueStatus]
    : draft?.status === 'running'
      ? '生成中'
      : draft?.status === 'error'
        ? '失败'
        : '就绪';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Typography
              variant="small"
              className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold"
            >
              演示信息
            </Typography>
            <Typography
              variant="h6"
              className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate"
            >
              {previewTitle}
            </Typography>
            <Typography
              variant="small"
              className="text-xs text-gray-600 dark:text-slate-300 font-medium"
            >
              {slideCount ? `${slideCount} 张幻灯片` : '尚未生成大纲'}
            </Typography>
          </div>
          <Button
            variant="text"
            size="sm"
            onClick={onToggleMarkdownEditor}
            className="px-2 py-1 text-xs text-gray-600 dark:text-slate-300"
          >
            {showMarkdownEditor ? '隐藏 Markdown' : '查看 Markdown'}
          </Button>
        </div>
        {outlinePreview.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
            <Typography
              variant="small"
              className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold"
            >
              大纲速览
            </Typography>
            <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-slate-200">
              {(() => {
                const keyCounts = new Map<string, number>();
                return outlinePreview.map((item, index) => {
                  const baseKey = JSON.stringify(item);
                  const ordinal = keyCounts.get(baseKey) ?? 0;
                  keyCounts.set(baseKey, ordinal + 1);
                  const outlinePreviewKey = `${baseKey}:${ordinal}`;
                  return (
                    <li key={outlinePreviewKey} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      <span className="truncate">{item.title || `幻灯片 ${index + 1}`}</span>
                    </li>
                  );
                });
              })()}
            </ul>
            {outlineItems.length > outlinePreview.length && (
              <Typography
                variant="small"
                className="mt-2 text-[11px] text-gray-500 dark:text-slate-400"
              >
                还有 {outlineItems.length - outlinePreview.length} 张幻灯片
              </Typography>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-300">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
            引擎：{slidesEngine || '未配置'}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
            状态：{queueLabel || '就绪'}
          </div>
        </div>
      </div>
      {showMarkdownEditor && (
        <div className="space-y-2">
          <Textarea
            label="Slides Markdown"
            value={markdown}
            onChange={(event) => onMarkdownChange(event.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
          <Typography variant="small" className="text-gray-600 dark:text-slate-300">
            {selectionLabel}
          </Typography>
        </div>
      )}
      {!showMarkdownEditor && (
        <Typography variant="small" className="text-gray-600 dark:text-slate-300">
          {selectionLabel}
        </Typography>
      )}
    </div>
  );
}
