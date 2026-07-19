import type { StatusMessage } from '../slidesStudioUtils';

interface SlidesStatusBannersProps {
  error: string;
  statusMessage: StatusMessage | null;
}

export function SlidesStatusBanners({ error, statusMessage }: SlidesStatusBannersProps) {
  return (
    <>
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {statusMessage && !error && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            statusMessage.tone === 'red'
              ? 'border-red-200 bg-red-50 text-red-700'
              : statusMessage.tone === 'blue'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
          }`}
        >
          {statusMessage.message}
        </div>
      )}
    </>
  );
}
