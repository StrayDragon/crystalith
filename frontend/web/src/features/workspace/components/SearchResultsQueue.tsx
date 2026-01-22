import { useState, useCallback, useMemo } from 'react';
import { Button, Checkbox, Typography, Chip, Dialog, DialogHeader, DialogBody, IconButton, Tooltip } from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  OpenInFull as OpenInFullIcon,
  Link as LinkIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';

import SearchResultCard, { type SearchResultItem } from './SearchResultCard';

interface SearchResultsQueueProps {
  results: SearchResultItem[];
  searchSummary?: string;
  onClear: () => void;
  onAddToSources: (selected: SearchResultItem[], mode: 'fetch' | 'link') => void;
  isAdding?: boolean;
}

export default function SearchResultsQueue({
  results,
  searchSummary,
  onClear,
  onAddToSources,
  isAdding = false,
}: SearchResultsQueueProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedResult, setExpandedResult] = useState<SearchResultItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedResults = useMemo(
    () => results.filter((r) => selectedUrls.has(r.url)),
    [results, selectedUrls],
  );

  const allSelected = results.length > 0 && selectedUrls.size === results.length;

  const handleToggle = useCallback((result: SearchResultItem) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(result.url)) {
        next.delete(result.url);
      } else {
        next.add(result.url);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(results.map((r) => r.url)));
    }
  }, [allSelected, results]);

  const handleAddAsLink = useCallback(() => {
    if (selectedResults.length > 0) {
      onAddToSources(selectedResults, 'link');
    }
  }, [selectedResults, onAddToSources]);

  const handleAddWithFetch = useCallback(() => {
    if (selectedResults.length > 0) {
      onAddToSources(selectedResults, 'fetch');
    }
  }, [selectedResults, onAddToSources]);

  const handleClear = useCallback(() => {
    setSelectedUrls(new Set());
    onClear();
  }, [onClear]);

  const handleExpand = useCallback((result: SearchResultItem) => {
    setExpandedResult(result);
  }, []);

  const handleAddSingleAsLink = useCallback((result: SearchResultItem) => {
    onAddToSources([result], 'link');
  }, [onAddToSources]);

  const handleAddSingleWithFetch = useCallback((result: SearchResultItem) => {
    onAddToSources([result], 'fetch');
  }, [onAddToSources]);

  if (results.length === 0) {
    return null;
  }

  return (
    <>
      {/* Compact Queue - like Studio notes */}
      <div className="border border-blue-200 rounded-xl shadow-sm bg-blue-50/50 overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-100 border border-blue-200">
              <SearchIcon style={{ fontSize: 12 }} className="text-blue-600" />
            </div>
            <Typography variant="small" className="font-semibold text-blue-900 text-xs">
              搜索结果
            </Typography>
            <Chip
              value={`${results.length} 条`}
              size="sm"
              className="bg-blue-600 text-[10px] h-5 py-0 px-2"
            />
            {selectedUrls.size > 0 && (
              <Chip
                value={`已选 ${selectedUrls.size}`}
                size="sm"
                className="bg-gray-900 text-[10px] h-5 py-0 px-2"
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(true);
              }}
              className="p-1 rounded-lg hover:bg-blue-200 transition-colors"
              title="全屏查看"
            >
              <OpenInFullIcon style={{ fontSize: 14 }} className="text-blue-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 rounded-lg hover:bg-blue-200 transition-colors"
              title="清空搜索结果"
            >
              <CloseIcon style={{ fontSize: 14 }} className="text-blue-600" />
            </button>
            {isExpanded ? (
              <ExpandLessIcon style={{ fontSize: 18 }} className="text-blue-600" />
            ) : (
              <ExpandMoreIcon style={{ fontSize: 18 }} className="text-blue-600" />
            )}
          </div>
        </button>

        {/* Expandable Content */}
        {isExpanded && (
          <>
            {/* Results List - compact cards */}
            <div className="flex flex-col px-1.5 pb-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
              {results.map((result) => (
                <SearchResultCard
                  key={result.url}
                  result={result}
                  isSelected={selectedUrls.has(result.url)}
                  onToggle={handleToggle}
                  onExpand={handleExpand}
                  onAddAsLink={handleAddSingleAsLink}
                  onAddWithFetch={handleAddSingleWithFetch}
                  compact
                />
              ))}
            </div>

            {/* Actions Footer - simplified */}
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-blue-200 bg-blue-100/50">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={allSelected}
                  onChange={handleToggleAll}
                  containerProps={{ className: 'p-0' }}
                  className="h-3.5 w-3.5 rounded border-gray-300 bg-white checked:bg-blue-600 checked:border-blue-600"
                  iconProps={{ className: 'text-white' }}
                />
                <Typography variant="small" className="text-[10px] text-blue-800 font-medium">
                  全选
                </Typography>
              </div>
              {selectedUrls.size > 0 && (
                <div className="flex items-center gap-1">
                  <Tooltip content="作为链接导入" placement="top" className="z-[10000]">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={handleAddAsLink}
                      disabled={isAdding}
                      className="w-6 h-6 min-w-[24px] border-blue-300 text-blue-700 bg-white"
                    >
                      <LinkIcon style={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="作为全文导入" placement="top" className="z-[10000]">
                    <IconButton
                      size="sm"
                      onClick={handleAddWithFetch}
                      disabled={isAdding}
                      className="w-6 h-6 min-w-[24px] bg-blue-600 text-white"
                    >
                      <DownloadIcon style={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Expanded Result Dialog */}
      <Dialog
        open={expandedResult !== null}
        handler={() => setExpandedResult(null)}
        size="md"
        className="rounded-xl"
      >
        {expandedResult && (
          <>
            <DialogHeader className="flex items-start gap-3 pb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex-shrink-0">
                <SearchIcon className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <Typography variant="h6" className="text-gray-900 leading-snug">
                  {expandedResult.title}
                </Typography>
                <Typography variant="small" className="text-gray-500 text-xs mt-0.5">
                  {(() => {
                    try {
                      return new URL(expandedResult.url).hostname;
                    } catch {
                      return expandedResult.url;
                    }
                  })()}
                  {expandedResult.source && ` · ${expandedResult.source}`}
                </Typography>
              </div>
              <IconButton
                variant="text"
                size="sm"
                onClick={() => setExpandedResult(null)}
                className="flex-shrink-0"
              >
                <CloseIcon />
              </IconButton>
            </DialogHeader>
            <DialogBody className="pt-0">
              {expandedResult.snippet && (
                <Typography className="text-gray-700 text-sm leading-relaxed mb-4">
                  {expandedResult.snippet}
                </Typography>
              )}
              <Typography variant="small" className="text-gray-500 text-xs mb-4">
                链接：
                <a
                  href={expandedResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  {expandedResult.url}
                </a>
              </Typography>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => {
                    handleAddSingleAsLink(expandedResult);
                    setExpandedResult(null);
                  }}
                  disabled={isAdding}
                  className="flex items-center gap-1.5 normal-case"
                >
                  <AddIcon style={{ fontSize: 16 }} />
                  作为链接导入
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleAddSingleWithFetch(expandedResult);
                    setExpandedResult(null);
                  }}
                  disabled={isAdding}
                  className="flex items-center gap-1.5 normal-case bg-gray-900"
                >
                  <AddIcon style={{ fontSize: 16 }} />
                  作为全文导入
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => window.open(expandedResult.url, '_blank')}
                  className="ml-auto normal-case text-gray-700"
                >
                  打开原链接
                </Button>
              </div>
            </DialogBody>
          </>
        )}
      </Dialog>

      {/* Fullscreen Dialog - All Results */}
      <Dialog
        open={isFullscreen}
        handler={() => setIsFullscreen(false)}
        size="xl"
        className="rounded-xl max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="flex items-center justify-between border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 border border-blue-200">
              <SearchIcon className="text-blue-600" style={{ fontSize: 24 }} />
            </div>
            <div>
              <Typography variant="h5" className="text-gray-900">
                搜索结果
              </Typography>
              <Typography variant="small" className="text-gray-500">
                共 {results.length} 条结果 · 已选择 {selectedUrls.size} 条
              </Typography>
            </div>
          </div>
          <IconButton
            variant="text"
            onClick={() => setIsFullscreen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogHeader>
        <DialogBody className="flex-1 overflow-y-auto p-4">
          {/* Search Summary */}
          {searchSummary && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Typography variant="small" className="text-gray-600 text-xs leading-relaxed">
                {searchSummary}
              </Typography>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {results.map((result) => {
              const hostname = (() => {
                try { return new URL(result.url).hostname; } catch { return result.url; }
              })();
              const isSelected = selectedUrls.has(result.url);

              return (
                <div
                  key={result.url}
                  className={`
                    flex gap-3 p-4 rounded-xl border transition-all
                    ${isSelected
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }
                  `}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggle(result)}
                    containerProps={{ className: 'p-0 mt-1' }}
                    className="h-5 w-5 rounded border-gray-300 bg-white checked:bg-blue-600 checked:border-blue-600"
                    iconProps={{ className: 'text-white' }}
                  />
                  <div className="flex-1 min-w-0">
                    <Typography variant="h6" className="text-gray-900 text-sm font-semibold line-clamp-2 mb-1">
                      {result.title}
                    </Typography>
                    {result.snippet && (
                      <Typography variant="small" className="text-gray-600 text-xs line-clamp-3 mb-2">
                        {result.snippet}
                      </Typography>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Typography variant="small" className="text-gray-400 text-[10px]">
                        {hostname}
                      </Typography>
                      {result.source && (
                        <Chip value={result.source} size="sm" className="bg-gray-200 text-gray-600 text-[9px] h-4 py-0 px-1.5" />
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Tooltip content="仅保存标题、摘要和链接作为来源引用" placement="top" className="z-[10000]">
                        <Button
                          size="sm"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSingleAsLink(result);
                          }}
                          disabled={isAdding}
                          className="flex items-center gap-1 py-1 px-2 text-[10px] font-semibold normal-case border-gray-300 text-gray-700"
                        >
                          <LinkIcon style={{ fontSize: 14 }} />
                          作为链接导入
                        </Button>
                      </Tooltip>
                      <Tooltip content="抓取网页完整内容导入为来源" placement="top" className="z-[10000]">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSingleWithFetch(result);
                          }}
                          disabled={isAdding}
                          className="flex items-center gap-1 py-1 px-2 text-[10px] font-semibold normal-case bg-blue-600"
                        >
                          <DownloadIcon style={{ fontSize: 14 }} />
                          作为全文导入
                        </Button>
                      </Tooltip>
                      <Tooltip content="在新窗口中打开原网页" placement="top" className="z-[10000]">
                        <Button
                          size="sm"
                          variant="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(result.url, '_blank');
                          }}
                          className="flex items-center gap-1 py-1 px-2 text-[10px] font-semibold normal-case text-gray-600"
                        >
                          <OpenInNewIcon style={{ fontSize: 14 }} />
                          预览
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogBody>
        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              onChange={handleToggleAll}
              containerProps={{ className: 'p-0' }}
              className="h-5 w-5 rounded border-gray-300 bg-white checked:bg-gray-900 checked:border-gray-900"
              iconProps={{ className: 'text-white' }}
            />
            <Typography className="text-gray-700 text-sm font-medium">
              全选 ({results.length})
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outlined"
              onClick={() => setIsFullscreen(false)}
              className="normal-case"
            >
              取消
            </Button>
            {selectedUrls.size > 0 && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => {
                    handleAddAsLink();
                    setIsFullscreen(false);
                  }}
                  disabled={isAdding}
                  className="flex items-center gap-2 normal-case border-blue-300 text-blue-700"
                >
                  <AddIcon style={{ fontSize: 18 }} />
                  作为链接导入 ({selectedUrls.size})
                </Button>
                <Button
                  onClick={() => {
                    handleAddWithFetch();
                    setIsFullscreen(false);
                  }}
                  disabled={isAdding}
                  className="flex items-center gap-2 normal-case bg-blue-600"
                >
                  <AddIcon style={{ fontSize: 18 }} />
                  作为全文导入 ({selectedUrls.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
