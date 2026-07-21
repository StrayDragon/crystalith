/**
 * Workspace top-bar search (c75) — E1 anchored panel.
 * Fast Search: reuse useSources.handleSearch + SearchResultsQueue.
 * Deep Research: shell only (runtime pending rewrite).
 */
import type { ExtractorInfo, SourceFromUrlMode } from '@crystalith/shared';
import { IconButton, Typography } from '@material-tailwind/react';
import {
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Psychology as PsychologyIcon,
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

export type TopbarSearchTab = 'fast' | 'deep';

export interface WorkspaceTopbarSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected: boolean;
  notebookId?: number;
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
        >
          <ArrowForwardIcon style={{ fontSize: 16 }} />
        </IconButton>
      </div>
      {isSearching ? (
        <Typography variant="small" className="text-[11px] text-gray-600 font-medium">
          {t('sources.search.searching')}
        </Typography>
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

function DeepResearchShell() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <PsychologyIcon className="text-indigo-400" style={{ fontSize: 36 }} />
      <div className="text-sm font-medium text-gray-800 dark:text-slate-100">深度研究</div>
      <Typography variant="small" className="text-gray-500 dark:text-slate-400 max-w-md">
        节点化深度研究正在重建。当前无法启动任务；请使用「快速搜索」添加网络来源。
      </Typography>
      <button
        type="button"
        disabled
        className="px-4 py-2 rounded-lg text-sm bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
        onClick={() => toast.info('深度研究正在重建')}
      >
        开始深度研究（暂不可用）
      </button>
    </div>
  );
}

export default function WorkspaceTopbarSearch({
  open,
  onOpenChange,
  isConnected,
  notebookId: _notebookId,
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
  const [tab, setTab] = useState<TopbarSearchTab>('fast');
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
    if (!open || tab !== 'fast') return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open, tab]);

  const submitFastSearch = useCallback(() => {
    if (searchState === 'loading') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      toast.warning('请输入搜索关键词。');
      return;
    }
    onSearch({ query: trimmed, engine: 'Web', mode: 'Fast Research' });
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
              aria-label="搜索与调研"
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
                  <div
                    role="tablist"
                    aria-label="搜索模式"
                    className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-0.5"
                    {...tid(TestIds.sourcesModeToggle)}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'fast'}
                      {...tid(TestIds.topbarSearchTabFast)}
                      className={
                        tab === 'fast'
                          ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                          : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500'
                      }
                      onClick={() => setTab('fast')}
                    >
                      {t('sources.search.mode.fast')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={tab === 'deep'}
                      {...tid(TestIds.topbarSearchTabDeep)}
                      className={
                        tab === 'deep'
                          ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                          : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500'
                      }
                      onClick={() => setTab('deep')}
                    >
                      {t('sources.search.mode.deep')}
                    </button>
                  </div>
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
                  {tab === 'fast' ? (
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
                  ) : (
                    <DeepResearchShell />
                  )}
                  {!isConnected ? (
                    <Typography variant="small" className="mt-2 text-amber-600 text-xs">
                      {t('sources.research.backend_disconnected')}
                    </Typography>
                  ) : null}
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
