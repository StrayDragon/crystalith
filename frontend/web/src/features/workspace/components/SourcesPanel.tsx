import { useEffect, useMemo, useState } from 'react';

import type { AsyncStatus } from '../../../shared/types';
import type { ApiSourceSearchResult, SourceItem } from '../types';

interface SourcesPanelProps {
  sources: SourceItem[];
  onSourceClick: (source: SourceItem) => void;
  onUpload: (file: File | null) => void;
  uploadState: AsyncStatus;
  searchState: AsyncStatus;
  searchNotice: string;
  searchResults: ApiSourceSearchResult[];
  onSearch: (payload: { query: string; engine: string; mode: string }) => void;
  isDemo: boolean;
  error: string;
  isLoading: boolean;
  onRetry: () => void;
}

export default function SourcesPanel({
  sources,
  onSourceClick,
  onUpload,
  uploadState,
  searchState,
  searchNotice,
  searchResults,
  onSearch,
  isDemo,
  error,
  isLoading,
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

  return (
    <div className="WorkspacePanelBody SourcesPanel">
      <label
        className="SourcesAddButton"
        data-disabled={uploadDisabled ? 'true' : 'false'}
        aria-disabled={uploadDisabled}
      >
        <span className="SourcesAddButton__icon" aria-hidden="true">
          +
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
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M11 5a6 6 0 1 0 3.9 10.6l3 3 1.4-1.4-3-3A6 6 0 0 0 11 5Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
              fill="currentColor"
            />
          </svg>
        </span>
        试用 Deep Research，获取深度报告和新来源！
      </div>

      <div className="SourcesSearchRow">
        <div className="SourcesSearchInput">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M11 5a6 6 0 1 0 3.9 10.6l3 3 1.4-1.4-3-3A6 6 0 0 0 11 5Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
              fill="currentColor"
            />
          </svg>
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
        <button
          type="button"
          className="SourcesSearchButton"
          aria-label="开始搜索"
          onClick={handleSearch}
          disabled={isSearching}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M8 12h8m0 0-3-3m3 3-3 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
        <span>选择所有来源</span>
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
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M7 5h7l3 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                      />
                      <path d="M14 5v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </svg>
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
