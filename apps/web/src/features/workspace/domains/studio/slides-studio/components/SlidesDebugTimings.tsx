import { Chip, Typography } from '@material-tailwind/react';

interface SlidesDebugTimingsProps {
  debugTimings: Record<string, number>;
}

export function SlidesDebugTimings({ debugTimings }: SlidesDebugTimingsProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 space-y-2">
      <Typography variant="small" className="text-gray-500 dark:text-slate-400 text-xs">
        timings_ms
      </Typography>
      <div className="flex flex-wrap gap-2">
        {Object.entries(debugTimings)
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <Chip key={key} value={`${key}: ${value}ms`} size="sm" variant="ghost" color="gray" />
          ))}
      </div>
    </div>
  );
}
