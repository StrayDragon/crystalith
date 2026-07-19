import { Textarea, Typography } from '@material-tailwind/react';

import type { SlidesMarkdownStageProps } from '../types';

export function SlidesMarkdownStage({
  markdown,
  onMarkdownChange,
  selectionLabel,
}: SlidesMarkdownStageProps) {
  return (
    <div className="space-y-4">
      <Textarea
        label="Slides Markdown"
        value={markdown}
        onChange={(event) => onMarkdownChange(event.target.value)}
        rows={16}
        className="font-mono text-xs"
      />
      <Typography variant="small" className="text-gray-600 dark:text-slate-300">
        {selectionLabel}
      </Typography>
    </div>
  );
}
