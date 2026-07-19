import type { RefObject } from 'react';

import type { AsyncStatus } from '../../../../../shared/types';
import type { SourceUploadItem } from '../useSources';
import SourcesPanelSearchSection from './SourcesPanelSearchSection';
import SourcesPanelUploadSection from './SourcesPanelUploadSection';

export interface SourcesPanelHeaderProps {
  uploadDisabled: boolean;
  connectorDisabled: boolean;
  uploadDragActive: boolean;
  onUploadDragActiveChange: (active: boolean) => void;
  uploadState: AsyncStatus;
  uploadHint: string;
  onUploadHintChange: (hint: string) => void;
  uploadError?: string;
  uploadQueue: SourceUploadItem[];
  onUpload: (input: File | File[] | FileList | null) => void;
  onRetryUpload?: () => void;
  onClearUploadQueue?: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenConnectors: () => void;
  isDeepResearchMode: boolean;
  searchModeToggleLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onToggleSearchMode: () => void;
  onSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  extractorModeLabel: string;
  extractorsLoading: boolean;
  usableExtractorCount: number;
  extractorsCount: number;
  extractorFallbackEnabled: boolean | null;
  isConnected: boolean;
  onOpenExtractorPolicy: () => void;
}

export default function SourcesPanelHeader({
  uploadDisabled,
  connectorDisabled,
  uploadDragActive,
  onUploadDragActiveChange,
  uploadState,
  uploadHint,
  onUploadHintChange,
  uploadError,
  uploadQueue,
  onUpload,
  onRetryUpload,
  onClearUploadQueue,
  fileInputRef,
  onOpenConnectors,
  isDeepResearchMode,
  searchModeToggleLabel,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  onToggleSearchMode,
  onSearch,
  searchInputRef,
  extractorModeLabel,
  extractorsLoading,
  usableExtractorCount,
  extractorsCount,
  extractorFallbackEnabled,
  isConnected,
  onOpenExtractorPolicy,
}: SourcesPanelHeaderProps) {
  return (
    <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 flex flex-col gap-3 border-b border-gray-100 dark:border-slate-700">
      <SourcesPanelUploadSection
        uploadDisabled={uploadDisabled}
        connectorDisabled={connectorDisabled}
        uploadDragActive={uploadDragActive}
        onUploadDragActiveChange={onUploadDragActiveChange}
        uploadState={uploadState}
        uploadHint={uploadHint}
        onUploadHintChange={onUploadHintChange}
        uploadError={uploadError}
        uploadQueue={uploadQueue}
        onUpload={onUpload}
        onRetryUpload={onRetryUpload}
        onClearUploadQueue={onClearUploadQueue}
        fileInputRef={fileInputRef}
        onOpenConnectors={onOpenConnectors}
      />

      <SourcesPanelSearchSection
        isDeepResearchMode={isDeepResearchMode}
        searchModeToggleLabel={searchModeToggleLabel}
        searchPlaceholder={searchPlaceholder}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onToggleSearchMode={onToggleSearchMode}
        onSearch={onSearch}
        searchInputRef={searchInputRef}
        extractorModeLabel={extractorModeLabel}
        extractorsLoading={extractorsLoading}
        usableExtractorCount={usableExtractorCount}
        extractorsCount={extractorsCount}
        extractorFallbackEnabled={extractorFallbackEnabled}
        isConnected={isConnected}
        onOpenExtractorPolicy={onOpenExtractorPolicy}
      />
    </div>
  );
}
