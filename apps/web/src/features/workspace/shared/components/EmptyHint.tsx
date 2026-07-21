import { memo } from 'react';

/** Quiet empty / blocked hint — no dashed card chrome (avoids layout shout). */
export const EmptyHint = memo(function EmptyHint({
  title,
  description,
  className = '',
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`px-3 py-6 text-center ${className}`.trim()}>
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{title}</p>
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400 dark:text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
});
