import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

import { t } from '../../../../../shared/i18n';
import { TestIds, tid } from '../../../../../shared/testids';
import { SkeletonCard } from '../../../shared/components/Skeleton';
import { useWorkspaceStore } from '../../../shared/state/workspaceStore';
import AddSearchResultDialog from '../AddSearchResultDialog';
import ExtractorPolicyDialog from './ExtractorPolicyDialog';
import ResearchDetailModal from './ResearchDetailModal';
import ResearchHistoryDialog from './ResearchHistoryDialog';
import SourceConnectorsDialog from './SourceConnectorsDialog';
import type { SourcesPanelViewProps } from './sources-panel-types';
import SourcesPanelList from './SourcesPanelList';
import SourcesPanelResearchQueue from './SourcesPanelResearchQueue';
import SourcesPanelSearchSection from './SourcesPanelSearchSection';
import SourcesPanelToolbar from './SourcesPanelToolbar';
import SourcesPanelUploadSection from './SourcesPanelUploadSection';
import { useSourcesPanelAddFromSearch } from './useSourcesPanelAddFromSearch';
import { useSourcesPanelDetailDialog } from './useSourcesPanelDetailDialog';
import { useSourcesPanelResearchActions } from './useSourcesPanelResearchActions';
import { useSourcesPanelSearchMode } from './useSourcesPanelSearchMode';
import { useSourcesPanelSelection } from './useSourcesPanelSelection';

export type { SourcesPanelProps } from './sources-panel-types';

const SourceDetailDialog = lazy(() => import('../SourceDetailDialog'));

function SourcesPanelView({
  sources,
  onUpload,
  onRefreshSources,
  uploadState,
  uploadError = '',
  uploadQueue = [],
  onRetryUpload,
  onClearUploadQueue,
  searchState,
  onSearch,
  onAddSourceFromUrl,
  onRemoveSources,
  onRemoveSource,
  onBatchReembedSources,
  sourceTags = [],
  tagMutationState = 'idle',
  onCreateSourceTag,
  onAssignTagToSources,
  onRemoveTagFromSources,
  sortBy = 'date',
  sortOrder = 'desc',
  tagFilter = '',
  onSortByChange,
  onSortOrderChange,
  onTagFilterChange,
  isConnected,
  isLoading,
  removeState,
  isFullscreen = false,
  searchQueue = [],
  onRemoveSearchQueueItem,
  onRemoveResultsFromQueue,
  availableExtractors = [],
  extractors = [],
  defaultExtractor = null,
  extractorsPolicy = null,
  extractorFallbackEnabled = null,
  extractorsLoading = false,
  onPatchExtractorsPolicy,
  onRefreshExtractors,
  onConvertSourceQAToSource,
  onReembedSource,
  research,
  notebookId,
  onSelectedSourceIdsChange,
}: SourcesPanelViewProps) {
  const jumpToSource = useWorkspaceStore((s) => s.jumpToSourceTarget);
  const uploadDisabled = !isConnected || uploadState === 'loading';
  const connectorDisabled = !isConnected || !notebookId;
  const isSearching = searchState === 'loading';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceListRef = useRef<VirtuosoHandle | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<number | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadHint, setUploadHint] = useState(t('sources.upload.hint.default'));
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [extractorPolicyOpen, setExtractorPolicyOpen] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isDeepResearchMode,
    searchPlaceholder,
    searchModeToggleLabel,
    searchInputRef,
    handleSearch,
    handleToggleSearchMode,
  } = useSourcesPanelSearchMode({
    isConnected,
    notebookId,
    research,
    onSearch,
  });

  const {
    selectedSourceIds,
    sourceIdToIndex,
    allSelected,
    selectedIds,
    selectedTagNames,
    handleToggleAll,
    handleToggleSource,
    handleBatchDelete,
    handleBatchReembed,
    handleBatchCreateAndAssignTag,
    handleAssignExistingTag,
    handleRemoveExistingTag,
  } = useSourcesPanelSelection({
    sources,
    onRemoveSources,
    onBatchReembedSources,
    onCreateSourceTag,
    onAssignTagToSources,
    onRemoveTagFromSources,
    onSelectedSourceIdsChange,
  });

  const {
    detailDialogOpen,
    selectedSource,
    isDetailFullscreen,
    handleOpenDetail,
    handleOpenDetailFullscreen,
    handleCloseDetail,
    handleToggleDetailFullscreen,
    handleSaveQAAsSource,
  } = useSourcesPanelDetailDialog({
    isFullscreen,
    onConvertSourceQAToSource,
  });

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

  const {
    researchModalRef,
    researchDetailOpen,
    researchFullscreen,
    showResearchHistory,
    setShowResearchHistory,
    setResearchFullscreen,
    handleResearchClick,
    handleResearchStart,
    handleResearchDelete,
    handleResearchApprove,
    handleResearchSkip,
    handleResearchFinish,
    handleResearchCancel,
    handleResearchResume,
    handleResearchRetry,
    handleCloseResearchDetail,
  } = useSourcesPanelResearchActions({ research });

  const extractorModeLabel = useMemo(() => {
    const policyMode = extractorsPolicy?.mode ?? 'inherit_global';
    return policyMode === 'custom' ? '自定义' : '遵循全局';
  }, [extractorsPolicy?.mode]);

  const usableExtractorCount = useMemo(
    () => extractors.filter((ext) => ext.enabled && ext.available).length,
    [extractors],
  );

  useEffect(() => {
    if (!jumpToSource) return;
    const targetIndex = sourceIdToIndex.get(jumpToSource.id);
    if (targetIndex != null) {
      sourceListRef.current?.scrollToIndex({
        index: targetIndex,
        align: 'start',
        behavior: 'auto',
      });
    }
    setHighlightedSourceId(null);
    const start = window.requestAnimationFrame(() => {
      setHighlightedSourceId(jumpToSource.id);
    });
    const timer = window.setTimeout(() => setHighlightedSourceId(null), 1500);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(timer);
    };
  }, [jumpToSource, sourceIdToIndex]);

  const mutationBusy =
    removeState === 'loading' || tagMutationState === 'loading' || uploadState === 'loading';
  const removeDisabled = !isConnected || mutationBusy || selectedIds.length === 0;
  const batchReembedDisabled =
    !isConnected || !onBatchReembedSources || selectedIds.length === 0 || mutationBusy;

  return (
    <div
      className={`flex flex-1 flex-col min-h-0 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}
      {...tid(TestIds.sourcesPanel)}
    >
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 flex flex-col gap-3 border-b border-gray-100 dark:border-slate-700">
        <SourcesPanelUploadSection
          uploadDisabled={uploadDisabled}
          connectorDisabled={connectorDisabled}
          uploadDragActive={uploadDragActive}
          onUploadDragActiveChange={setUploadDragActive}
          uploadState={uploadState}
          uploadHint={uploadHint}
          onUploadHintChange={setUploadHint}
          uploadError={uploadError}
          uploadQueue={uploadQueue}
          onUpload={onUpload}
          onRetryUpload={onRetryUpload}
          onClearUploadQueue={onClearUploadQueue}
          fileInputRef={fileInputRef}
          onOpenConnectors={() => setConnectorsOpen(true)}
        />
        <SourcesPanelSearchSection
          isDeepResearchMode={isDeepResearchMode}
          searchModeToggleLabel={searchModeToggleLabel}
          searchPlaceholder={searchPlaceholder}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onToggleSearchMode={handleToggleSearchMode}
          onSearch={handleSearch}
          searchInputRef={searchInputRef}
          extractorModeLabel={extractorModeLabel}
          extractorsLoading={extractorsLoading}
          usableExtractorCount={usableExtractorCount}
          extractorsCount={extractors.length}
          extractorFallbackEnabled={extractorFallbackEnabled}
          isConnected={isConnected}
          onOpenExtractorPolicy={() => setExtractorPolicyOpen(true)}
        />
      </div>

      <SourcesPanelResearchQueue
        isSearching={isSearching}
        research={research}
        searchQueue={searchQueue}
        onResearchClick={handleResearchClick}
        onResearchStart={handleResearchStart}
        onResearchDelete={handleResearchDelete}
        onShowResearchHistory={() => setShowResearchHistory(true)}
        onAddToSources={handleAddToSources}
        isAddingFromUrl={isAddingFromUrl}
        onRemoveSearchQueueItem={onRemoveSearchQueueItem}
        availableExtractors={availableExtractors}
        defaultExtractor={defaultExtractor}
      />

      <SourcesPanelToolbar
        allSelected={allSelected}
        onToggleAll={handleToggleAll}
        selectedIds={selectedIds}
        sourcesCount={sources.length}
        sortBy={sortBy}
        sortOrder={sortOrder}
        tagFilter={tagFilter}
        sourceTags={sourceTags}
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
        onTagFilterChange={onTagFilterChange}
        removeDisabled={removeDisabled}
        batchReembedDisabled={batchReembedDisabled}
        onBatchDelete={handleBatchDelete}
        onBatchReembed={handleBatchReembed}
        onBatchCreateAndAssignTag={handleBatchCreateAndAssignTag}
        onAssignExistingTag={handleAssignExistingTag}
        onRemoveExistingTag={handleRemoveExistingTag}
        selectedTagNames={selectedTagNames}
        onBatchReembedSources={onBatchReembedSources}
        onCreateSourceTag={onCreateSourceTag}
        onAssignTagToSources={onAssignTagToSources}
        onRemoveTagFromSources={onRemoveTagFromSources}
        tagMutationState={tagMutationState}
      />

      <SourcesPanelList
        isLoading={isLoading}
        sources={sources}
        sourceListRef={sourceListRef}
        highlightedSourceId={highlightedSourceId}
        selectedSourceIds={selectedSourceIds}
        isConnected={isConnected}
        removeState={removeState}
        onToggleSource={handleToggleSource}
        onOpenDetail={handleOpenDetail}
        onOpenDetailFullscreen={handleOpenDetailFullscreen}
        onRemoveSource={onRemoveSource}
        onReembedSource={onReembedSource}
      />

      {detailDialogOpen && (
        <Suspense
          fallback={
            <div className="p-4">
              <SkeletonCard />
            </div>
          }
        >
          <SourceDetailDialog
            open={detailDialogOpen}
            source={selectedSource}
            onClose={handleCloseDetail}
            isFullscreen={isDetailFullscreen}
            onToggleFullscreen={handleToggleDetailFullscreen}
            onSaveQAAsSource={onConvertSourceQAToSource ? handleSaveQAAsSource : undefined}
          />
        </Suspense>
      )}

      <AddSearchResultDialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        results={resultsToAdd}
        mode={addMode}
        onAddSource={handleAddSource}
        onComplete={handleAddComplete}
      />

      <ExtractorPolicyDialog
        open={extractorPolicyOpen}
        onClose={() => setExtractorPolicyOpen(false)}
        isConnected={isConnected}
        isLoading={extractorsLoading}
        extractors={extractors}
        policy={extractorsPolicy}
        fallbackEnabled={extractorFallbackEnabled}
        onPatchPolicy={onPatchExtractorsPolicy}
        onRefresh={onRefreshExtractors}
      />

      <SourceConnectorsDialog
        open={connectorsOpen}
        onClose={() => setConnectorsOpen(false)}
        notebookId={notebookId}
        isConnected={isConnected}
        onSourcesChanged={onRefreshSources}
      />

      <ResearchDetailModal
        open={researchDetailOpen}
        research={research}
        researchModalRef={researchModalRef}
        researchFullscreen={researchFullscreen}
        onClose={handleCloseResearchDetail}
        onApprove={handleResearchApprove}
        onSkip={handleResearchSkip}
        onFinish={handleResearchFinish}
        onCancel={handleResearchCancel}
        onResume={handleResearchResume}
        onRetry={handleResearchRetry}
        onStart={handleResearchStart}
        onToggleFullscreen={() => setResearchFullscreen(!researchFullscreen)}
        onAddSourceFromUrl={async (url) => {
          await onAddSourceFromUrl(url, 'link');
        }}
      />

      <ResearchHistoryDialog
        open={showResearchHistory}
        research={research}
        onClose={() => setShowResearchHistory(false)}
        onSelectSession={handleResearchClick}
      />
    </div>
  );
}

export default memo(SourcesPanelView);
