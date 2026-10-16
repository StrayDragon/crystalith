/**
 * Workspace top-bar search — E1 anchored panel. Two modes (c132):
 *  - 本地知识库 (default): debounced hybrid search over POST /v2/search with
 *    scope toggle + grouped results + jump-to-source/output;
 *  - Fast 联网: SearXNG web search (the E1 original).
 * Deep Research entry is the flask → `/research-lab/:nid` (Lab), not this panel.
 */
import type { ExtractorInfo, SearchItem, SourceFromUrlMode } from '@crystalith/shared';
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
import { IconButton, Spinner } from '../../../shared/ui';
import AddSearchResultDialog from '../domains/sources/AddSearchResultDialog';
import type { ExtractorType } from '../domains/sources/components/sources-panel-types';
import { useSourcesPanelAddFromSearch } from '../domains/sources/components/useSourcesPanelAddFromSearch';
import type { SearchResultItem } from '../domains/sources/SearchResultCard';
import SearchResultsQueue from '../domains/sources/SearchResultsQueue';
import type { SearchQueueItem } from '../domains/sources/useSources';
import { useKnowledgeSearch } from './hooks/useKnowledgeSearch';

/** Wire value for sources.search — channel metadata, not ResearchRun. */
export const FAST_SEARCH_MODE = 'Fast Research' as const;

type TopbarSearchMode = 'kb' | 'web';

export interface WorkspaceTopbarSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchState: AsyncStatus;
  searchQueue: SearchQueueItem[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onRemoveSearchQueueItem?: (queueItemId: string) => void;
  onRetrySearchQueueItem?: (queueItem: SearchQueueItem) => void;
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
  /** c132 KB mode — scope anchor + jump handlers. */
  activeNotebookId: number | null;
  activeNotebookTitle?: string | null;
  onJumpToSource?: (sourceId: number, chunkId: number, notebookId: number) => void | Promise<void>;
  onJumpToOutput?: (outputId: number, notebookId: number) => void | Promise<void>;
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
  onRetrySearchQueueItem,
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
  onRetrySearchQueueItem?: (queueItem: SearchQueueItem) => void;
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
    return () => {
      window.clearInterval(id);
    };
  }, [isSearching]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchIcon className="text-gray-400" style={{ fontSize: 18 }} />
        <input
          ref={searchInputRef}
          className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-hidden focus:ring-2 focus:ring-blue-500/25"
          placeholder={t('sources.search.placeholder')}
          value={searchQuery}
          {...tid(TestIds.sourcesSearchInput)}
          id="source-search-input"
          name="sourceSearch"
          aria-label={t('sources.search.aria_label')}
          onChange={(e) => {
            onSearchQueryChange(e.target.value);
          }}
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
          <Spinner className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
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
          onRetryQueueItem={onRetrySearchQueueItem}
          availableExtractors={availableExtractors}
          defaultExtractor={defaultExtractor}
        />
      </div>
    </div>
  );
}

function degradedText(
  reason: NonNullable<ReturnType<typeof useKnowledgeSearch>['result']>['degraded'],
): string | null {
  if (!reason) return null;
  return t(`search.kb.degraded.${reason}`);
}

function KbResultItem({ item, onJump }: { item: SearchItem; onJump: (item: SearchItem) => void }) {
  const isOutput = item.originType === 'output';
  return (
    <button
      type="button"
      className="w-full text-left rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      {...tid(TestIds.kbSearchResultItem)}
      onClick={() => {
        onJump(item);
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
            isOutput
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          }`}
        >
          {t(`search.kb.type.${item.originType}`)}
        </span>
        <span className="text-xs text-gray-500 dark:text-slate-400 truncate">
          {item.sourceTitle}
        </span>
        <span className="ml-auto text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">
          {item.score.toFixed(2)}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 line-clamp-2">{item.text}</p>
    </button>
  );
}

function KbScopeToggle({
  mode,
  activeNotebookId,
  activeNotebookTitle,
  onChange,
}: {
  mode: 'all' | 'notebook';
  activeNotebookId: number | null;
  activeNotebookTitle?: string | null;
  onChange: (m: 'all' | 'notebook') => void;
}) {
  const cls = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
      active
        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600'
        : 'border-gray-200 text-gray-500 dark:border-slate-600 dark:text-slate-400'
    }`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('search.kb.scope.label')}>
      <button
        type="button"
        className={cls(mode === 'all')}
        {...tid(TestIds.kbSearchScopeAll)}
        aria-pressed={mode === 'all'}
        onClick={() => {
          onChange('all');
        }}
      >
        {t('search.kb.scope.all')}
      </button>
      <button
        type="button"
        className={cls(mode === 'notebook')}
        {...tid(TestIds.kbSearchScopeNotebook)}
        aria-pressed={mode === 'notebook'}
        disabled={activeNotebookId == null}
        onClick={() => {
          onChange('notebook');
        }}
      >
        {t('search.kb.scope.notebook')}
        {activeNotebookTitle ? ` · ${activeNotebookTitle}` : ''}
      </button>
    </div>
  );
}

function KbResultsList({
  status,
  groups,
  onJump,
}: {
  status: 'idle' | 'loading' | 'done' | 'error';
  groups: Array<{ notebookId: number; title: string; items: SearchItem[] }>;
  onJump: (item: SearchItem) => void;
}) {
  return (
    <div className="max-h-[min(420px,50vh)] overflow-y-auto" {...tid(TestIds.kbSearchResults)}>
      {status === 'done' && groups.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">
          {t('search.kb.empty')}
        </p>
      ) : null}
      {groups.map((g) => (
        <div key={g.notebookId} className="mb-3">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="text-xs font-medium text-gray-700 dark:text-slate-200">{g.title}</span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">
              {g.items.length}
            </span>
          </div>
          <div className="flex flex-col">
            {g.items.map((item) => (
              <KbResultItem key={item.chunkId} item={item} onJump={onJump} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖，结构拆分到此为止（拆分准则：不为拆而拆）
function KbSearchBody({
  activeNotebookId,
  activeNotebookTitle,
  searchInputRef,
  onJump,
}: {
  activeNotebookId: number | null;
  activeNotebookTitle?: string | null;
  searchInputRef: RefObject<HTMLInputElement>;
  onJump: (item: SearchItem) => void;
}) {
  const kb = useKnowledgeSearch(activeNotebookId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchIcon className="text-gray-400" style={{ fontSize: 18 }} />
        <input
          ref={searchInputRef}
          className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-hidden focus:ring-2 focus:ring-blue-500/25"
          placeholder={t('search.kb.placeholder')}
          value={kb.query}
          {...tid(TestIds.kbSearchInput)}
          aria-label={t('search.kb.placeholder')}
          onChange={(e) => {
            kb.setQuery(e.target.value);
          }}
        />
        {kb.status === 'loading' && kb.groups.length === 0 ? (
          <Spinner className="h-4 w-4 text-gray-400" />
        ) : null}
      </div>

      <KbScopeToggle
        mode={kb.scopeMode}
        activeNotebookId={activeNotebookId}
        activeNotebookTitle={activeNotebookTitle}
        onChange={kb.setScopeMode}
      />

      {kb.result?.degraded ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300"
          {...tid(TestIds.kbSearchDegraded)}
        >
          {degradedText(kb.result.degraded)}
        </div>
      ) : null}

      {kb.status === 'error' ? (
        <p className="text-xs text-red-500" role="alert">
          {t('search.kb.error')}: {kb.error}
        </p>
      ) : null}

      <KbResultsList status={kb.status} groups={kb.groups} onJump={onJump} />
    </div>
  );
}

// fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖，结构拆分到此为止（拆分准则：不为拆而拆）
export default function WorkspaceTopbarSearch({
  open,
  onOpenChange,
  searchState,
  searchQueue,
  onSearch,
  onRemoveSearchQueueItem,
  onRetrySearchQueueItem,
  onRemoveResultsFromQueue,
  onAddSourceFromUrl,
  availableExtractors,
  defaultExtractor,
  openRequestToken = 0,
  activeNotebookId,
  activeNotebookTitle,
  onJumpToSource,
  onJumpToOutput,
}: WorkspaceTopbarSearchProps) {
  const [mode, setMode] = useState<TopbarSearchMode>('kb');
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
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [open, mode]);

  const submitFastSearch = useCallback(() => {
    if (searchState === 'loading') return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      toast.warning('请输入搜索关键词。');
      return;
    }
    onSearch({ query: trimmed, engine: 'Web', mode: FAST_SEARCH_MODE });
  }, [onSearch, searchQuery, searchState]);

  const handleKbJump = useCallback(
    // fallow-ignore-next-line complexity -- 估算 CRAP（无 coverage 数据）；行为由 rstest/e2e 覆盖
    (item: SearchItem) => {
      if (item.originType === 'output') {
        if (item.originId !== null) void onJumpToOutput?.(item.originId, item.notebookId);
      } else {
        void onJumpToSource?.(item.sourceId, item.chunkId, item.notebookId);
      }
      onOpenChange(false);
    },
    [onJumpToOutput, onJumpToSource, onOpenChange],
  );

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
        onClick={() => {
          onOpenChange(true);
        }}
      >
        <SearchIcon style={{ fontSize: 16 }} />
        <span className="truncate">{t('search.kb.placeholder')}</span>
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0"
              style={layerStyle}
              role="dialog"
              aria-modal="true"
              aria-label={t('search.kb.dialog_aria')}
              {...tid(TestIds.topbarSearchPanel)}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/20"
                onClick={() => {
                  onOpenChange(false);
                }}
                aria-label="关闭搜索面板"
              />
              {/* fallow-ignore-next-line css-broken-reference */}
              <div className="absolute top-16 left-1/2 z-10 w-[min(960px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-slate-700">
                  <div
                    className="flex items-center gap-1"
                    role="tablist"
                    aria-label={t('search.kb.mode.label')}
                  >
                    <button
                      type="button"
                      role="tab"
                      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                        mode === 'kb'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                      {...tid(TestIds.topbarSearchModeKb)}
                      aria-selected={mode === 'kb'}
                      onClick={() => {
                        setMode('kb');
                      }}
                    >
                      {t('search.kb.mode')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                        mode === 'web'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                      {...tid(TestIds.topbarSearchModeWeb)}
                      aria-selected={mode === 'web'}
                      onClick={() => {
                        setMode('web');
                      }}
                    >
                      {t('sources.search.action.fast')}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center"
                    aria-label="关闭"
                    onClick={() => {
                      onOpenChange(false);
                    }}
                  >
                    <CloseIcon style={{ fontSize: 18 }} />
                  </button>
                </div>
                <div className="p-3">
                  {mode === 'kb' ? (
                    <KbSearchBody
                      activeNotebookId={activeNotebookId}
                      activeNotebookTitle={activeNotebookTitle}
                      searchInputRef={searchInputRef}
                      onJump={handleKbJump}
                    />
                  ) : (
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
                      onRetrySearchQueueItem={onRetrySearchQueueItem}
                      availableExtractors={availableExtractors}
                      defaultExtractor={defaultExtractor}
                    />
                  )}
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
