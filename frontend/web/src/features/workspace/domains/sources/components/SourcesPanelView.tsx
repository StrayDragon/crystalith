import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Typography,
  Checkbox,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Chip,
  Spinner,
  Tooltip,
} from "@material-tailwind/react";
import {
  Search as SearchIcon,
  MoreHoriz as MoreHorizIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  OpenInFull as OpenInFullIcon,
  History as HistoryIcon,
  Close as CloseIcon,
  Replay as ReplayIcon,
  ContentCopy as ContentCopyIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { Virtuoso } from "react-virtuoso";
import type { VirtuosoHandle } from "react-virtuoso";

import type { AsyncStatus } from "../../../../../shared/types";
import type {
  ExtractorInfoResponse as ExtractorInfo,
  NotebookExtractorsPolicy,
  PatchNotebookExtractorsPolicyRequest,
  QaMessage,
  SourceFromUrlMode,
  SourceTagRead,
} from "../../../../../api/generated";
import type { ApiSourceSearchResult, SourceItem } from "../../../shared/types";
import type {
  SearchQueueItem,
  SourceSortBy,
  SourceSortOrder,
  SourceUploadItem,
} from "../useSources";
import { toast } from "../../../../../shared/toast";
import { copyToClipboard } from "../../../../../shared/clipboard";
import { t } from "../../../../../shared/i18n";
import { useFocusTrap } from "../../../shared/hooks/useFocusTrap";
import ConfirmPopover from "../../../../../shared/ConfirmPopover";
import { LAYER_LEVELS } from "../../../../../shared/layer";
import { SkeletonCard, SkeletonList } from "../../../shared/components/Skeleton";
import {
  SOURCE_UPLOAD_ACCEPT,
  SOURCE_UPLOAD_SUPPORTED_EXTENSIONS,
  SOURCE_UPLOAD_SUPPORTED_MIME_TYPES,
} from "../../../shared/uploadTypes";
import type { ChatMessage } from "../SourceDetailDialog";
import SearchResultsQueue from "../SearchResultsQueue";
import AddSearchResultDialog from "../AddSearchResultDialog";
import ResearchCapsule from "../../research/ResearchCapsule";
import type { SearchResultItem } from "../SearchResultCard";
import type { useResearch } from "../../research/useResearch";
import ExtractorPolicyDialog from "./ExtractorPolicyDialog";

const SourceDetailDialog = lazy(() => import("../SourceDetailDialog"));
const ResearchDetailPanel = lazy(() => import("../../research/ResearchDetailPanel"));

type ExtractorType = ExtractorInfo["type"];

const SEARCH_ENGINE_WEB = "Web" as const;
type SearchEngine = typeof SEARCH_ENGINE_WEB;

const SEARCH_MODES = ["Fast Research", "Deep Research"] as const;
type SearchMode = (typeof SEARCH_MODES)[number];

function normalizeSearchMode(value: string | null): SearchMode {
  if (!value) return "Fast Research";
  return SEARCH_MODES.includes(value as SearchMode) ? (value as SearchMode) : "Fast Research";
}

function splitUploadFiles(files: File[]) {
  const supported: File[] = [];
  const unsupported: File[] = [];

  files.forEach((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = (file.type || "").toLowerCase();
    const isSupported =
      SOURCE_UPLOAD_SUPPORTED_EXTENSIONS.has(extension) ||
      SOURCE_UPLOAD_SUPPORTED_MIME_TYPES.has(type);

    if (isSupported) {
      supported.push(file);
    } else {
      unsupported.push(file);
    }
  });

  return { supported, unsupported };
}

export interface SourcesPanelProps {
  sources: SourceItem[];
  /** 外部触发定位/高亮某个来源 */
  jumpToSource?: { id: number; token: number } | null;
  onUpload: (input: File | File[] | FileList | null) => void;
  uploadState: AsyncStatus;
  uploadError?: string;
  uploadQueue?: SourceUploadItem[];
  onRetryUpload?: () => void;
  onClearUploadQueue?: () => void;
  searchState: AsyncStatus;
  searchNotice: string;
  searchResults: ApiSourceSearchResult[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onClearSearchResults: () => void;
  onAddSourceFromUrl: (
    url: string,
    mode: SourceFromUrlMode,
    options?: { title?: string; snippet?: string; extractor?: ExtractorType },
  ) => Promise<unknown>;
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

type Research = ReturnType<typeof useResearch>;

export type SourcesPanelViewProps = SourcesPanelProps & {
  research: Research;
};

function SourcesPanelView({
  sources,
  jumpToSource = null,
  onUpload,
  uploadState,
  uploadError = "",
  uploadQueue = [],
  onRetryUpload,
  onClearUploadQueue,
  searchState,
  searchNotice,
  searchResults,
  onSearch,
  onClearSearchResults,
  onAddSourceFromUrl,
  onRemoveSources,
  onRemoveSource,
  onBatchReembedSources,
  sourceTags = [],
  tagMutationState = "idle",
  onCreateSourceTag,
  onAssignTagToSources,
  onRemoveTagFromSources,
  sortBy = "date",
  sortOrder = "desc",
  tagFilter = "",
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
  const uploadDisabled = !isConnected || uploadState === "loading";
  const isSearching = searchState === "loading";
  const [searchQuery, setSearchQuery] = useState("");
  const engine: SearchEngine = SEARCH_ENGINE_WEB;
  // Load search mode preference from localStorage
  const [mode, setMode] = useState<SearchMode>(() => {
    if (typeof window !== "undefined") {
      return normalizeSearchMode(localStorage.getItem("crystalith_search_mode"));
    }
    return "Fast Research";
  });

  // Save search mode preference to localStorage
  useEffect(() => {
    localStorage.setItem("crystalith_search_mode", mode);
  }, [mode]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<number, boolean>>({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceListRef = useRef<VirtuosoHandle | null>(null);
  const sourceRefs = useRef(new Map<number, HTMLDivElement | null>());
  const researchModalRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fastSearchDebounceTimerRef = useRef<number | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<number | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploadHint, setUploadHint] = useState(t("sources.upload.hint.default"));
  const isDeepResearchMode = mode === "Deep Research";
  const searchPlaceholder = isDeepResearchMode
    ? t("sources.search.placeholder.deep")
    : t("sources.search.placeholder");
  const searchModeToggleLabel = isDeepResearchMode
    ? t("sources.search.toggle.to_fast")
    : t("sources.search.toggle.to_deep");

  // Add search results dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resultsToAdd, setResultsToAdd] = useState<SearchResultItem[]>([]);
  const [addMode, setAddMode] = useState<SourceFromUrlMode>("link");
  const [selectedExtractor, setSelectedExtractor] = useState<ExtractorType | undefined>(undefined);
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [extractorPolicyOpen, setExtractorPolicyOpen] = useState(false);

  // Deep Research state
  const [researchDetailOpen, setResearchDetailOpen] = useState(false);
  const [researchFullscreen, setResearchFullscreen] = useState(true); // Default fullscreen
  const [showResearchHistory, setShowResearchHistory] = useState(false);

  const handleOpenDetail = useCallback(
    (source: SourceItem) => {
      setSelectedSource(source);
      setDetailDialogOpen(true);
      // If panel is in fullscreen mode, open detail in fullscreen too
      setIsDetailFullscreen(isFullscreen);
    },
    [isFullscreen],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setIsDetailFullscreen(false);
  }, []);

  const handleToggleDetailFullscreen = useCallback(() => {
    setIsDetailFullscreen((prev) => !prev);
  }, []);

  // Handle saving QA as source
  const handleSaveQAAsSource = useCallback(
    async (sourceTitle: string, messages: ChatMessage[]) => {
      if (!selectedSource || !onConvertSourceQAToSource) return;
      // Convert ChatMessage to QaMessage format
      const qaMessages: QaMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await onConvertSourceQAToSource(selectedSource.id, qaMessages);
    },
    [selectedSource, onConvertSourceQAToSource],
  );

  const handleAddToSources = useCallback(
    (selected: SearchResultItem[], mode: SourceFromUrlMode, extractor?: ExtractorType) => {
      setResultsToAdd(selected);
      setAddMode(mode);
      setSelectedExtractor(extractor);
      setAddDialogOpen(true);
    },
    [],
  );

  const handleAddSource = useCallback(
    async (result: SearchResultItem, mode: SourceFromUrlMode) => {
      await onAddSourceFromUrl(result.url, mode, {
        title: result.title,
        snippet: result.snippet ?? undefined,
        extractor: mode === "fetch" ? selectedExtractor : undefined,
      });
    },
    [onAddSourceFromUrl, selectedExtractor],
  );

  const handleAddComplete = useCallback(() => {
    // 从搜索队列中移除已成功添加的结果，而不是清空整个队列
    if (resultsToAdd.length > 0 && onRemoveResultsFromQueue) {
      const addedUrls = resultsToAdd.map((r) => r.url);
      onRemoveResultsFromQueue(addedUrls);
    }
    setResultsToAdd([]);
    // 不再调用 onClearSearchResults，保持搜索队列可见
  }, [resultsToAdd, onRemoveResultsFromQueue]);

  const handleCloseAddDialog = useCallback(() => {
    setAddDialogOpen(false);
  }, []);

  const extractorModeLabel = useMemo(() => {
    const mode = extractorsPolicy?.mode ?? "inherit_global";
    return mode === "custom" ? "自定义" : "遵循全局";
  }, [extractorsPolicy?.mode]);

  const usableExtractorCount = useMemo(
    () => extractors.filter((ext) => ext.enabled && ext.available).length,
    [extractors],
  );

  useEffect(() => {
    if (!sources.length) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
      return;
    }
    setSelectedSourceIds((prev) => {
      const next: Record<number, boolean> = {};
      const hasExistingSelection = Object.values(prev).some(Boolean);
      sources.forEach((source) => {
        const isSelectable = source.statusTone === "READY";
        next[source.id] = hasExistingSelection
          ? isSelectable
            ? Boolean(prev[source.id])
            : false
          : isSelectable;
      });
      return next;
    });
  }, [sources]);

  useEffect(() => {
    return () => {
      if (fastSearchDebounceTimerRef.current != null) {
        window.clearTimeout(fastSearchDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onSelectedSourceIdsChange?.(selectedSourceIds);
  }, [onSelectedSourceIdsChange, selectedSourceIds]);

  const sourceIdToIndex = useMemo(() => {
    const map = new Map<number, number>();
    sources.forEach((source, index) => {
      map.set(source.id, index);
    });
    return map;
  }, [sources]);

  useEffect(() => {
    if (!jumpToSource) return;
    const targetIndex = sourceIdToIndex.get(jumpToSource.id);
    if (targetIndex != null) {
      sourceListRef.current?.scrollToIndex({
        index: targetIndex,
        align: "center",
        behavior: "smooth",
      });
    }
    const node = sourceRefs.current.get(jumpToSource.id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSourceId(jumpToSource.id);
    const timer = window.setTimeout(() => setHighlightedSourceId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [jumpToSource, sourceIdToIndex]);

  const selectableSources = useMemo(
    () => sources.filter((source) => source.statusTone === "READY"),
    [sources],
  );
  const allSelected = useMemo(
    () =>
      selectableSources.length > 0 &&
      selectableSources.every((source) => selectedSourceIds[source.id]),
    [selectableSources, selectedSourceIds],
  );
  const selectedIds = useMemo(
    () => sources.filter((source) => selectedSourceIds[source.id]).map((source) => source.id),
    [sources, selectedSourceIds],
  );
  const selectedTagNames = useMemo(() => {
    const tagSet = new Set<string>();
    sources
      .filter((source) => selectedSourceIds[source.id])
      .forEach((source) => {
        source.tags.forEach((tag) => tagSet.add(tag));
      });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [sources, selectedSourceIds]);

  const mutationBusy =
    removeState === "loading" || tagMutationState === "loading" || uploadState === "loading";
  const removeDisabled = !isConnected || mutationBusy || selectedIds.length === 0;
  const batchReembedDisabled =
    !isConnected || !onBatchReembedSources || selectedIds.length === 0 || mutationBusy;
  const batchTagDisabled =
    !isConnected ||
    (!onAssignTagToSources && !onRemoveTagFromSources) ||
    selectedIds.length === 0 ||
    mutationBusy;

  function handleToggleAll() {
    if (allSelected) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
      return;
    }
    const next: Record<number, boolean> = {};
    selectableSources.forEach((source) => {
      next[source.id] = true;
    });
    setSelectedSourceIds(next);
    if (selectableSources.length > 0) {
      const firstIndex = sourceIdToIndex.get(selectableSources[0].id);
      setLastSelectedIndex(firstIndex ?? null);
    }
  }

  const handleToggleSource = useCallback(
    (id: number, event?: Pick<MouseEvent, "shiftKey" | "ctrlKey" | "metaKey">) => {
      const source = sources.find((item) => item.id === id);
      if (!source || source.statusTone !== "READY") return;

      const index = sourceIdToIndex.get(id);
      if (index == null) return;

      const shiftPressed = Boolean(event?.shiftKey);
      const togglePressed = Boolean(event?.ctrlKey || event?.metaKey);

      setSelectedSourceIds((prev) => {
        const next = { ...prev };

        if (shiftPressed && lastSelectedIndex != null) {
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          for (let cursor = start; cursor <= end; cursor += 1) {
            const item = sources[cursor];
            if (item?.statusTone === "READY") {
              next[item.id] = true;
            }
          }
          return next;
        }

        if (togglePressed) {
          next[id] = !prev[id];
          return next;
        }

        next[id] = !prev[id];
        return next;
      });

      setLastSelectedIndex(index);
    },
    [sources, sourceIdToIndex, lastSelectedIndex],
  );

  const handleBatchDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    const success = await onRemoveSources(selectedIds);
    if (success) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
    }
  }, [onRemoveSources, selectedIds]);

  const handleBatchReembed = useCallback(async () => {
    if (!onBatchReembedSources || !selectedIds.length) return;
    await onBatchReembedSources(selectedIds);
  }, [onBatchReembedSources, selectedIds]);

  const handleBatchCreateAndAssignTag = useCallback(async () => {
    if (!onCreateSourceTag || !onAssignTagToSources || selectedIds.length === 0) return;
    const rawName = window.prompt("输入新标签名称（会分配给已选来源）");
    const name = rawName?.trim();
    if (!name) return;
    const tag = await onCreateSourceTag(name);
    if (!tag) return;
    await onAssignTagToSources(tag.id, selectedIds);
  }, [onCreateSourceTag, onAssignTagToSources, selectedIds]);

  const handleAssignExistingTag = useCallback(
    async (tagId: number) => {
      if (!onAssignTagToSources || selectedIds.length === 0) return;
      await onAssignTagToSources(tagId, selectedIds);
    },
    [onAssignTagToSources, selectedIds],
  );

  const handleRemoveExistingTag = useCallback(
    async (tagId: number) => {
      if (!onRemoveTagFromSources || selectedIds.length === 0) return;
      await onRemoveTagFromSources(tagId, selectedIds);
    },
    [onRemoveTagFromSources, selectedIds],
  );

  const handleSearch = async () => {
    // Deep Research mode
    if (mode === "Deep Research") {
      if (!isConnected) {
        toast.error(t("sources.research.backend_disconnected"));
        return;
      }
      if (!notebookId) {
        toast.error(t("sources.research.require_notebook"));
        return;
      }
      if (!searchQuery.trim()) {
        toast.error(t("sources.research.require_topic"));
        return;
      }

      // 检查是否正在加载
      if (research.isLoading) {
        toast.error(t("sources.research.busy"));
        return;
      }

      // 检查是否有正在运行的研究任务（包括 planning 状态，因为用户可能还没点击开始）
      const hasActiveResearch = research.sessions.some((s) =>
        ["planning", "searching", "analyzing", "waiting_user"].includes(s.status),
      );
      if (hasActiveResearch) {
        toast.error(t("sources.research.active_exists"));
        return;
      }

      try {
        const session = await research.createSession(searchQuery.trim());
        if (session) {
          // Start the research immediately
          // SSE subscription is handled by useEffect when activeSession changes
          await research.startResearch(session.id);
          setSearchQuery("");
          toast.success(t("sources.research.started"));
        }
      } catch (error) {
        toast.error(t("sources.research.create_failed"));
      }
      return;
    }

    // Fast Research mode - use existing search
    if (fastSearchDebounceTimerRef.current != null) {
      window.clearTimeout(fastSearchDebounceTimerRef.current);
    }
    fastSearchDebounceTimerRef.current = window.setTimeout(() => {
      onSearch({ query: searchQuery, engine, mode });
    }, 300);
  };

  const handleToggleSearchMode = useCallback(() => {
    setMode((prev) => (prev === "Deep Research" ? "Fast Research" : "Deep Research"));
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  // Handle research session click
  const handleResearchClick = useCallback(
    async (sessionId: number) => {
      // Unsubscribe from any existing SSE connection and clear events
      research.unsubscribeFromSSE();
      research.clearEvents();
      const session = await research.fetchSession(sessionId);
      if (!session) {
        toast.error(t("sources.research.detail_fetch_failed"));
        return;
      }
      setResearchDetailOpen(true);
    },
    [research],
  );

  // Handle research actions
  const handleResearchStart = useCallback(
    async (sessionId: number) => {
      // SSE subscription is handled by useEffect when activeSession changes
      await research.startResearch(sessionId);
    },
    [research],
  );

  const handleResearchDelete = useCallback(
    async (sessionId: number) => {
      await research.deleteSession(sessionId);
    },
    [research],
  );

  const handleResearchApprove = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.approveSearchPlan(research.activeSession.id);
    }
  }, [research]);

  const handleResearchSkip = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.skipIteration(research.activeSession.id);
    }
  }, [research]);

  const handleResearchFinish = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.finishResearch(research.activeSession.id);
    }
  }, [research]);

  const handleResearchCancel = useCallback(async () => {
    if (research.activeSession?.id) {
      await research.cancelResearch(research.activeSession.id);
      // Close the detail panel after cancelling
      setResearchDetailOpen(false);
    }
  }, [research]);

  const handleResearchResume = useCallback(async () => {
    if (!research.activeSession?.id) return;
    research.unsubscribeFromSSE();
    research.clearEvents();
    const resumed = await research.resumeResearch(research.activeSession.id);
    if (!resumed) {
      toast.error(t("sources.research.resume_failed"));
    }
  }, [research]);

  const handleResearchRetry = useCallback(async () => {
    if (!research.activeSession) return;
    research.unsubscribeFromSSE();
    research.clearEvents();
    const session = await research.createSession(
      research.activeSession.topic,
      research.activeSession.max_iterations,
    );
    if (session) {
      await research.startResearch(session.id);
      setResearchDetailOpen(true);
    }
  }, [research]);

  const handleCloseResearchDetail = useCallback(() => {
    setResearchDetailOpen(false);
    // Refresh the session to get latest state
    if (research.activeSession?.id) {
      research.fetchSession(research.activeSession.id);
    }
  }, [research]);

  return (
    <div
      className={`flex flex-1 flex-col min-h-0 ${isFullscreen ? "max-w-4xl mx-auto w-full" : ""}`}
    >
      {/* Fixed Header: Upload & Search - Always visible */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 flex flex-col gap-3 border-b border-gray-100 dark:border-slate-700">
        {/* Upload Button */}
        <Tooltip content={t("sources.upload.tooltip")}>
          <div
            className={`rounded-full ${uploadDragActive ? "ring-2 ring-blue-200" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (uploadDisabled) return;
              setUploadDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setUploadDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setUploadDragActive(false);
              if (uploadDisabled) return;
              const droppedFiles = Array.from(event.dataTransfer.files ?? []);
              if (!droppedFiles.length) return;
              const { supported, unsupported } = splitUploadFiles(droppedFiles);
              if (unsupported.length > 0) {
                toast.warning(t("sources.upload.toast.unsupported", { count: unsupported.length }));
              }
              if (supported.length === 0) {
                setUploadHint(t("sources.upload.hint.only_supported"));
                return;
              }
              setUploadHint(
                unsupported.length > 0
                  ? t("sources.upload.hint.filtered_ready", {
                      unsupported: unsupported.length,
                      supported: supported.length,
                    })
                  : t("sources.upload.hint.default"),
              );
              onUpload(supported);
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              size="sm"
              disabled={uploadDisabled}
              className="flex items-center justify-center gap-2 py-2 rounded-full border-dashed border-gray-400 normal-case font-normal text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-gray-500"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadState === "loading" ? (
                <Spinner className="h-3 w-3" />
              ) : (
                <CloudUploadIcon style={{ fontSize: 18 }} />
              )}
              {uploadDragActive
                ? t("sources.upload.drag_drop")
                : uploadState === "loading"
                  ? t("sources.upload.uploading")
                  : t("sources.upload.add_sources")}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept={SOURCE_UPLOAD_ACCEPT}
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files ?? []);
                  const { supported, unsupported } = splitUploadFiles(selectedFiles);
                  if (unsupported.length > 0) {
                    toast.warning(
                      t("sources.upload.toast.unsupported", { count: unsupported.length }),
                    );
                  }
                  if (supported.length > 0) {
                    onUpload(supported);
                  }
                  if (event.target) {
                    event.target.value = "";
                  }
                }}
                disabled={uploadDisabled}
                id="source-upload-input"
                name="sourceUpload"
                aria-label={t("sources.upload.aria_label")}
              />
            </Button>
          </div>
        </Tooltip>

        <Typography variant="small" className="text-[10px] text-gray-500 dark:text-slate-400 px-1">
          {uploadDragActive ? "拖放文件到此处" : uploadHint}
        </Typography>

        {uploadError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            <span className="flex-1">{uploadError}</span>
            {onRetryUpload ? (
              <button
                type="button"
                className="font-semibold text-red-800 hover:underline"
                onClick={onRetryUpload}
              >
                重试上传
              </button>
            ) : null}
          </div>
        ) : null}

        {uploadQueue.length > 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <Typography variant="small" className="text-[11px] font-semibold text-gray-600">
                上传队列
              </Typography>
              {onClearUploadQueue ? (
                <button
                  type="button"
                  className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200"
                  onClick={onClearUploadQueue}
                >
                  清空
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              {uploadQueue.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[11px] text-gray-600"
                >
                  <span className="truncate pr-2">{item.name}</span>
                  <span
                    className={
                      item.status === "error"
                        ? "text-red-600"
                        : item.status === "success"
                          ? "text-green-600"
                          : "text-blue-600"
                    }
                  >
                    {item.status === "queued"
                      ? "等待中"
                      : item.status === "uploading"
                        ? "上传中"
                        : item.status === "success"
                          ? "完成"
                          : "失败"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Search Section */}
        <div
          className={
            isDeepResearchMode
              ? "rounded-lg p-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-sm ux-animated-gradient focus-within:ring-2 focus-within:ring-indigo-500/25"
              : "rounded-lg border border-gray-300 bg-white dark:bg-slate-900 transition-colors duration-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300"
          }
        >
          <div className="rounded-[7px] bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-2">
              <div className="flex w-full items-center gap-2">
                <Tooltip content={searchModeToggleLabel}>
                  <button
                    type="button"
                    onClick={handleToggleSearchMode}
                    aria-label={searchModeToggleLabel}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:shadow-sm active:scale-[0.98] bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span key={isDeepResearchMode ? "deep" : "fast"} className="ux-fade-in">
                      {isDeepResearchMode ? (
                        <PsychologyIcon style={{ fontSize: 20 }} />
                      ) : (
                        <SearchIcon style={{ fontSize: 20 }} />
                      )}
                    </span>
                  </button>
                </Tooltip>

                <input
                  ref={searchInputRef}
                  className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-transparent border border-transparent outline-none text-sm text-gray-800 placeholder-gray-500 focus:ring-0 transition-colors duration-200"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  id="source-search-input"
                  name="sourceSearch"
                  aria-label={
                    isDeepResearchMode
                      ? t("sources.search.aria_label.deep")
                      : t("sources.search.aria_label")
                  }
                />

                <IconButton
                  size="sm"
                  aria-label={
                    isDeepResearchMode
                      ? t("sources.search.action.deep")
                      : t("sources.search.action.fast")
                  }
                  className="rounded-full w-9 h-9 transition-all duration-200 active:scale-[0.98] bg-blue-500 hover:bg-blue-600"
                  onClick={handleSearch}
                >
                  <ArrowForwardIcon style={{ fontSize: 16 }} />
                </IconButton>
              </div>
            </div>

            {isDeepResearchMode ? (
              <div className="px-3 pb-2 -mt-1">
                <Typography
                  variant="small"
                  className="text-[11px] text-gray-600 dark:text-slate-400 ux-slide-in"
                >
                  {t("sources.search.hint.deep")}
                </Typography>
              </div>
            ) : null}

            <div className={`px-3 pb-2 ${isDeepResearchMode ? "" : "-mt-1"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-gray-600 dark:text-slate-400">
                  提取器：{extractorModeLabel}
                  {extractorsLoading
                    ? " · 加载中…"
                    : ` · 可用 ${usableExtractorCount}/${extractors.length}`}
                  {extractorFallbackEnabled == null
                    ? ""
                    : ` · 回退 ${extractorFallbackEnabled ? "开启" : "关闭"}`}
                </div>
                <button
                  type="button"
                  onClick={() => setExtractorPolicyOpen(true)}
                  disabled={!isConnected}
                  className="text-[11px] text-blue-600 hover:text-blue-700 disabled:opacity-60 flex items-center gap-1"
                >
                  <SettingsIcon style={{ fontSize: 14 }} />
                  提取器设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Content Area - research sessions & search results (scrollable with max-height) */}
      {(isSearching ||
        research.sessions.length > 0 ||
        searchResults.length > 0 ||
        searchQueue.length > 0) && (
        <div className="flex-shrink-0 max-h-[200px] overflow-y-auto overscroll-contain px-3 sm:px-4 py-2 flex flex-col gap-2 border-b border-gray-100 dark:border-slate-700">
          {/* Search Status - only show loading state */}
          {isSearching && (
            <Typography variant="small" className="text-[11px] text-gray-600 font-medium px-1">
              {t("sources.search.searching")}
            </Typography>
          )}

          {/* Deep Research Sessions */}
          {research.sessions.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Active sessions */}
              {research.sessions
                .filter((s) =>
                  ["planning", "searching", "analyzing", "waiting_user"].includes(s.status),
                )
                .map((session) => (
                  <ResearchCapsule
                    key={session.id}
                    session={session}
                    onClick={() => handleResearchClick(session.id)}
                    onStart={() => handleResearchStart(session.id)}
                    onDelete={() => handleResearchDelete(session.id)}
                    isExpanded={research.activeSession?.id === session.id}
                  />
                ))}
              {(() => {
                const historySessions = research.sessions.filter((s) =>
                  ["completed", "cancelled"].includes(s.status),
                );
                if (historySessions.length === 0) return null;
                return (
                  <button
                    onClick={() => setShowResearchHistory(true)}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  >
                    <HistoryIcon style={{ fontSize: 14 }} />
                    查看研究历史 ({historySessions.length})
                  </button>
                );
              })()}
            </div>
          )}

          {/* Search Results Queue */}
          <SearchResultsQueue
            results={searchResults}
            searchSummary={searchNotice}
            onClear={onClearSearchResults}
            onAddToSources={handleAddToSources}
            isAdding={isAddingFromUrl}
            searchQueue={searchQueue}
            onRemoveQueueItem={onRemoveSearchQueueItem}
            availableExtractors={availableExtractors}
            defaultExtractor={defaultExtractor}
          />
        </div>
      )}

      {/* Compact toolbar: select-all + sort/filter + batch actions */}
      <div className="flex-shrink-0 px-3 sm:px-4 py-1.5 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-1">
          {/* Select all checkbox */}
          <Checkbox
            checked={allSelected}
            onChange={handleToggleAll}
            containerProps={{ className: "p-0.5" }}
            className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
            iconProps={{ className: "text-white" }}
          />
          <Typography
            variant="small"
            className="text-[11px] text-gray-500 dark:text-slate-400 whitespace-nowrap"
          >
            {selectedIds.length > 0
              ? `已选 ${selectedIds.length}/${sources.length}`
              : `${sources.length} 个来源`}
          </Typography>

          <span className="flex-1" />

          {/* Sort & filter dropdown */}
          <Menu placement="bottom-end">
            <MenuHandler>
              <IconButton
                size="sm"
                variant="text"
                aria-label="来源排序与筛选"
                className="w-6 h-6 min-w-[24px] rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <ExpandMoreIcon style={{ fontSize: 16 }} />
              </IconButton>
            </MenuHandler>
            <MenuList className="p-1 min-w-[160px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg">
              <div className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                排序字段
              </div>
              {(
                [
                  ["date", "日期"],
                  ["name", "名称"],
                  ["size", "大小"],
                  ["type", "类型"],
                ] as const
              ).map(([val, label]) => (
                <MenuItem
                  key={val}
                  onClick={() => onSortByChange?.(val as SourceSortBy)}
                  className={`py-1.5 px-3 text-xs ${sortBy === val ? "bg-gray-100 dark:bg-slate-800 font-medium" : ""}`}
                >
                  {sortBy === val ? "✓ " : "   "}
                  {label}
                </MenuItem>
              ))}
              <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
              <div className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                排序方向
              </div>
              {(
                [
                  ["desc", "降序"],
                  ["asc", "升序"],
                ] as const
              ).map(([val, label]) => (
                <MenuItem
                  key={val}
                  onClick={() => onSortOrderChange?.(val as SourceSortOrder)}
                  className={`py-1.5 px-3 text-xs ${sortOrder === val ? "bg-gray-100 dark:bg-slate-800 font-medium" : ""}`}
                >
                  {sortOrder === val ? "✓ " : "   "}
                  {label}
                </MenuItem>
              ))}
              {sourceTags.length > 0
                ? [
                    <div
                      key="tag-filter-divider"
                      className="my-1 border-t border-gray-100 dark:border-slate-700"
                    />,
                    <div
                      key="tag-filter-title"
                      className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider"
                    >
                      标签筛选
                    </div>,
                    <MenuItem
                      key="tag-filter-all"
                      onClick={() => onTagFilterChange?.("")}
                      className={`py-1.5 px-3 text-xs ${!tagFilter ? "bg-gray-100 dark:bg-slate-800 font-medium" : ""}`}
                    >
                      {!tagFilter ? "✓ " : "   "}全部
                    </MenuItem>,
                    ...sourceTags.map((tag) => (
                      <MenuItem
                        key={tag.id}
                        onClick={() => onTagFilterChange?.(tag.name)}
                        className={`py-1.5 px-3 text-xs ${tagFilter === tag.name ? "bg-gray-100 dark:bg-slate-800 font-medium" : ""}`}
                      >
                        {tagFilter === tag.name ? "✓ " : "   "}
                        {tag.name}
                      </MenuItem>
                    )),
                  ]
                : []}
            </MenuList>
          </Menu>

          {/* Batch actions — only when sources selected */}
          {selectedIds.length > 0 && (
            <Menu placement="bottom-end">
              <MenuHandler>
                <IconButton
                  size="sm"
                  variant="text"
                  aria-label="已选来源操作"
                  className="w-6 h-6 min-w-[24px] rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <MoreHorizIcon style={{ fontSize: 16 }} />
                </IconButton>
              </MenuHandler>
              <MenuList className="p-1 min-w-[180px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg">
                <ConfirmPopover
                  message={
                    selectedIds.length === 1
                      ? "确定要移除已选的 1 个来源吗？"
                      : `确定要移除已选的 ${selectedIds.length} 个来源吗？`
                  }
                  onConfirm={handleBatchDelete}
                  placement="left"
                  disabled={removeDisabled}
                >
                  <MenuItem
                    disabled={removeDisabled}
                    className="flex items-center gap-2 py-1.5 px-3 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <DeleteIcon style={{ fontSize: 14 }} />
                    删除已选 ({selectedIds.length})
                  </MenuItem>
                </ConfirmPopover>

                {onBatchReembedSources && (
                  <MenuItem
                    disabled={batchReembedDisabled}
                    onClick={handleBatchReembed}
                    className="flex items-center gap-2 py-1.5 px-3 text-xs"
                  >
                    <ReplayIcon style={{ fontSize: 14 }} />
                    重新嵌入 ({selectedIds.length})
                  </MenuItem>
                )}

                {onAssignTagToSources || onRemoveTagFromSources
                  ? [
                      <div
                        key="tag-actions-divider"
                        className="my-1 border-t border-gray-100 dark:border-slate-700"
                      />,
                      <MenuItem
                        key="tag-actions-create"
                        onClick={handleBatchCreateAndAssignTag}
                        disabled={
                          !onCreateSourceTag ||
                          !onAssignTagToSources ||
                          tagMutationState === "loading"
                        }
                        className="flex items-center gap-2 py-1.5 px-3 text-xs"
                      >
                        新建并分配标签
                      </MenuItem>,
                      ...sourceTags.map((tag) => (
                        <MenuItem
                          key={`assign-${tag.id}`}
                          onClick={() => handleAssignExistingTag(tag.id)}
                          disabled={!onAssignTagToSources || tagMutationState === "loading"}
                          className="py-1.5 px-3 text-xs"
                        >
                          添加标签：{tag.name}
                        </MenuItem>
                      )),
                      ...(selectedTagNames.length > 0
                        ? [
                            <div
                              key="tag-actions-divider-remove"
                              className="my-1 border-t border-gray-100 dark:border-slate-700"
                            />,
                          ]
                        : []),
                      ...selectedTagNames.flatMap((tagName) => {
                        const tag = sourceTags.find((item) => item.name === tagName);
                        if (!tag) return [];
                        return [
                          <MenuItem
                            key={`remove-${tag.id}`}
                            onClick={() => handleRemoveExistingTag(tag.id)}
                            disabled={!onRemoveTagFromSources || tagMutationState === "loading"}
                            className="py-1.5 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            移除标签：{tag.name}
                          </MenuItem>,
                        ];
                      }),
                    ]
                  : []}
              </MenuList>
            </Menu>
          )}
        </div>
      </div>

      {/* Sources List - fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 sm:px-4 pt-2 pb-1">
        {isLoading ? (
          <SkeletonList items={3} />
        ) : sources.length === 0 ? (
          <div className="p-3 text-center border border-dashed border-gray-300 rounded-lg bg-gray-100 dark:bg-slate-800">
            <Typography
              variant="small"
              className="text-gray-700 dark:text-slate-200 text-[11px] font-semibold"
            >
              添加文档开始分析
            </Typography>
            <Typography
              variant="small"
              className="text-gray-500 dark:text-slate-400 text-[10px] mt-1"
            >
              上传文档后，可在中间面板提问并在右侧生成输出。
            </Typography>
          </div>
        ) : (
          <Virtuoso
            ref={sourceListRef}
            style={{ flex: 1, minHeight: 0 }}
            data={sources}
            computeItemKey={(_index, source) => source.id}
            itemContent={(_index, source) => {
              const isHighlighted = highlightedSourceId === source.id;
              const isSelectable = source.statusTone === "READY";
              const statusProgress =
                source.statusTone === "PROCESSING" && typeof source.indexProgress === "number"
                  ? Math.min(100, Math.max(0, Math.round(source.indexProgress)))
                  : null;
              const statusLabel =
                statusProgress != null ? `索引中 (${statusProgress}%)` : source.status;
              const statusColor =
                source.statusTone === "READY"
                  ? "green"
                  : source.statusTone === "PROCESSING"
                    ? "amber"
                    : "red";
              return (
                <div
                  ref={(node) => {
                    sourceRefs.current.set(source.id, node);
                  }}
                  className={`group relative flex items-center rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-gray-300 hover:shadow mb-1.5 ux-slide-in ${
                    isHighlighted
                      ? "border-blue-200 ring-2 ring-blue-300 bg-blue-50/70"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <button
                    className="flex flex-1 items-center gap-3 p-2 text-left min-w-0"
                    onClick={(event) => {
                      if (event.shiftKey || event.ctrlKey || event.metaKey) {
                        handleToggleSource(source.id, event.nativeEvent);
                        return;
                      }
                      handleOpenDetail(source);
                    }}
                    aria-label={`打开来源 ${source.title}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex-shrink-0">
                      <DescriptionIcon style={{ fontSize: 18 }} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Typography
                          variant="small"
                          className="font-semibold text-gray-900 dark:text-slate-100 text-xs truncate"
                        >
                          {source.title}
                        </Typography>
                        <Chip
                          value={statusLabel}
                          size="sm"
                          variant="ghost"
                          color={statusColor}
                          className="h-5 px-2 py-0 text-[10px] font-medium flex-shrink-0"
                        />
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {source.type}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {source.createdAt}
                        </span>
                        {source.tags.length > 0 ? (
                          <span className="truncate text-[10px] text-blue-600">
                            {source.tags.map((tag) => `#${tag}`).join(" ")}
                          </span>
                        ) : null}
                      </div>
                      {source.statusTone === "FAILED" &&
                      (source.errorMessage || source.recoveryHint || source.errorCode) ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-red-600 dark:text-red-400 truncate">
                            {source.errorMessage || source.errorCode || "导入失败"}
                          </span>
                          {source.recoveryHint ? (
                            <Tooltip content={source.recoveryHint}>
                              <span className="text-[10px] text-red-500 underline decoration-dotted cursor-help">
                                修复建议
                              </span>
                            </Tooltip>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 pr-2">
                    <Menu placement="bottom-end">
                      <MenuHandler>
                        <IconButton
                          size="sm"
                          variant="text"
                          className="w-6 h-6 min-w-[24px] rounded-full text-gray-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreHorizIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </MenuHandler>
                      <MenuList className="p-1 min-w-[140px]">
                        <MenuItem
                          onClick={() => {
                            setSelectedSource(source);
                            setDetailDialogOpen(true);
                            setIsDetailFullscreen(true);
                          }}
                          className="flex items-center gap-2 py-2 px-3 text-xs"
                        >
                          <OpenInFullIcon style={{ fontSize: 16 }} />
                          <span>放大查看</span>
                        </MenuItem>
                        {source.statusTone === "FAILED" &&
                        (source.recoveryHint || source.errorMessage || source.errorCode) ? (
                          <MenuItem
                            onClick={async () => {
                              const text =
                                source.recoveryHint ||
                                source.errorMessage ||
                                source.errorCode ||
                                "";
                              const ok = await copyToClipboard(text);
                              if (ok) {
                                toast.success("已复制修复建议");
                              } else {
                                toast.error("复制失败");
                              }
                            }}
                            className="flex items-center gap-2 py-2 px-3 text-xs"
                          >
                            <ContentCopyIcon style={{ fontSize: 16 }} />
                            <span>复制修复建议</span>
                          </MenuItem>
                        ) : null}
                        <ConfirmPopover
                          message={`确定要删除「${source.title}」吗？此操作不可撤销。`}
                          onConfirm={async () => {
                            if (!isConnected || removeState === "loading") return;
                            await onRemoveSource(source.id);
                          }}
                          placement="left"
                          disabled={!isConnected || removeState === "loading"}
                        >
                          <MenuItem
                            disabled={!isConnected || removeState === "loading"}
                            className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <DeleteIcon style={{ fontSize: 16 }} />
                            <span>{removeState === "loading" ? "删除中…" : "删除来源"}</span>
                          </MenuItem>
                        </ConfirmPopover>
                        {source.statusTone === "FAILED" && onReembedSource && (
                          <MenuItem
                            onClick={async () => {
                              if (!isConnected) return;
                              await onReembedSource(source.id);
                            }}
                            className="flex items-center gap-2 py-2 px-3 text-xs"
                          >
                            <ReplayIcon style={{ fontSize: 16 }} />
                            <span>重新嵌入</span>
                          </MenuItem>
                        )}
                      </MenuList>
                    </Menu>

                    {!isSelectable ? (
                      <Tooltip content="未完成索引，暂不可用">
                        <span>
                          <Checkbox
                            checked={false}
                            onChange={(event) =>
                              handleToggleSource(source.id, event.nativeEvent as MouseEvent)
                            }
                            containerProps={{ className: "p-1" }}
                            className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
                            iconProps={{ className: "text-white" }}
                            disabled
                          />
                        </span>
                      </Tooltip>
                    ) : (
                      <Checkbox
                        checked={Boolean(selectedSourceIds[source.id])}
                        onChange={(event) =>
                          handleToggleSource(source.id, event.nativeEvent as MouseEvent)
                        }
                        containerProps={{ className: "p-1" }}
                        className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
                        iconProps={{ className: "text-white" }}
                      />
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
      {/* Source Detail Dialog */}
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

      {/* Add Search Results Dialog */}
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

      {/* Research Detail Panel - Modal Overlay */}
      {researchDetailOpen && research.activeSession && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: LAYER_LEVELS.modal }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseResearchDetail();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCloseResearchDetail();
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div
            ref={researchModalRef}
            tabIndex={-1}
            className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden ux-modal-in transition-all ${
              researchFullscreen ? "w-full max-w-5xl" : "w-full max-w-lg"
            }`}
          >
            <Suspense
              fallback={
                <div className="p-4">
                  <SkeletonCard lines={6} />
                </div>
              }
            >
              <ResearchDetailPanel
                session={research.activeSession}
                sseEvents={research.sseEvents}
                onClose={handleCloseResearchDetail}
                onApprove={handleResearchApprove}
                onSkip={handleResearchSkip}
                onFinish={handleResearchFinish}
                onCancel={handleResearchCancel}
                onResume={handleResearchResume}
                onRetry={handleResearchRetry}
                onStart={() => handleResearchStart(research.activeSession!.id)}
                isFullscreen={researchFullscreen}
                onToggleFullscreen={() => setResearchFullscreen(!researchFullscreen)}
                onAddSourceFromUrl={async (url) => {
                  await onAddSourceFromUrl(url, "link");
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Research History Dialog */}
      {showResearchHistory && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: LAYER_LEVELS.modal }}
          onClick={() => setShowResearchHistory(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden ux-modal-in w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">研究历史</h3>
              </div>
              <button
                onClick={() => setShowResearchHistory(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {research.sessions
                .filter((s) => ["completed", "cancelled"].includes(s.status))
                .map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      handleResearchClick(session.id);
                      setShowResearchHistory(false);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                          {session.topic}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {session.max_iterations} 轮研究 · {session.result_count || 0} 条结果
                        </p>
                      </div>
                      <Chip
                        value={session.status === "completed" ? "已完成" : "已取消"}
                        color={session.status === "completed" ? "green" : "gray"}
                        size="sm"
                        className="text-xs"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(session.created_at).toLocaleString("zh-CN")}
                    </p>
                  </button>
                ))}
              {research.sessions.filter((s) => ["completed", "cancelled"].includes(s.status))
                .length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <HistoryIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无已完成的研究</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SourcesPanelView);
