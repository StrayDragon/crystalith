import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';

import { t } from '../../../../../shared/i18n';
import { TestIds, tid } from '../../../../../shared/testids';
import { SkeletonCard } from '../../../shared/components/Skeleton';
import { useWorkspaceStore } from '../../../shared/state/workspaceStore';
import ExtractorPolicyDialog from './ExtractorPolicyDialog';
import SourceConnectorsDialog from './SourceConnectorsDialog';
import type { SourcesPanelViewProps } from './sources-panel-types';
import SourcesPanelList from './SourcesPanelList';
import SourcesPanelToolbar from './SourcesPanelToolbar';
import SourcesPanelUploadSection from './SourcesPanelUploadSection';
import { useSourcesPanelDetailDialog } from './useSourcesPanelDetailDialog';
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
  onOpenUrlImport,
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
  extractors = [],
  extractorsPolicy = null,
  extractorFallbackEnabled = null,
  extractorsLoading = false,
  onPatchExtractorsPolicy,
  onRefreshExtractors,
  onConvertSourceQAToSource,
  onReembedSource,
  notebookId,
  onSelectedSourceIdsChange,
}: SourcesPanelViewProps) {
  const jumpToSource = useWorkspaceStore((s) => s.jumpToSourceTarget);
  const uploadDisabled = !isConnected || uploadState === 'loading';
  const connectorDisabled = !isConnected || !notebookId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceListRef = useRef<VirtuosoHandle | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<number | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadHint, setUploadHint] = useState(t('sources.upload.hint.default'));
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [extractorPolicyOpen, setExtractorPolicyOpen] = useState(false);

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
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 flex flex-col gap-2 border-b border-gray-100 dark:border-slate-700">
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
          onOpenUrlImport={onOpenUrlImport}
          extractorTooltip={[
            `提取器：${extractorModeLabel}`,
            extractorsLoading ? '加载中…' : `可用 ${usableExtractorCount}/${extractors.length}`,
            extractorFallbackEnabled == null
              ? null
              : `回退${extractorFallbackEnabled ? '开启' : '关闭'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onOpenExtractorPolicy={() => setExtractorPolicyOpen(true)}
        />
      </div>

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
    </div>
  );
}

export default memo(SourcesPanelView);
