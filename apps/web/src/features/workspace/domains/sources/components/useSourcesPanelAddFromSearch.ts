import type { SourceFromUrlMode } from '@crystalith/shared';
import { useCallback, useState } from 'react';

import type { SearchResultItem } from '../SearchResultCard';
import type { ExtractorType } from './sources-panel-types';

export function useSourcesPanelAddFromSearch({
  onAddSourceFromUrl,
  onRemoveResultsFromQueue,
}: {
  onAddSourceFromUrl: (
    url: string,
    mode: SourceFromUrlMode,
    options?: { title?: string; snippet?: string; extractor?: ExtractorType },
  ) => Promise<unknown>;
  onRemoveResultsFromQueue?: (urls: string[]) => void;
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resultsToAdd, setResultsToAdd] = useState<SearchResultItem[]>([]);
  const [addMode, setAddMode] = useState<SourceFromUrlMode>('link');
  const [selectedExtractor, setSelectedExtractor] = useState<ExtractorType | undefined>(undefined);
  const isAddingFromUrl = addDialogOpen;

  const handleAddToSources = useCallback(
    (selected: SearchResultItem[], sourceMode: SourceFromUrlMode, extractor?: ExtractorType) => {
      setResultsToAdd(selected);
      setAddMode(sourceMode);
      setSelectedExtractor(extractor);
      setAddDialogOpen(true);
    },
    [],
  );

  const handleAddSource = useCallback(
    async (result: SearchResultItem, sourceMode: SourceFromUrlMode) => {
      await onAddSourceFromUrl(result.url, sourceMode, {
        title: result.title,
        snippet: result.snippet ?? undefined,
        extractor: sourceMode === 'fetch' ? selectedExtractor : undefined,
      });
    },
    [onAddSourceFromUrl, selectedExtractor],
  );

  const handleAddComplete = useCallback(() => {
    if (resultsToAdd.length > 0 && onRemoveResultsFromQueue) {
      const addedUrls = resultsToAdd.map((r) => r.url);
      onRemoveResultsFromQueue(addedUrls);
    }
    setResultsToAdd([]);
  }, [resultsToAdd, onRemoveResultsFromQueue]);

  const handleCloseAddDialog = useCallback(() => {
    setAddDialogOpen(false);
  }, []);

  return {
    addDialogOpen,
    resultsToAdd,
    addMode,
    isAddingFromUrl,
    handleAddToSources,
    handleAddSource,
    handleAddComplete,
    handleCloseAddDialog,
  };
}
