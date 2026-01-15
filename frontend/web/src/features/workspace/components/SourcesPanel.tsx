import type { RefObject } from 'react';

import type { AsyncStatus } from '../../../shared/types';
import type { Citation, SourceItem } from '../types';

interface SourcesPanelProps {
  sources: SourceItem[];
  citations: Citation[];
  selectedCitationIds: Record<string, boolean>;
  autoSelectCitations: boolean;
  onToggleCitation: (citationId: string) => void;
  onSelectAllCitations: () => void;
  onClearCitationSelection: () => void;
  onToggleAutoSelectCitations: () => void;
  onSourceClick: (source: SourceItem) => void;
  onSendSelectedCitations: () => void;
  onCompareSelectedCitations: () => void;
  onCitationHover: (chunkId: number | null) => void;
  onUpload: (file: File | null) => void;
  uploadState: AsyncStatus;
  isDemo: boolean;
  error: string;
  showCreate: boolean;
  createName: string;
  onCreateNameChange: (value: string) => void;
  onCreate: () => void;
  createState: AsyncStatus;
  createError: string;
  createInputRef: RefObject<HTMLInputElement>;
}

export default function SourcesPanel({
  sources,
  citations,
  selectedCitationIds,
  autoSelectCitations,
  onToggleCitation,
  onSelectAllCitations,
  onClearCitationSelection,
  onToggleAutoSelectCitations,
  onSourceClick,
  onSendSelectedCitations,
  onCompareSelectedCitations,
  onCitationHover,
  onUpload,
  uploadState,
  isDemo,
  error,
  showCreate,
  createName,
  onCreateNameChange,
  onCreate,
  createState,
  createError,
  createInputRef,
}: SourcesPanelProps) {
  const uploadDisabled = isDemo || showCreate;
  const selectedCount = citations.reduce(
    (count, citation) => count + (selectedCitationIds[citation.id] ? 1 : 0),
    0,
  );
  const hasSelection = selectedCount > 0;

  return (
    <div className="WorkspacePanelBody">
      {showCreate ? (
        <section className="WorkspaceSection">
          <div className="CreateCard">
            <div>
              <div className="CreateTitle">创建笔记本</div>
              <div className="CreateHint">先创建一个笔记本再上传来源</div>
            </div>
            <div className="CreateActions">
              <input
                className="CreateInput"
                ref={createInputRef}
                name="notebookName"
                aria-label="笔记本名称"
                value={createName}
                onChange={(event) => onCreateNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  if (event.isComposing) return;
                  event.preventDefault();
                  onCreate();
                }}
                placeholder="输入笔记本名称"
                disabled={isDemo || createState === 'loading'}
              />
              <button
                type="button"
                className="CreateButton"
                onClick={onCreate}
                disabled={
                  isDemo || createState === 'loading' || createName.trim().length === 0
                }
              >
                {createState === 'loading' ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
          {isDemo ? <div className="WorkspaceTiny">演示模式无法创建笔记本。</div> : null}
          {createError ? <div className="WorkspaceHint isError">{createError}</div> : null}
        </section>
      ) : null}

      <section className="WorkspaceSection">
        <div className="UploadCard">
          <div>
            <div className="UploadTitle">上传文档</div>
            <div className="UploadHint">
              {showCreate ? '请先创建笔记本' : '仅支持 txt / markdown'}
            </div>
          </div>
          <label className="UploadButton">
            {uploadState === 'loading' ? '上传中…' : '选择文件'}
            <input
              type="file"
              name="sourceFile"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
              disabled={uploadDisabled || uploadState === 'loading'}
            />
          </label>
        </div>
        {isDemo ? <div className="WorkspaceTiny">当前为演示数据，上传已禁用。</div> : null}
        {error ? <div className="WorkspaceHint isError">{error}</div> : null}
      </section>

      <section className="WorkspaceSection">
        <h3 className="WorkspaceSectionTitle">来源</h3>
        {sources.length === 0 ? (
          <div className="WorkspaceEmpty">暂无来源。上传文档后会自动索引。</div>
        ) : (
          <ul className="WorkspaceList">
            {sources.map((source) => (
              <li
                key={source.id}
                className={`WorkspaceListItem ${
                  source.statusTone === 'FAILED' ? 'isFailed' : ''
                }`}
              >
                <button
                  type="button"
                  className="SourceItemButton"
                  onClick={() => onSourceClick(source)}
                  disabled={showCreate}
                >
                  <div className="WorkspaceListItem__main">
                    <div className="WorkspaceListItem__title">{source.title}</div>
                    <div className="WorkspaceListItem__sub">
                      {source.type} · {source.status}
                    </div>
                  </div>
                  {source.statusTone === 'FAILED' ? (
                    <span className="SourceRetry" title="上传失败，请重新上传">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                        className="SourceRetry__icon"
                      >
                        <path
                          d="M6 8a7 7 0 0 1 11.95-4.95l1.05-1.05V6h-4l1.83-1.83A5 5 0 1 0 17 12h2A7 7 0 0 1 6 8Z"
                          fill="currentColor"
                        />
                        <path
                          d="M18 16a7 7 0 0 1-11.95 4.95L5 22v-4h4l-1.83 1.83A5 5 0 1 0 7 12H5a7 7 0 0 1 13 4Z"
                          fill="currentColor"
                        />
                      </svg>
                      重试
                    </span>
                  ) : null}
                </button>
                <div className={`WorkspaceBadge ${source.statusTone}`}>{source.chunks} 段</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="WorkspaceSection">
        <div className="WorkspaceSectionHeader">
          <h3 className="WorkspaceSectionTitle">引用</h3>
          {citations.length ? (
            <div className="WorkspaceSectionActions">
              <span className="WorkspaceTiny">
                已选 {selectedCount}/{citations.length}
              </span>
              <button
                type="button"
                className={`WorkspaceToggle ${autoSelectCitations ? 'isActive' : ''}`}
                onClick={onToggleAutoSelectCitations}
                aria-pressed={autoSelectCitations}
                title="默认全选引用作为提炼输入"
              >
                引用模式
              </button>
              <button
                type="button"
                className="WorkspaceLinkButton"
                onClick={onSelectAllCitations}
              >
                全选
              </button>
              <button
                type="button"
                className="WorkspaceLinkButton"
                onClick={onClearCitationSelection}
                disabled={selectedCount === 0}
              >
                清空
              </button>
            </div>
          ) : null}
        </div>
        {citations.length === 0 ? (
          <div className="WorkspaceEmpty">
            暂无引用。发送一次消息后这里会展示引用片段（可勾选作为提炼输入）。
          </div>
        ) : (
          <>
            <ul className="WorkspaceList">
              {citations.map((citation) => (
                <li
                  key={citation.id}
                  className="WorkspaceListItem WorkspaceListItem--compact"
                  onMouseEnter={() => onCitationHover(citation.chunkId)}
                  onMouseLeave={() => onCitationHover(null)}
                >
                  <input
                    type="checkbox"
                    className="WorkspaceCheckbox"
                    checked={Boolean(selectedCitationIds[citation.id])}
                    onChange={() => onToggleCitation(citation.id)}
                    aria-label={`选择引用：${citation.sourceTitle} #${citation.chunkIndex}`}
                  />
                  <div className="WorkspaceListItem__main">
                    <div className="WorkspaceListItem__title">{citation.sourceTitle}</div>
                    <div className="WorkspaceListItem__sub">{citation.snippet}</div>
                  </div>
                  <div className="WorkspaceBadge"># {citation.chunkIndex}</div>
                </li>
              ))}
            </ul>
            {hasSelection ? (
              <div className="CitationActionBar">
                <div className="CitationActionMeta">已选 {selectedCount} 条引用</div>
                <div className="CitationActionButtons">
                  <button
                    type="button"
                    className="ActionButton"
                    onClick={onSendSelectedCitations}
                  >
                    发送至右侧提炼
                  </button>
                  <button
                    type="button"
                    className="ActionButton isPrimary"
                    onClick={onCompareSelectedCitations}
                  >
                    生成对比分析
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
