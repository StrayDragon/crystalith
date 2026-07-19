import type { Ref, RefObject } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';

import type { AsyncStatus } from '../../../../../shared/types';
import { SkeletonList } from '../../../shared/components/Skeleton';
import type { SourceItem } from '../../../shared/types';
import SourceListRow from './SourceListRow';
import SourcesPanelEmptyState from './SourcesPanelEmptyState';

export interface SourcesPanelListProps {
  isLoading: boolean;
  sources: SourceItem[];
  sourceListRef: RefObject<VirtuosoHandle | null>;
  highlightedSourceId: number | null;
  selectedSourceIds: Record<number, boolean>;
  isConnected: boolean;
  removeState: AsyncStatus;
  onToggleSource: (
    id: number,
    event?: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  ) => void;
  onOpenDetail: (source: SourceItem) => void;
  onOpenDetailFullscreen: (source: SourceItem) => void;
  onRemoveSource: (sourceId: number) => Promise<boolean>;
  onReembedSource?: (sourceId: number) => Promise<unknown>;
}

export default function SourcesPanelList({
  isLoading,
  sources,
  sourceListRef,
  highlightedSourceId,
  selectedSourceIds,
  isConnected,
  removeState,
  onToggleSource,
  onOpenDetail,
  onOpenDetailFullscreen,
  onRemoveSource,
  onReembedSource,
}: SourcesPanelListProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 sm:px-4 pt-2 pb-1">
      {isLoading ? (
        <SkeletonList items={3} />
      ) : sources.length === 0 ? (
        <SourcesPanelEmptyState />
      ) : (
        <Virtuoso
          ref={sourceListRef as Ref<VirtuosoHandle>}
          style={{ flex: 1, minHeight: 0 }}
          data={sources}
          computeItemKey={(_index, source) => source.id}
          itemContent={(_index, source) => (
            <SourceListRow
              source={source}
              isHighlighted={highlightedSourceId === source.id}
              isSelected={Boolean(selectedSourceIds[source.id])}
              isConnected={isConnected}
              removeState={removeState}
              onToggleSource={onToggleSource}
              onOpenDetail={onOpenDetail}
              onOpenDetailFullscreen={onOpenDetailFullscreen}
              onRemoveSource={onRemoveSource}
              onReembedSource={onReembedSource}
            />
          )}
        />
      )}
    </div>
  );
}
