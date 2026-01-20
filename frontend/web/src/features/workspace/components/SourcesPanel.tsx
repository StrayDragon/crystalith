import { memo, useEffect, useMemo, useState } from 'react';

import type { AsyncStatus } from '../../../shared/types';
import type { ApiSourceSearchResult, SourceItem } from '../types';
import { IconDeepResearch, IconPlus, IconRemove, IconSearch, IconSpinner } from './Icons';

interface SourcesPanelProps {
  sources: SourceItem[];
  onSourceClick: (source: SourceItem) => void;
  onUpload: (file: File | null) => void;
  uploadState: AsyncStatus;
  searchState: AsyncStatus;
  searchNotice: string;
  searchResults: ApiSourceSearchResult[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  onRemoveSources: (sourceIds: number[]) => Promise<boolean>;
  isDemo: boolean;
  error: string;
  isLoading: boolean;
  removeState: AsyncStatus;
  onRetry: () => void;
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
  onRemoveSources,
  isDemo,
  error,
  isLoading,
  removeState,
  onRetry,
}: SourcesPanelProps) {
  const uploadDisabled = isDemo || uploadState === 'loading';
  const isSearching = searchState === 'loading';
  const [searchQuery, setSearchQuery] = useState('');
  const [engine, setEngine] = useState('Web');
  const [mode, setMode] = useState('Fast Research');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!sources.length) {
      setSelectedSourceIds({});
      return;
    }
    setSelectedSourceIds((prev) => {
      const next: Record<number, boolean> = {};
      sources.forEach((source) => {
        if (prev[source.id]) {
          next[source.id] = true;
        }
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

  const handleRemoveSelected = async () => {
    if (removeDisabled) return;
    const label =
      selectedIds.length === 1
        ? '移除已选的 1 个来源？'
        : `移除已选的 ${selectedIds.length} 个来源？`;
    if (!window.confirm(label)) return;
    const success = await onRemoveSources(selectedIds);
    if (success) {
      setSelectedSourceIds({});
    }
  };

  return (
    <div className="WorkspacePanelBody SourcesPanel">
      <label
        className="SourcesAddButton"
        data-disabled={uploadDisabled ? 'true' : 'false'}
        aria-disabled={uploadDisabled}
      >
        <span className="SourcesAddButton__icon" aria-hidden="true">
          <IconPlus />
        </span>
        {uploadState === 'loading' ? '上传中…' : '添加来源'}
        <input
          type="file"
          name="sourceFile"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
          disabled={uploadDisabled}
        />
      </label>

      <div className="SourcesDeepResearch">
        <span className="SourcesDeepResearchIcon" aria-hidden="true">
          <IconDeepResearch />
        </span>
        试用 Deep Research，获取深度报告和新来源！
      </div>

      <div className="SourcesSearchRow">
        <div className="SourcesSearchInput">
          <IconDeepResearch aria-hidden="true" focusable="false" />
          <input
            type="text"
            name="sourceSearch"
            placeholder="在网络中搜索新来源"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="搜索来源"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              handleSearch();
            }}
          />
          <button
            type="button"
            className="SourcesSearchButton"
            aria-label="开始搜索"
            onClick={handleSearch}
            disabled={isSearching}
          >
            <IconSearch />
          </button>
        </div>
        <select
          className="SourcesSearchSelect"
          value={engine}
          onChange={(event) => setEngine(event.target.value)}
          aria-label="搜索引擎"
        >
          <option>Web</option>
          <option>Scholar</option>
          <option>Docs</option>
        </select>
        <select
          className="SourcesSearchSelect"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          aria-label="检索模式"
        >
          <option>Fast Research</option>
          <option>Deep Research</option>
        </select>
      </div>

      {isSearching ? (
        <div className="SourcesSearchHint">搜索中…</div>
      ) : searchNotice ? (
        <div className="SourcesSearchHint">{searchNotice}</div>
      ) : null}

      {searchResults.length > 0 ? (
        <div className="SourcesSearchResults">
          <div className="SourcesSearchResultsHeader">
            <span>搜索结果</span>
            <span>{searchResults.length} 条</span>
          </div>
          <ul className="SourcesSearchResultList" role="list">
            {searchResults.map((item) => (
              <li key={`${item.title}-${item.url}`} className="SourcesSearchResultItem">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="SourcesSearchResultLink"
                >
                  <div className="SourcesSearchResultTitle">{item.title}</div>
                  {item.snippet ? (
                    <div className="SourcesSearchResultSnippet">{item.snippet}</div>
                  ) : null}
                  <div className="SourcesSearchResultMeta">
                    {item.source ? item.source : '来源推荐'}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="SourcesSelectAll">
        <div className="SourcesSelectAllLeft">
          <button
            type="button"
            className="SourcesActionButton"
            aria-label="移除已选来源"
            onClick={handleRemoveSelected}
            disabled={removeDisabled}
            title={removeDisabled ? '请选择来源后再操作' : '移除已选来源'}
          >
            <IconRemove />
          </button>
          <span>选择所有来源</span>
        </div>
        <input
          type="checkbox"
          className="SourcesCheckbox"
          checked={allSelected}
          onChange={handleToggleAll}
          aria-label="选择所有来源"
        />
      </div>

      <div className="SourcesListWrap">
        {isLoading ? (
          <div className="SourcesSkeletonList" aria-label="加载来源">
            <div className="SourcesSkeletonItem" />
            <div className="SourcesSkeletonItem" />
            <div className="SourcesSkeletonItem isShort" />
          </div>
        ) : sources.length === 0 ? (
          <div className="SourcesEmpty">暂无来源。添加文档后这里会展示来源列表。</div>
        ) : (
          <ul className="SourcesList">
            {sources.map((source) => (
              <li key={source.id} className="SourcesListItem">
                <button
                  type="button"
                  className="SourcesListButton"
                  onClick={() => onSourceClick(source)}
                >
                  <span className="SourcesItemIcon" aria-hidden="true">
                    <IconSearch focusable="false" />
                  </span>
                  <span className="SourcesItemText">
                    <span className="SourcesItemTitle">{source.title}</span>
                  </span>
                </button>
                <input
                  type="checkbox"
                  className="SourcesCheckbox"
                  checked={Boolean(selectedSourceIds[source.id])}
                  onChange={() => handleToggleSource(source.id)}
                  aria-label={`选择来源：${source.title}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <div className="WorkspaceHint isError">
          {error}
          <button type="button" className="WorkspaceLinkButton" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default memo(SourcesPanel);
