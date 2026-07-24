/**
 * Workspace top-bar search — E1 anchored panel (Fast web search only).
 * Deep Research entry is the flask → `/research-lab/:nid` (Lab), not this panel.
 */
import type { ExtractorInfo, SourceFromUrlMode } from '@crystalith/shared';
import { IconButton, Spinner } from '@material-tailwind/react';
import {
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { t } from '../../../shared/i18n';
import { useLayer } from '../../../shared/layer';
import { TestIds, tid } from '../../../shared/testids';
import { toast } from '../../../shared/toast';
import type { AsyncStatus } from '../../../shared/types';
import AddSearchResultDialog from '../domains/sources/AddSearchResultDialog';
import type { ExtractorType } from '../domains/sources/components/sources-panel-types';
import { useSourcesPanelAddFromSearch } from '../domains/sources/components/useSourcesPanelAddFromSearch';
import type { SearchResultItem } from '../domains/sources/SearchResultCard';
import SearchResultsQueue from '../domains/sources/SearchResultsQueue';
import type { SearchQueueItem } from '../domains/sources/useSources';

/** Wire value for sources.search — channel metadata, not ResearchRun. */
export const FAST_SEARCH_MODE = 'Fast Research' as const;

export interface WorkspaceTopbarSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchState: AsyncStatus;
  searchQueue: SearchQueueItem[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onRemoveSearchQueueItem?: (queueItemId: string) => void;
  onRemoveResultsFromQueue?: (urls: string[]) => void;
  onAddSourceFromUrl: (
    url: string,
    mode: SourceFromUrlMode,
    options?: { title?: string; snippet?: string; extractor?: ExtractorType },
  ) => Promise<unknown>;
  availableExtractors: ExtractorInfo[];
  defaultExtractor: ExtractorType | null;
  /** Imperative open from command palette */
  openRequestToken?: number;
}

function FastSearchBody({
  searchQuery,
  onSearchQueryChange,
  onSubmit,
  searchInputRef,
  isSearching,
  searchQueue,
  onAddToSources,
  isAddingFromUrl,
  onRemoveSearchQueueItem,
  availableExtractors,
  defaultExtractor,
}: {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onSubmit: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
  isSearching: boolean;
  searchQueue: SearchQueueItem[];
  onAddToSources: (
    selected: SearchResultItem[],
    sourceMode: SourceFromUrlMode,
    extractor?: ExtractorType,
  ) => void;
  isAddingFromUrl: boolean;
  onRemoveSearchQueueItem?: (queueItemId: string) => void;
  availableExtractors: ExtractorInfo[];
  defaultExtractor: ExtractorType | null;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isSearching) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isSearching]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchIcon className="text-gray-400" style={{ fontSize: 18 }} />
        <input
          ref={searchInputRef}
          className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/25"
          placeholder={t('sources.search.placeholder')}
          value={searchQuery}
          {...tid(TestIds.sourcesSearchInput)}
          id="source-search-input"
          name="sourceSearch"
          aria-label={t('sources.search.aria_label')}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <IconButton
          size="sm"
          aria-label={t('sources.search.action.fast')}
          className="rounded-lg w-10 h-10 bg-blue-500 hover:bg-blue-600"
          {...tid(TestIds.sourcesSearchSubmit)}
          onClick={onSubmit}
          disabled={isSearching}
        >
          {isSearching ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <ArrowForwardIcon style={{ fontSize: 16 }} />
          )}
        </IconButton>
      </div>
      {isSearching ? (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-[11px] text-blue-900">
          <Spinner className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">{t('sources.search.searching_detail')}</p>
            <p className="text-blue-800/80">
              {t('sources.search.searching_elapsed', { seconds: String(elapsedSec) })}
            </p>
          </div>
        </div>
      ) : null}
      <div className="max-h-[min(420px,50vh)] overflow-y-auto">
        <SearchResultsQueue
          onAddToSources={onAddToSources}
          isAdding={isAddingFromUrl}
          searchQueue={searchQueue}
          onRemoveQueueItem={onRemoveSearchQueueItem}
          availableExtractors={availableExtractors}
          defaultExtractor={defaultExtractor}
        />
      </div>
    </div>
  );
}

export default function WorkspaceTopbarSearch({
  open,
  onOpenChange,
  searchState,
  searchQueue,
  onSearch,
  onRemoveSearchQueueItem,
  onRemoveResultsFromQueue,
  onAddSourceFromUrl,
  availableExtractors,
  defaultExtractor,
  openRequestToken = 0,
}: WorkspaceTopbarSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null!);
  const { style: layerStyle } = useLayer('popover');

  const {
    addDialogOpen,
    resultsToAdd,
    addMode,
    isAddingFromUrl,
    handleAddToSources,
    handleAddSource,
    handleAddComplete,
    handleCloseAddDialog,
  } = useSourcesPanelAddFromSearch({
    onAddSourceFromUrl,
    onRemoveResultsFromQueue,
  });

  useEffect(() => {
    if (openRequestToken > 0) onOpenChange(true);
  }, [openRequestToken, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open]);

  const submitFastSearch = useCallback(() => {
    if (searchState === 'loading') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      toast.warning('请输入搜索关键词。');
      return;
    }
    onSearch({ query: trimmed, engine: 'Web', mode: FAST_SEARCH_MODE });
  }, [onSearch, searchQuery, searchState]);

  const triggerClass =
    'flex-1 min-w-[12rem] max-w-xl mx-auto flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/80 text-left text-sm text-gray-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-500 transition-colors';

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        {...tid(TestIds.topbarSearchTrigger)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(true)}
      >
        <SearchIcon style={{ fontSize: 16 }} />
        <span className="truncate">{t('sources.search.placeholder')}</span>
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0"
              style={layerStyle}
              role="dialog"
              aria-modal="true"
              aria-label="网络搜索"
              {...tid(TestIds.topbarSearchPanel)}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/20"
                onClick={() => onOpenChange(false)}
                aria-label="关闭搜索面板"
              />
              <div className="absolute top-16 left-1/2 z-10 w-[min(960px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-slate-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                    {t('sources.search.action.fast')}
                  </p>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center"
                    aria-label="关闭"
                    onClick={() => onOpenChange(false)}
                  >
                    <CloseIcon style={{ fontSize: 18 }} />
                  </button>
                </div>
                <div className="p-3">
                  <FastSearchBody
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onSubmit={submitFastSearch}
                    searchInputRef={searchInputRef}
                    isSearching={searchState === 'loading'}
                    searchQueue={searchQueue}
                    onAddToSources={handleAddToSources}
                    isAddingFromUrl={isAddingFromUrl}
                    onRemoveSearchQueueItem={onRemoveSearchQueueItem}
                    availableExtractors={availableExtractors}
                    defaultExtractor={defaultExtractor}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <AddSearchResultDialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        results={resultsToAdd}
        mode={addMode}
        onAddSource={handleAddSource}
        onComplete={handleAddComplete}
      />
    </>
  );
}
