import type { SlidesGenerationEvent } from '../types';

interface SlidesGenerationEventsProps {
  events: SlidesGenerationEvent[];
}

export function SlidesGenerationEvents({ events }: SlidesGenerationEventsProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      {(() => {
        const keyCounts = new Map<string, number>();
        return events.map((event) => {
          const baseKey = `${event.type}:${event.message}`;
          const ordinal = keyCounts.get(baseKey) ?? 0;
          keyCounts.set(baseKey, ordinal + 1);
          const eventKey = `${baseKey}:${ordinal}`;
          return (
            <div
              key={eventKey}
              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 flex items-start gap-2"
            >
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  event.type === 'toolcall' ? 'bg-purple-500' : 'bg-blue-500'
                }`}
              />
              <span className="flex-1">{event.message}</span>
            </div>
          );
        });
      })()}
    </div>
  );
}
