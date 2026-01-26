import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Typography,
  List,
  ListItem,
  ListItemPrefix,
  ListItemSuffix,
  Checkbox,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Chip,
  Card,
  Spinner,
  Tooltip,
} from '@material-tailwind/react';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreHoriz as MoreHorizIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Language as LanguageIcon,
  School as ScholarIcon,
  Article as ArticleIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon,
  OpenInFull as OpenInFullIcon,
} from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';
import type { ExtractorInfo, ExtractorType, QAMessage, SourceFromUrlMode } from '../../../api/client';
import type { ApiSourceSearchResult, SourceItem } from '../types';
import type { SearchQueueItem } from '../hooks/useSources';
import { useResearch } from '../hooks/useResearch';
import { toast } from '../../../shared/toast';
import SourceDetailDialog from './SourceDetailDialog';
import type { ChatMessage } from './SourceDetailDialog';
import SearchResultsQueue from './SearchResultsQueue';
import AddSearchResultDialog from './AddSearchResultDialog';
import ResearchCapsule from './ResearchCapsule';
import ResearchDetailPanel from './ResearchDetailPanel';
import type { SearchResultItem } from './SearchResultCard';

interface SourcesPanelProps {
  sources: SourceItem[];
  onSourceClick: (source: SourceItem) => void;
  onUpload: (file: File | null) => void;
  uploadState: AsyncStatus;
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
  isDemo: boolean;
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
  /** 默认提取器 */
  defaultExtractor?: ExtractorType | null;
  /** 将来源问答转换为新来源 */
  onConvertSourceQAToSource?: (sourceId: number, messages: QAMessage[]) => Promise<unknown>;
  /** 当前 notebook ID，用于深度研究功能 */
  notebookId?: number;
}

function SourcesPanel({
  sources,
  onSourceClick,
  onUpload,
  uploadState,
  searchState,
  searchNotice,
  searchResults,
  onSearch,
  onClearSearchResults,
  onAddSourceFromUrl,
  onRemoveSources,
  onRemoveSource,
  isDemo,
  isLoading,
  removeState,
  isFullscreen = false,
  searchQueue = [],
  onRemoveSearchQueueItem,
  onRemoveResultsFromQueue,
  availableExtractors = [],
  defaultExtractor = null,
  onConvertSourceQAToSource,
  notebookId,
}: SourcesPanelProps) {
  const uploadDisabled = isDemo || uploadState === 'loading';
  const isSearching = searchState === 'loading';
  const [searchQuery, setSearchQuery] = useState('');
  const [engine, setEngine] = useState('Web');
  const [mode, setMode] = useState('Fast Research');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<number, boolean>>({});
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add search results dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resultsToAdd, setResultsToAdd] = useState<SearchResultItem[]>([]);
  const [addMode, setAddMode] = useState<SourceFromUrlMode>('link');
  const [selectedExtractor, setSelectedExtractor] = useState<ExtractorType | undefined>(undefined);
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);

  // Deep Research state
  const [researchDetailOpen, setResearchDetailOpen] = useState(false);
  const [researchFullscreen, setResearchFullscreen] = useState(true); // Default fullscreen
  const research = useResearch(notebookId);

  // Fetch research sessions on mount
  useEffect(() => {
    if (notebookId) {
      research.fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  // Subscribe to SSE for active research session
  useEffect(() => {
    const sessionId = research.activeSession?.id;
    if (sessionId) {
      research.subscribeToSSE(sessionId);
      return () => research.unsubscribeFromSSE();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research.activeSession?.id]);

  const handleOpenDetail = useCallback((source: SourceItem) => {
    setSelectedSource(source);
    setDetailDialogOpen(true);
    // If panel is in fullscreen mode, open detail in fullscreen too
    setIsDetailFullscreen(isFullscreen);
  }, [isFullscreen]);

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
      // Convert ChatMessage to QAMessage format
      const qaMessages: QAMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await onConvertSourceQAToSource(selectedSource.id, qaMessages);
    },
    [selectedSource, onConvertSourceQAToSource],
  );

  const handleAddToSources = useCallback((selected: SearchResultItem[], mode: SourceFromUrlMode, extractor?: ExtractorType) => {
    setResultsToAdd(selected);
    setAddMode(mode);
    setSelectedExtractor(extractor);
    setAddDialogOpen(true);
  }, []);

  const handleAddSource = useCallback(
    async (result: SearchResultItem, mode: SourceFromUrlMode) => {
      await onAddSourceFromUrl(result.url, mode, {
        title: result.title,
        snippet: result.snippet ?? undefined,
        extractor: mode === 'fetch' ? selectedExtractor : undefined,
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

  useEffect(() => {
    if (!sources.length) {
      setSelectedSourceIds({});
      return;
    }
    // Default to all sources selected
    setSelectedSourceIds((prev) => {
      const next: Record<number, boolean> = {};
      const hasExistingSelection = Object.keys(prev).length > 0;
      sources.forEach((source) => {
        // If user has made selections before, preserve them; otherwise select all by default
        next[source.id] = hasExistingSelection ? Boolean(prev[source.id]) : true;
      });
      return next;
    });
  }, [sources]);

  const allSelected = useMemo(
    () => sources.length > 0 && sources.every((source) => selectedSourceIds[source.id]),
    [sources, selectedSourceIds],
  );
  const selectedIds = useMemo(
    () => sources.filter((source) => selectedSourceIds[source.id]).map((source) => source.id),
    [sources, selectedSourceIds],
  );
  const removeDisabled = isDemo || removeState === 'loading' || selectedIds.length === 0;

  function handleToggleAll() {
    if (allSelected) {
      setSelectedSourceIds({});
      return;
    }
    const next: Record<number, boolean> = {};
    sources.forEach((source) => {
      next[source.id] = true;
    });
    setSelectedSourceIds(next);
  }

  function handleToggleSource(id: number) {
    setSelectedSourceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  const handleSearch = async () => {
    // Deep Research mode
    if (mode === 'Deep Research') {
      if (isDemo) {
        toast.error('演示模式暂不支持深度研究');
        return;
      }
      if (!notebookId) {
        toast.error('请先创建笔记本');
        return;
      }
      if (!searchQuery.trim()) {
        toast.error('请输入研究主题');
        return;
      }

      try {
        const session = await research.createSession(searchQuery.trim());
        if (session) {
          // Start the research immediately
          // SSE subscription is handled by useEffect when activeSession changes
          await research.startResearch(session.id);
          setSearchQuery('');
          toast.success('深度研究已启动');
        }
      } catch (error) {
        toast.error('创建研究失败');
      }
      return;
    }

    // Fast Research mode - use existing search
    onSearch({ query: searchQuery, engine, mode });
  };

  // Handle research session click
  const handleResearchClick = useCallback((sessionId: number) => {
    research.fetchSession(sessionId);
    setResearchDetailOpen(true);
  }, [research]);

  // Handle research actions
  const handleResearchStart = useCallback(async (sessionId: number) => {
    // SSE subscription is handled by useEffect when activeSession changes
    await research.startResearch(sessionId);
  }, [research]);

  const handleResearchDelete = useCallback(async (sessionId: number) => {
    if (window.confirm('确定要删除这个研究会话吗？')) {
      await research.deleteSession(sessionId);
    }
  }, [research]);

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

  const handleCloseResearchDetail = useCallback(() => {
    setResearchDetailOpen(false);
    // Refresh the session to get latest state
    if (research.activeSession?.id) {
      research.fetchSession(research.activeSession.id);
    }
  }, [research]);

  const getEngineIcon = () => {
    switch (engine) {
      case 'Scholar':
        return <ScholarIcon style={{ fontSize: 16 }} />;
      case 'Docs':
        return <ArticleIcon style={{ fontSize: 16 }} />;
      default:
        return <LanguageIcon style={{ fontSize: 16 }} />;
    }
  };

  const getModeIcon = () => {
    return mode === 'Deep Research' ? (
      <PsychologyIcon style={{ fontSize: 16 }} />
    ) : (
      <SpeedIcon style={{ fontSize: 16 }} />
    );
  };

  return (
    <div className={`flex flex-1 flex-col gap-3 p-3 sm:p-4 min-h-0 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : ''}`}>
      {/* Upload Button */}
      <Tooltip content="支持文本(.txt)和Markdown(.md)文件">
        <Button
          variant="outlined"
          fullWidth
          size="sm"
          disabled={uploadDisabled}
          className="flex items-center justify-center gap-2 py-2 rounded-full border-dashed border-gray-400 normal-case font-normal text-gray-700 hover:bg-gray-100 hover:border-gray-500"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadState === 'loading' ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <CloudUploadIcon style={{ fontSize: 18 }} />
          )}
          {uploadState === 'loading' ? '上传中…' : '添加来源'}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
            disabled={uploadDisabled}
          />
        </Button>
      </Tooltip>

      {/* Search Section */}
      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
        <div className="p-2">
          <div className="relative flex w-full">
            <div className="absolute top-2/4 left-3 -translate-y-2/4 text-gray-500">
               <SearchIcon style={{ fontSize: 20 }} />
            </div>
            <input
              className="w-full h-9 pl-10 pr-10 rounded-lg bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-500 focus:ring-0"
              placeholder="在网络中搜索新来源"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <div className="absolute top-2/4 right-1 -translate-y-2/4">
               <IconButton
                 size="sm"
                 className="rounded-full w-7 h-7 bg-blue-500 hover:bg-blue-600"
                 onClick={handleSearch}
               >
                 <ArrowForwardIcon style={{ fontSize: 16 }} />
               </IconButton>
            </div>
          </div>
        </div>

        {/* Search Options */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-t border-gray-200">
          {/* Engine Select */}
          <Menu placement="bottom-start">
            <MenuHandler>
              <Button
                variant="outlined"
                size="sm"
                className="flex items-center gap-1.5 px-2 py-1 h-6 rounded border-gray-300 bg-white text-gray-800 normal-case font-normal text-[11px] hover:bg-gray-100"
              >
                {getEngineIcon()}
                {engine}
                <ExpandMoreIcon style={{ fontSize: 12 }} />
              </Button>
            </MenuHandler>
            <MenuList className="min-w-[100px] p-1">
              {['Web', 'Scholar', 'Docs'].map((opt) => (
                <MenuItem
                  key={opt}
                  className={`py-1.5 px-3 text-xs ${engine === opt ? 'bg-gray-100 font-medium' : ''}`}
                  onClick={() => setEngine(opt)}
                >
                  {opt}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>

          {/* Mode Select */}
          <Menu placement="bottom-start">
            <MenuHandler>
              <Button
                variant="outlined"
                size="sm"
                className="flex items-center gap-1.5 px-2 py-1 h-6 rounded border-gray-300 bg-white text-gray-800 normal-case font-normal text-[11px] hover:bg-gray-100"
              >
                {getModeIcon()}
                {mode}
                <ExpandMoreIcon style={{ fontSize: 12 }} />
              </Button>
            </MenuHandler>
            <MenuList className="min-w-[120px] p-1">
              {['Fast Research', 'Deep Research'].map((opt) => (
                <MenuItem
                  key={opt}
                  className={`py-1.5 px-3 text-xs ${mode === opt ? 'bg-gray-100 font-medium' : ''}`}
                  onClick={() => setMode(opt)}
                >
                  {opt}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        </div>
      </div>

      {/* Search Status - only show loading state */}
      {isSearching && (
        <Typography variant="small" className="text-[11px] text-gray-600 font-medium px-1">
          搜索中…
        </Typography>
      )}

      {/* Deep Research Sessions */}
      {research.sessions.length > 0 && (
        <div className="flex flex-col gap-2">
          {research.sessions
            .filter((s) => ['planning', 'searching', 'analyzing', 'waiting_user'].includes(s.status))
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

      {/* Select All & Batch Actions */}
      <div className="flex items-center justify-between px-1">
        <Typography variant="small" className="text-[11px] text-gray-600 font-medium">
          选择所有来源
        </Typography>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={allSelected}
            onChange={handleToggleAll}
            containerProps={{ className: "p-1" }}
            className="h-4 w-4 rounded border-gray-300 bg-white checked:bg-gray-900 checked:border-gray-900"
            iconProps={{ className: "text-white" }}
          />
          <Menu placement="bottom-end">
             <MenuHandler>
               <IconButton
                 size="sm"
                 variant="outlined"
                 className="w-6 h-6 min-w-[24px] rounded border-gray-200"
                 disabled={removeDisabled}
               >
                 <MoreHorizIcon style={{ fontSize: 16 }} />
               </IconButton>
             </MenuHandler>
             <MenuList className="p-1 min-w-[160px]">
                <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 border-b border-gray-100 mb-1">
                  已选择 {selectedIds.length} 个来源
                </div>
                <MenuItem
                  onClick={async () => {
                    const label =
                      selectedIds.length === 1
                        ? '确定要移除已选的 1 个来源吗？'
                        : `确定要移除已选的 ${selectedIds.length} 个来源吗？`;
                    if (!window.confirm(label)) return;
                    const success = await onRemoveSources(selectedIds);
                    if (success) {
                      setSelectedSourceIds({});
                    }
                  }}
                  className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                >
                  <DeleteIcon style={{ fontSize: 16 }} />
                  <span>删除已选来源</span>
                </MenuItem>
             </MenuList>
          </Menu>
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            <div className="h-10 w-2/3 rounded-lg bg-gray-100 animate-pulse" />
          </div>
        ) : sources.length === 0 ? (
          <div className="p-3 text-center border border-dashed border-gray-300 rounded-lg bg-gray-100">
            <Typography variant="small" className="text-gray-600 text-[11px] font-medium">
              暂无来源。添加文档后这里会展示来源列表。
            </Typography>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sources.map((source) => (
               <div
                 key={source.id}
                 className="group relative flex items-center rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow"
               >
                  <button
                    className="flex flex-1 items-center gap-3 p-2 text-left min-w-0"
                    onClick={() => handleOpenDetail(source)}
                  >
                     <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex-shrink-0">
                        <DescriptionIcon style={{ fontSize: 18 }} />
                     </div>
                     <Typography
                       variant="small"
                       className="font-semibold text-gray-900 text-xs truncate"
                     >
                        {source.title}
                     </Typography>
                  </button>

                  <div className="flex items-center gap-1 pr-2">
                     <Menu placement="bottom-end">
                        <MenuHandler>
                           <IconButton
                              size="sm"
                              variant="text"
                              className="w-6 h-6 min-w-[24px] rounded-full text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-200"
                              onClick={(e) => {
                                 e.stopPropagation(); // Stop propagation to avoid clicking the item
                                 setActiveSourceId(source.id);
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
                           <MenuItem
                              onClick={async () => {
                                 if (isDemo || removeState === 'loading') return;
                                 if (!window.confirm(`确定要删除「${source.title}」吗？此操作不可撤销。`)) return;
                                 await onRemoveSource(source.id);
                              }}
                              disabled={isDemo || removeState === 'loading'}
                              className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                           >
                              <DeleteIcon style={{ fontSize: 16 }} />
                              <span>{removeState === 'loading' ? '删除中…' : '删除来源'}</span>
                           </MenuItem>
                        </MenuList>
                     </Menu>

                     <Checkbox
                       checked={Boolean(selectedSourceIds[source.id])}
                       onChange={() => handleToggleSource(source.id)}
                       containerProps={{ className: "p-1" }}
                       className="h-4 w-4 rounded border-gray-300 bg-white checked:bg-gray-900 checked:border-gray-900"
                       iconProps={{ className: "text-white" }}
                     />
                  </div>
               </div>
            ))}
          </div>
        )}
      </div>

      {/* Source Detail Dialog */}
      <SourceDetailDialog
        open={detailDialogOpen}
        source={selectedSource}
        onClose={handleCloseDetail}
        isFullscreen={isDetailFullscreen}
        onToggleFullscreen={handleToggleDetailFullscreen}
        onSaveQAAsSource={onConvertSourceQAToSource ? handleSaveQAAsSource : undefined}
      />

      {/* Add Search Results Dialog */}
      <AddSearchResultDialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        results={resultsToAdd}
        mode={addMode}
        onAddSource={handleAddSource}
        onComplete={handleAddComplete}
      />

      {/* Research Detail Panel - Modal Overlay */}
      {researchDetailOpen && research.activeSession && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseResearchDetail();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseResearchDetail();
          }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 transition-all ${
              researchFullscreen
                ? 'w-full max-w-5xl'
                : 'w-full max-w-lg'
            }`}
          >
            <ResearchDetailPanel
              session={research.activeSession}
              sseEvents={research.sseEvents}
              onClose={handleCloseResearchDetail}
              onApprove={handleResearchApprove}
              onSkip={handleResearchSkip}
              onFinish={handleResearchFinish}
              onStart={() => handleResearchStart(research.activeSession!.id)}
              isFullscreen={researchFullscreen}
              onToggleFullscreen={() => setResearchFullscreen(!researchFullscreen)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SourcesPanel);
