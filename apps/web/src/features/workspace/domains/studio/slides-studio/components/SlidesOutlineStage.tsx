import { Button, Input, Textarea, Typography } from '@material-tailwind/react';

import type { SlidesOutlineStageProps } from '../types';

export function SlidesOutlineStage({
  outlineTitle,
  onOutlineTitleChange,
  outlineItems,
  onAddSlide,
  onUpdateSlideTitle,
  onUpdateSlideBullets,
  onRemoveSlide,
  selectionLabel,
}: SlidesOutlineStageProps) {
  return (
    <div className="space-y-4">
      <Input
        label="演示标题"
        value={outlineTitle}
        onChange={(event) => onOutlineTitleChange(event.target.value)}
        crossOrigin="anonymous"
      />
      <div className="space-y-4">
        {outlineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-4 text-center text-sm text-gray-500 dark:text-slate-400">
            暂无大纲内容，请先生成或添加幻灯片。
          </div>
        ) : (
          (() => {
            const outlineKeyCounts = new Map<string, number>();
            return outlineItems.map((item, index) => {
              const baseKey = JSON.stringify(item);
              const ordinal = outlineKeyCounts.get(baseKey) ?? 0;
              outlineKeyCounts.set(baseKey, ordinal + 1);
              const outlineItemKey = `${baseKey}:${ordinal}`;
              return (
                <div
                  key={outlineItemKey}
                  className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      label={`幻灯片 ${index + 1} 标题`}
                      value={item.title}
                      onChange={(event) => onUpdateSlideTitle(index, event.target.value)}
                      crossOrigin="anonymous"
                    />
                    <Button
                      variant="text"
                      color="red"
                      size="sm"
                      onClick={() => onRemoveSlide(index)}
                    >
                      删除
                    </Button>
                  </div>
                  <Textarea
                    label="要点（每行一个）"
                    value={item.bullets.join('\n')}
                    onChange={(event) => onUpdateSlideBullets(index, event.target.value)}
                    rows={4}
                  />
                </div>
              );
            });
          })()
        )}
      </div>
      <Button variant="outlined" color="blue" onClick={onAddSlide}>
        添加幻灯片
      </Button>
      <Typography variant="small" className="text-gray-600 dark:text-slate-300">
        {selectionLabel}
      </Typography>
    </div>
  );
}
