import type { ExtractorInfo, SourceFromUrlMode } from '@crystalith/shared';
import { Typography } from '@material-tailwind/react';
import { History as HistoryIcon } from '@mui/icons-material';

import { t } from '../../../../../shared/i18n';
import ResearchCapsule from '../../research/ResearchCapsule';
import type { SearchResultItem } from '../SearchResultCard';
import SearchResultsQueue from '../SearchResultsQueue';
import type { SearchQueueItem } from '../useSources';
import type { ExtractorType, Research } from './sources-panel-types';

export interface SourcesPanelResearchQueueProps {
  isSearching: boolean;
  research: Research;
  searchQueue: SearchQueueItem[];
  onResearchClick: (sessionId: number) => Promise<void>;
  onResearchStart: (sessionId: number) => Promise<void>;
  onResearchDelete: (sessionId: number) => Promise<void>;
  onShowResearchHistory: () => void;
  onAddToSources: (
    selected: SearchResultItem[],
    sourceMode: SourceFromUrlMode,
    extractor?: ExtractorType,
  ) => void;
  isAddingFromUrl: boolean;
  onRemoveSearchQueueItem?: (queueItemId: string) => void;
  availableExtractors: ExtractorInfo[];
  defaultExtractor: ExtractorType | null;
}

export default function SourcesPanelResearchQueue({
  isSearching,
  research,
  searchQueue,
  onResearchClick,
  onResearchStart,
  onResearchDelete,
  onShowResearchHistory,
  onAddToSources,
  isAddingFromUrl,
  onRemoveSearchQueueItem,
  availableExtractors,
  defaultExtractor,
}: SourcesPanelResearchQueueProps) {
  if (!(isSearching || research.sessions.length > 0 || searchQueue.length > 0)) {
    return null;
  }

  const historySessions = research.sessions.filter((s) =>
    ['completed', 'cancelled'].includes(s.status),
  );

  return (
    <div className="flex-shrink-0 max-h-[200px] overflow-y-auto overscroll-contain px-3 sm:px-4 py-2 flex flex-col gap-2 border-b border-gray-100 dark:border-slate-700">
      {isSearching && (
        <Typography variant="small" className="text-[11px] text-gray-600 font-medium px-1">
          {t('sources.search.searching')}
        </Typography>
      )}

      {research.sessions.length > 0 && (
        <div className="flex flex-col gap-2">
          {research.sessions
            .filter((s) =>
              ['planning', 'searching', 'analyzing', 'waiting_user'].includes(s.status),
            )
            .map((session) => (
              <ResearchCapsule
                key={session.id}
                session={session}
                onClick={() => {
                  void onResearchClick(session.id);
                }}
                onStart={() => {
                  void onResearchStart(session.id);
                }}
                onDelete={() => {
                  void onResearchDelete(session.id);
                }}
                isExpanded={research.activeSession?.id === session.id}
              />
            ))}
          {historySessions.length > 0 && (
            <button
              onClick={onShowResearchHistory}
              className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <HistoryIcon style={{ fontSize: 14 }} />
              查看研究历史 ({historySessions.length})
            </button>
          )}
        </div>
      )}

      <SearchResultsQueue
        onAddToSources={onAddToSources}
        isAdding={isAddingFromUrl}
        searchQueue={searchQueue}
        onRemoveQueueItem={onRemoveSearchQueueItem}
        availableExtractors={availableExtractors}
        defaultExtractor={defaultExtractor}
      />
    </div>
  );
}
