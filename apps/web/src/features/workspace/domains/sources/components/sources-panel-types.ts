import type {
  ExtractorInfo,
  NotebookExtractorsPolicyView as NotebookExtractorsPolicy,
  PatchNotebookExtractorPolicy as PatchNotebookExtractorsPolicyRequest,
  QAMessage as QaMessage,
  SourceFromUrlMode,
  SourceTag as SourceTagRead,
} from '@crystalith/shared';

import type { AsyncStatus } from '../../../../../shared/types';
import type { SourceItem } from '../../../shared/types';
import type {
  SearchQueueItem,
  SourceSortBy,
  SourceSortOrder,
  SourceUploadItem,
} from '../useSources';

export type ExtractorType = ExtractorInfo['type'];

export const SEARCH_ENGINE_WEB = 'Web' as const;
export type SearchEngine = typeof SEARCH_ENGINE_WEB;

export const SEARCH_MODES = ['Fast Research', 'Deep Research'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export interface SourcesPanelProps {
  sources: SourceItem[];
  onUpload: (input: File | File[] | FileList | null) => void;
  /** 刷新来源列表（例如连接器导入后） */
  onRefreshSources?: () => Promise<void> | void;
  uploadState: AsyncStatus;
  uploadError?: string;
  uploadQueue?: SourceUploadItem[];
  onRetryUpload?: () => void;
  onClearUploadQueue?: () => void;
  searchState: AsyncStatus;
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onAddSourceFromUrl: (
    url: string,
    mode: SourceFromUrlMode,
    options?: { title?: string; snippet?: string; extractor?: ExtractorType },
  ) => Promise<unknown>;
  /** Open the durable「从 URL 导入」dialog (workspace overlay). */
  onOpenUrlImport?: () => void;
  onRemoveSources: (sourceIds: number[]) => Promise<boolean>;
  onRemoveSource: (sourceId: number) => Promise<boolean>;
  onBatchReembedSources?: (sourceIds: number[]) => Promise<boolean>;
  sourceTags?: SourceTagRead[];
  tagMutationState?: AsyncStatus;
  onCreateSourceTag?: (name: string) => Promise<SourceTagRead | null>;
  onAssignTagToSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  onRemoveTagFromSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  sortBy?: SourceSortBy;
  sortOrder?: SourceSortOrder;
  tagFilter?: string;
  onSortByChange?: (value: SourceSortBy) => void;
  onSortOrderChange?: (value: SourceSortOrder) => void;
  onTagFilterChange?: (value: string) => void;
  isConnected: boolean;
  isLoading: boolean;
  removeState: AsyncStatus;
  isFullscreen?: boolean;
  /** 搜索队列 */
  searchQueue?: SearchQueueItem[];
  /** 移除单个搜索队列项 */
  onRemoveSearchQueueItem?: (queueItemId: string) => void;
  /** 从搜索队列中移除已添加的结果 */
  onRemoveResultsFromQueue?: (urls: string[]) => void;
  /** 可用的提取器列表 */
  availableExtractors?: ExtractorInfo[];
  /** 全量提取器列表（含不可用/禁用项） */
  extractors?: ExtractorInfo[];
  /** 默认提取器 */
  defaultExtractor?: ExtractorType | null;
  /** notebook 级别提取器策略 */
  extractorsPolicy?: NotebookExtractorsPolicy | null;
  /** 是否启用提取器回退 */
  extractorFallbackEnabled?: boolean | null;
  /** 提取器清单加载中 */
  extractorsLoading?: boolean;
  /** 更新 notebook 级提取器策略 */
  onPatchExtractorsPolicy?: (patch: PatchNotebookExtractorsPolicyRequest) => Promise<void>;
  /** 刷新提取器可用性 */
  onRefreshExtractors?: () => Promise<void> | void;
  /** 将来源问答转换为新来源 */
  onConvertSourceQAToSource?: (sourceId: number, messages: QaMessage[]) => Promise<unknown>;
  /** 重新嵌入失败来源 */
  onReembedSource?: (sourceId: number) => Promise<unknown>;
  /** 当前 notebook ID，用于深度研究功能 */
  notebookId?: number;
  onSelectedSourceIdsChange?: (selected: Record<number, boolean>) => void;
}

export type SourcesPanelViewProps = SourcesPanelProps;
