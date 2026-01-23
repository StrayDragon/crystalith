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
} from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';
import type { SourceFromUrlMode } from '../../../api/client';
import type { ApiSourceSearchResult, SourceItem } from '../types';
import SourceDetailDialog from './SourceDetailDialog';
import SearchResultsQueue from './SearchResultsQueue';
import AddSearchResultDialog from './AddSearchResultDialog';
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
    options?: { title?: string; snippet?: string },
  ) => Promise<unknown>;
  onRemoveSources: (sourceIds: number[]) => Promise<boolean>;
  onRemoveSource: (sourceId: number) => Promise<boolean>;
  isDemo: boolean;
  isLoading: boolean;
  removeState: AsyncStatus;
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
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);

  const handleOpenDetail = useCallback((source: SourceItem) => {
    setSelectedSource(source);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailDialogOpen(false);
  }, []);

  const handleAddToSources = useCallback((selected: SearchResultItem[], mode: SourceFromUrlMode) => {
    setResultsToAdd(selected);
    setAddMode(mode);
    setAddDialogOpen(true);
  }, []);

  const handleAddSource = useCallback(
    async (result: SearchResultItem, mode: SourceFromUrlMode) => {
      await onAddSourceFromUrl(result.url, mode, {
        title: result.title,
        snippet: result.snippet ?? undefined,
      });
    },
    [onAddSourceFromUrl],
  );

  const handleAddComplete = useCallback(() => {
    setResultsToAdd([]);
    onClearSearchResults();
  }, [onClearSearchResults]);

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

  const handleSearch = () => {
    if (isSearching) return;
    onSearch({ query: searchQuery, engine, mode });
  };

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
    <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4 min-h-0">
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
                 disabled={isSearching}
               >
                 {isSearching ? <Spinner className="h-3 w-3" /> : <ArrowForwardIcon style={{ fontSize: 16 }} />}
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

      {/* Search Results Queue */}
      <SearchResultsQueue
        results={searchResults}
        searchSummary={searchNotice}
        onClear={onClearSearchResults}
        onAddToSources={handleAddToSources}
        isAdding={isAddingFromUrl}
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
    </div>
  );
}

export default memo(SourcesPanel);
