import { useEffect, useMemo, useRef, useState } from 'react';

import './workspace.css';
import {
  askQuestion,
  createNotebook,
  listNotebooks,
  listSources,
  refineBatch,
  uploadSource,
} from './api';

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildRefineOutput(text) {
  const normalized = text.trim();
  if (!normalized) return { paragraph: '', bullets: [], structured: null, evidence: false };

  const bullets = normalized
    .split(/[\n。；;]+/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    paragraph: `已生成提炼结果（演示）：${normalized}`,
    bullets: bullets.length > 0 ? bullets : [normalized],
    structured: {
      title: normalized.slice(0, 48),
      bullets: bullets.length > 0 ? bullets : [normalized],
      terms: ['演示数据'],
    },
    evidence: true,
  };
}

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function buildSourceSummaryPrompt(title) {
  const safeTitle = title?.trim() || '文档';
  return `请总结《${safeTitle}》的核心观点`;
}

function resolveTemplateLabel(prompt, templates) {
  const normalized = prompt.trim();
  const match = templates.find((item) => item.prompt.trim() === normalized);
  return match?.label ?? '自定义';
}

function buildJobTitle(label, createdAt) {
  const dateLabel = formatDate(createdAt);
  return `[${label}] ${dateLabel || '未命名日期'}`;
}

function formatOutputForCopy(output, mode) {
  if (!output) return '';
  if (mode === 'paragraph') return output.paragraph || '';
  if (mode === 'bullets') {
    return (output.bullets ?? []).map((item) => `- ${item}`).join('\n');
  }
  if (mode === 'structured') {
    const parts = [];
    if (output.structured?.title) parts.push(output.structured.title);
    if (output.structured?.bullets?.length) {
      parts.push(output.structured.bullets.map((item) => `- ${item}`).join('\n'));
    }
    if (output.structured?.terms?.length) {
      parts.push(`关键术语：${output.structured.terms.join('、')}`);
    }
    return parts.join('\n');
  }
  return '';
}

function normalizeNotebook(row) {
  return {
    id: Number(row.id),
    title: row.name ?? '未命名笔记本',
    updatedAt: formatTimestamp(row.updated_at),
  };
}

function formatSourceType(row) {
  const filename = row.filename ?? '';
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'markdown') return 'Markdown';
  if (extension === 'txt') return 'TXT';
  if (row.mime_type === 'text/markdown') return 'Markdown';
  if (row.mime_type === 'text/plain') return 'TXT';
  return row.mime_type || '未知';
}

function normalizeSource(row) {
  const statusKey = String(row.status ?? 'READY').toUpperCase();
  const statusLabel =
    {
      READY: '已索引',
      PROCESSING: '处理中',
      FAILED: '失败',
    }[statusKey] ?? row.status;

  return {
    id: Number(row.id),
    title: row.filename ?? '未命名文件',
    type: formatSourceType(row),
    status: statusLabel,
    statusTone: statusKey,
    chunks: row.chunk_count ?? 0,
  };
}

function normalizeCitation(row) {
  const chunkId = Number(row.chunk_id);
  return {
    id: `${row.chunk_id}`,
    chunkId: Number.isFinite(chunkId) ? chunkId : null,
    sourceTitle: row.source_name,
    snippet: row.snippet,
    chunkIndex: row.chunk_index,
    score: row.score,
  };
}

function collectChunkIds(citations) {
  return (citations ?? [])
    .map((citation) => citation.chunkId)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function WorkspaceHeader({ notebooks, activeNotebookId, onNotebookChange, statusLabel }) {
  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) ?? null;

  return (
    <header className="WorkspaceHeader">
      <div className="WorkspaceHeader__left">
        <div className="WorkspaceBrand">研究工作台</div>
        <div className="WorkspaceMeta">三栏：来源 / 聊天 / 输出中心</div>
      </div>

      <div className="WorkspaceHeader__center">
        <label className="WorkspaceLabel" htmlFor="notebookSelect">
          当前笔记本
        </label>
        <select
          id="notebookSelect"
          className="WorkspaceSelect"
          value={activeNotebookId ?? ''}
          onChange={(e) => onNotebookChange(Number(e.target.value))}
        >
          {notebooks.length === 0 ? <option value="">暂无笔记本</option> : null}
          {notebooks.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.title}
            </option>
          ))}
        </select>
      </div>

      <div className="WorkspaceHeader__right">
        <div className={`WorkspacePill ${statusLabel.tone}`} title={statusLabel.tooltip}>
          {statusLabel.text}
        </div>
        {activeNotebook?.updatedAt ? (
          <div className="WorkspaceTiny">更新于：{activeNotebook.updatedAt}</div>
        ) : null}
      </div>
    </header>
  );
}

function WorkspaceTabs({ activePanel, onChange }) {
  return (
    <nav className="WorkspaceTabs" aria-label="工作区面板切换">
      {[
        { id: 'sources', label: '来源与引用' },
      { id: 'chat', label: '聊天' },
      { id: 'refine', label: '输出中心' },
    ].map((item) => (
        <button
          key={item.id}
          type="button"
          className={`WorkspaceTab ${activePanel === item.id ? 'isActive' : ''}`}
          aria-current={activePanel === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function SourcesPanel({
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
}) {
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
              {citations.map((c) => (
                <li
                  key={c.id}
                  className="WorkspaceListItem WorkspaceListItem--compact"
                  onMouseEnter={() => onCitationHover(c.chunkId)}
                  onMouseLeave={() => onCitationHover(null)}
                >
                  <input
                    type="checkbox"
                    className="WorkspaceCheckbox"
                    checked={Boolean(selectedCitationIds[c.id])}
                    onChange={() => onToggleCitation(c.id)}
                    aria-label={`选择引用：${c.sourceTitle} #${c.chunkIndex}`}
                  />
                  <div className="WorkspaceListItem__main">
                    <div className="WorkspaceListItem__title">{c.sourceTitle}</div>
                    <div className="WorkspaceListItem__sub">{c.snippet}</div>
                  </div>
                  <div className="WorkspaceBadge"># {c.chunkIndex}</div>
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

function ChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending,
  notice,
  isBlocked,
  inputRef,
  highlightedChunkId,
}) {
  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatMessages" role="log" aria-label="聊天记录">
        {isBlocked ? (
          <div className="WorkspaceEmpty">请先创建笔记本，再开始对话。</div>
        ) : messages.length === 0 ? (
          <div className="WorkspaceEmpty">
            开始对话吧：输入问题或指令，中间显示聊天，右侧输出中心可手动触发提炼。
          </div>
        ) : null}
        {messages.map((message) => {
          const isHighlighted =
            highlightedChunkId &&
            message.citationChunkIds?.includes(highlightedChunkId);
          return (
          <div
            key={message.id}
            className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'} ${
              isHighlighted ? 'isHighlighted' : ''
            }`}
          >
            <div className="ChatMessage__meta">{message.role === 'user' ? '你' : '助手'}</div>
            <div className="ChatMessage__bubble">{message.content}</div>
          </div>
          );
        })}
        {notice ? <div className="ChatStatus">{notice}</div> : null}
      </div>

      <form
        className="ChatComposer"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <textarea
          className="ChatInput"
          name="chatPrompt"
          ref={inputRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={isSending || isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '在这里输入问题或指令…'}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (e.shiftKey) return;
            if (e.isComposing) return;
            e.preventDefault();
            onSend();
          }}
          rows={2}
        />
        <div className="ChatActions">
          <div className="WorkspaceTiny">Enter 发送 · Shift+Enter 换行</div>
          <button
            type="submit"
            className="PrimaryButton"
            disabled={draft.trim().length === 0 || isSending || isBlocked}
          >
            {isSending ? '检索中…' : '发送'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RefineTemplateItem({ item, isActive, isFavorite, onSelect, onToggleFavorite }) {
  return (
    <div className={`RefineTemplateItem ${isActive ? 'isActive' : ''}`}>
      <button
        type="button"
        className="RefineTemplateButton"
        aria-pressed={isActive}
        onClick={() => onSelect(item)}
      >
        {item.label}
      </button>
      <button
        type="button"
        className={`RefineTemplateStar ${isFavorite ? 'isActive' : ''}`}
        aria-label={isFavorite ? `取消收藏 ${item.label}` : `收藏 ${item.label}`}
        onClick={() => onToggleFavorite(item.id)}
      >
        {isFavorite ? '★' : '☆'}
      </button>
    </div>
  );
}

function RefineTemplateSection({
  title,
  items,
  activeTemplateId,
  favoriteSet,
  onSelect,
  onToggleFavorite,
}) {
  if (!items.length) return null;
  return (
    <div className="RefineTemplateGroup">
      <div className="RefineTemplateGroup__title">{title}</div>
      <div className="RefineTemplateList" role="list">
        {items.map((item) => (
          <RefineTemplateItem
            key={item.id}
            item={item}
            isActive={activeTemplateId === item.id}
            isFavorite={favoriteSet.has(item.id)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

function RefinePanel({
  mode,
  onModeChange,
  isBlocked,
  selectedCitationCount,
  prompt,
  onPromptChange,
  onGenerate,
  templates,
  jobs,
  onTogglePin,
  onDeleteJob,
  settings,
  onToggleSetting,
  highlightedJobId,
}) {
  const promptRef = useRef(null);
  const configRef = useRef(null);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState([]);
  const [recentTemplateIds, setRecentTemplateIds] = useState([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState(null);
  const normalizedPrompt = prompt.trim();
  const activeTemplate =
    templates.find((item) => item.prompt.trim() === normalizedPrompt) ?? null;
  const activeTemplateId = activeTemplate?.id ?? null;
  const favoriteSet = useMemo(
    () => new Set(favoriteTemplateIds),
    [favoriteTemplateIds],
  );
  const recentTemplates = useMemo(
    () =>
      recentTemplateIds
        .map((id) => templates.find((item) => item.id === id))
        .filter((item) => item && !favoriteSet.has(item.id)),
    [recentTemplateIds, templates, favoriteSet],
  );
  const favoriteTemplates = useMemo(
    () => templates.filter((item) => favoriteSet.has(item.id)),
    [templates, favoriteSet],
  );
  const templateGroups = useMemo(() => {
    const order = ['决策', '行动', '风险', '分析', '洞察', '表达'];
    const grouped = new Map();
    for (const item of templates) {
      const group = item.group ?? '其他';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(item);
    }
    const sorted = [];
    for (const group of order) {
      if (grouped.has(group)) {
        sorted.push({ id: group, label: group, items: grouped.get(group) });
        grouped.delete(group);
      }
    }
    for (const [group, items] of grouped) {
      sorted.push({ id: group, label: group, items });
    }
    return sorted;
  }, [templates]);
  const statusLabels = {
    queued: '排队中',
    running: '生成中',
    done: '已完成',
    error: '失败',
  };
  const pendingCount = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  ).length;
  const totalCount = jobs.length;
  const progress = totalCount
    ? Math.round(((totalCount - pendingCount) / totalCount) * 100)
    : 0;
  const orderedJobs = useMemo(() => {
    const pinned = [];
    const normal = [];
    for (const job of jobs) {
      if (job.pinned) pinned.push(job);
      else normal.push(job);
    }
    return [...pinned, ...normal];
  }, [jobs]);

  useEffect(() => {
    if (!isConfigOpen) return undefined;
    function handleClick(event) {
      if (!configRef.current) return;
      if (configRef.current.contains(event.target)) return;
      setIsConfigOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isConfigOpen]);

  function handleSelectTemplate(item) {
    onPromptChange(item.prompt);
    promptRef.current?.focus();
    setRecentTemplateIds((prev) => {
      const next = [item.id, ...prev.filter((id) => id !== item.id)];
      return next.slice(0, 4);
    });
  }

  function handleToggleFavorite(templateId) {
    setFavoriteTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId],
    );
  }

  async function handleCopyJob(job) {
    const output = job.outputs?.[mode];
    const content = formatOutputForCopy(output, mode);
    if (!content) return;
    const text = `${job.title}\n${content}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedJobId(job.id);
      window.setTimeout(() => {
        setCopiedJobId((current) => (current === job.id ? null : current));
      }, 1500);
    } catch (error) {
      // noop: clipboard may be blocked
    }
  }

  return (
    <div className="WorkspacePanelBody">
      <div className="RefineCard">
        <div className="RefineCard__header">
          <div>
            <div className="RefineCard__title">智能提炼</div>
            <div className="RefineCard__subtitle">
              {selectedCitationCount > 0
                ? `已选 ${selectedCitationCount} 条引用，将仅基于选中引用生成输出。`
                : '选择模板或自定义提示词，点击提炼生成输出。'}
            </div>
          </div>
          <div className="RefineCard__actions" ref={configRef}>
            <div className="RefineCard__badge">
              {totalCount ? `历史 ${totalCount} 条` : '暂无历史'}
            </div>
            <button
              type="button"
              className="IconButton"
              aria-label="输出中心配置"
              aria-expanded={isConfigOpen}
              onClick={() => setIsConfigOpen((prev) => !prev)}
              title="输出中心配置"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm9.25 3.75a7.25 7.25 0 0 0-.1-1.2l2-1.56-1.9-3.29-2.38.94a7.5 7.5 0 0 0-2.08-1.2L16.5 2h-4.9l-.29 2.69a7.5 7.5 0 0 0-2.08 1.2l-2.38-.94-1.9 3.29 2 1.56a7.25 7.25 0 0 0 0 2.4l-2 1.56 1.9 3.29 2.38-.94a7.5 7.5 0 0 0 2.08 1.2L11.6 22h4.9l.29-2.69a7.5 7.5 0 0 0 2.08-1.2l2.38.94 1.9-3.29-2-1.56c.07-.39.1-.79.1-1.2Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {isConfigOpen ? (
              <div className="OutputConfigPanel">
                <div className="OutputConfigItem isDisabled">
                  <label className="Switch">
                    <input type="checkbox" checked={settings.autoTrigger} disabled />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">对话后自动触发提炼</div>
                    <div className="OutputConfigHint">当前仅支持手动触发</div>
                  </div>
                </div>
                <div className="OutputConfigItem">
                  <label className="Switch">
                    <input
                      type="checkbox"
                      checked={settings.asyncQueue}
                      onChange={() => onToggleSetting('asyncQueue')}
                    />
                    <span className="SwitchTrack" />
                    <span className="SwitchThumb" />
                  </label>
                  <div>
                    <div className="OutputConfigTitle">开启后台异步队列</div>
                    <div className="OutputConfigHint">任务在后台依序生成输出</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="RefineTemplates">
          <RefineTemplateSection
            title="收藏"
            items={favoriteTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          <RefineTemplateSection
            title="最近"
            items={recentTemplates}
            activeTemplateId={activeTemplateId}
            favoriteSet={favoriteSet}
            onSelect={handleSelectTemplate}
            onToggleFavorite={handleToggleFavorite}
          />
          {templateGroups.map((group) => (
            <RefineTemplateSection
              key={group.id}
              title={group.label}
              items={group.items}
              activeTemplateId={activeTemplateId}
              favoriteSet={favoriteSet}
              onSelect={handleSelectTemplate}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
        <textarea
          className="RefinePrompt"
          ref={promptRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={3}
          disabled={isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '例如：提炼核心结论、行动项与风险点。'}
        />
        <div className="RefineModes" role="tablist" aria-label="输出格式">
          {[
            { id: 'paragraph', label: '段落' },
            { id: 'bullets', label: '要点' },
            { id: 'structured', label: '结构化' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`RefineMode ${mode === item.id ? 'isActive' : ''}`}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="RefineActions">
          <button
            type="button"
            className="PrimaryButton"
            onClick={onGenerate}
            disabled={isBlocked || prompt.trim().length === 0}
          >
            立即提炼
          </button>
        </div>
      </div>

      {pendingCount > 0 ? (
        <div className="OutputQueueStatus">
          <div className="OutputQueueStatus__text">{pendingCount} 个任务处理中…</div>
          <div className="OutputQueueProgress" aria-hidden="true">
            <div
              className="OutputQueueProgress__bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="OutputList" aria-label="输出历史">
        {orderedJobs.length === 0 ? (
          <div className="OutputEmpty">
            <div className="OutputEmpty__icon" aria-hidden="true" />
            <div className="OutputEmpty__title">暂无输出历史</div>
            <div className="OutputEmpty__subtitle">
              点击左侧按钮或通过聊天触发智能提炼
            </div>
          </div>
        ) : (
          orderedJobs.map((job) => {
            const output = job.outputs?.[mode];
            const hasOutput = Boolean(
              output?.paragraph ||
                output?.bullets?.length ||
                output?.structured?.title ||
                output?.structured?.bullets?.length ||
                output?.structured?.terms?.length,
            );
            const isPending = job.status === 'queued' || job.status === 'running';
            const timeLabel = job.completedAtLabel ?? job.createdAtLabel;
            return (
              <div
                key={job.id}
                className={`RefineResultCard ${
                  job.pinned ? 'isPinned' : ''
                } ${isPending ? 'isLoading' : ''} ${
                  highlightedJobId === job.id ? 'isNew' : ''
                }`}
              >
                <div className="RefineResultCard__header">
                  <div>
                    <div className="RefineResultCard__title">{job.title}</div>
                    <div className="RefineResultCard__meta">
                      <span className={`RefineResultStatus is-${job.status}`}>
                        {statusLabels[job.status]}
                      </span>
                      <span>
                        {job.chunkIds?.length ? `引用 ${job.chunkIds.length}` : '自动检索'}
                      </span>
                      <span>{timeLabel}</span>
                    </div>
                  </div>
                  <div className="RefineResultCard__actions">
                    {copiedJobId === job.id ? (
                      <span className="RefineResultCard__hint">已复制</span>
                    ) : null}
                    <button
                      type="button"
                      className="IconButton"
                      aria-label={job.pinned ? '取消固定' : '固定结果'}
                      aria-pressed={job.pinned}
                      onClick={() => onTogglePin(job.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M6 3h12l-3 5v5l2 2v1H7v-1l2-2V8L6 3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="IconButton"
                      aria-label="复制结果"
                      onClick={() => handleCopyJob(job)}
                      disabled={!hasOutput}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M9 8h9a2 2 0 0 1 2 2v9h-9a2 2 0 0 1-2-2V8Z"
                          fill="currentColor"
                        />
                        <path
                          d="M6 5h9a2 2 0 0 1 2 2H8a2 2 0 0 0-2 2v9H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="IconButton"
                      aria-label="删除结果"
                      onClick={() => onDeleteJob(job.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M8 6h8l-.6 14H8.6L8 6Zm9-2h-4l-1-2h-2l-1 2H7v2h10V4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="RefineResultCard__prompt">{job.prompt}</div>
                <div className="RefineResultCard__content">
                  {job.status === 'error' ? (
                    <div className="RefineResultCard__error">{job.error}</div>
                  ) : isPending ? (
                    <div className="RefineResultCard__placeholder">
                      <div className="RefineResultCard__line" />
                      <div className="RefineResultCard__line isShort" />
                      <div className="RefineResultCard__line" />
                    </div>
                  ) : !hasOutput ? (
                    <div className="RefineResultCard__empty">暂无内容</div>
                  ) : mode === 'paragraph' ? (
                    <p className="RefineParagraph">{output.paragraph}</p>
                  ) : mode === 'bullets' ? (
                    <ul className="RefineBullets">
                      {output.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : mode === 'structured' && output.structured ? (
                    <div className="RefineStructured">
                      <div className="RefineStructured__title">
                        {output.structured.title || '未命名主题'}
                      </div>
                      <ul className="RefineStructured__bullets">
                        {output.structured.bullets?.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {output.structured.terms?.length ? (
                        <div className="RefineStructured__terms">
                          {output.structured.terms.map((term) => (
                            <span key={term} className="RefineTag">
                              {term}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const demoNotebooks = useMemo(
    () => [
      { id: 1, name: '示例：产品调研', updated_at: new Date().toISOString() },
      { id: 2, name: '示例：技术笔记', updated_at: new Date(Date.now() - 86400000).toISOString() },
    ],
    [],
  );

  const demoSources = useMemo(
    () => [
      {
        id: 1,
        filename: '需求说明.md',
        mime_type: 'text/markdown',
        status: 'READY',
        chunk_count: 12,
      },
      {
        id: 2,
        filename: '竞品对比.txt',
        mime_type: 'text/plain',
        status: 'READY',
        chunk_count: 8,
      },
      {
        id: 3,
        filename: '访谈纪要.md',
        mime_type: 'text/markdown',
        status: 'PROCESSING',
        chunk_count: 0,
      },
    ],
    [],
  );

  const refineFormats = useMemo(() => ['paragraph', 'bullets', 'structured'], []);
  const refineTemplates = useMemo(
    () => [
      {
        id: 'core-insights',
        label: '关键结论',
        prompt: '提炼核心结论与决策要点，保持简洁。',
        group: '决策',
      },
      {
        id: 'action-items',
        label: '行动清单',
        prompt: '列出可执行的行动项，并按优先级排序。',
        group: '行动',
      },
      {
        id: 'role-advice',
        label: '角色建议',
        prompt: '按角色（负责人/协作方/风险人）给出建议要点。',
        group: '行动',
      },
      {
        id: 'risk-gaps',
        label: '风险盲点',
        prompt: '找出潜在风险、限制与未覆盖的关键点。',
        group: '风险',
      },
      {
        id: 'terms',
        label: '术语速记',
        prompt: '提炼关键术语并用一句话解释。',
        group: '洞察',
      },
      {
        id: 'compare',
        label: '对比差异',
        prompt: '如果存在多个对象/方案，提炼主要差异与取舍。',
        group: '分析',
      },
      {
        id: 'compare-analysis',
        label: '对比分析',
        prompt: '基于选中引用生成对比分析，输出相同点 / 差异点 / 结论。',
        group: '分析',
      },
      {
        id: 'questions',
        label: '问题清单',
        prompt: '列出尚待验证的问题与需要补充的信息。',
        group: '洞察',
      },
      {
        id: 'summary-outline',
        label: '摘要大纲',
        prompt: '整理成背景 / 洞察 / 下一步的三段式摘要。',
        group: '表达',
      },
      {
        id: 'highlights',
        label: '亮点摘录',
        prompt: '提炼最值得传播的亮点金句，控制在 3-5 条。',
        group: '表达',
      },
    ],
    [],
  );
  const compareTemplate =
    refineTemplates.find((item) => item.id === 'compare-analysis') ?? null;

  const [notebooks, setNotebooks] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [activePanel, setActivePanel] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [citations, setCitations] = useState([]);
  const [selectedCitationIds, setSelectedCitationIds] = useState({});
  const [autoSelectCitations, setAutoSelectCitations] = useState(false);
  const [hoveredCitationChunkId, setHoveredCitationChunkId] = useState(null);
  const [refineMode, setRefineMode] = useState('paragraph');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineJobs, setRefineJobs] = useState([]);
  const [refineSettings, setRefineSettings] = useState({
    autoTrigger: false,
    asyncQueue: true,
  });
  const [hasNewOutput, setHasNewOutput] = useState(false);
  const [recentCompletedJobId, setRecentCompletedJobId] = useState(null);
  const [createState, setCreateState] = useState('idle');
  const [createName, setCreateName] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const [uploadState, setUploadState] = useState('idle');
  const [loadingState, setLoadingState] = useState({
    notebooks: false,
    sources: false,
    send: false,
  });
  const [errors, setErrors] = useState({ notebooks: '', sources: '', send: '', create: '' });
  const createInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const refineQueueRef = useRef([]);
  const refineRunningRef = useRef(false);
  const runNextRefineJobRef = useRef(() => {});
  const activePanelRef = useRef(activePanel);
  const activeNotebookIdRef = useRef(activeNotebookId);
  const [pendingChatFocus, setPendingChatFocus] = useState(false);

  const isDemo = connectionState === 'demo';
  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) ?? null;
  const statusLabel = useMemo(() => {
    if (connectionState === 'connecting') {
      return { text: '连接中', tone: 'isLoading', tooltip: '正在连接后端服务' };
    }
    if (connectionState === 'demo') {
      return { text: '演示模式', tone: 'isDemo', tooltip: '当前为前端演示数据' };
    }
    return { text: '已连接', tone: 'isLive', tooltip: '已连接到后端服务' };
  }, [connectionState]);

  runNextRefineJobRef.current = runNextRefineJob;

  const selectedChunkIds = useMemo(
    () =>
      citations
        .filter((citation) => selectedCitationIds[citation.id])
        .map((citation) => citation.chunkId ?? Number(citation.id))
        .filter((value) => Number.isFinite(value) && value > 0),
    [citations, selectedCitationIds],
  );

  useEffect(() => {
    activePanelRef.current = activePanel;
    if (activePanel === 'refine') {
      setHasNewOutput(false);
    }
  }, [activePanel]);

  useEffect(() => {
    activeNotebookIdRef.current = activeNotebookId;
  }, [activeNotebookId]);

  useEffect(() => {
    if (!pendingChatFocus) return;
    if (activePanel !== 'chat') return;
    const input = chatInputRef.current;
    if (input) {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }
    setPendingChatFocus(false);
  }, [pendingChatFocus, activePanel]);

  useEffect(() => {
    setSelectedCitationIds((prev) => {
      const next = {};
      for (const citation of citations) {
        if (autoSelectCitations) {
          next[citation.id] = true;
        } else if (prev?.[citation.id]) {
          next[citation.id] = true;
        }
      }
      return next;
    });
  }, [citations, autoSelectCitations]);

  useEffect(() => {
    setHoveredCitationChunkId(null);
  }, [citations]);

  useEffect(() => {
    let cancelled = false;
    async function fetchNotebooks() {
      setLoadingState((prev) => ({ ...prev, notebooks: true }));
      setErrors((prev) => ({ ...prev, notebooks: '' }));

      try {
        const data = await listNotebooks();
        if (cancelled) return;
        const normalized = data.map(normalizeNotebook);
        setNotebooks(normalized);
        setActiveNotebookId(normalized[0]?.id ?? null);
        setConnectionState('live');
      } catch (error) {
        if (cancelled) return;
        setNotebooks(demoNotebooks.map(normalizeNotebook));
        setActiveNotebookId(demoNotebooks[0]?.id ?? null);
        setConnectionState('demo');
        setErrors((prev) => ({
          ...prev,
          notebooks: '未连接到后端服务，已切换为演示数据。',
        }));
      } finally {
        if (!cancelled) {
          setLoadingState((prev) => ({ ...prev, notebooks: false }));
        }
      }
    }

    fetchNotebooks();
    return () => {
      cancelled = true;
    };
  }, [demoNotebooks]);

  useEffect(() => {
    if (!activeNotebookId) return;
    if (isDemo) {
      setSources(demoSources.map(normalizeSource));
      return;
    }

    let cancelled = false;

    async function fetchSources() {
      setLoadingState((prev) => ({ ...prev, sources: true }));
      setErrors((prev) => ({ ...prev, sources: '' }));
      try {
        const data = await listSources(activeNotebookId);
        if (cancelled) return;
        setSources(data.map(normalizeSource));
      } catch (error) {
        if (cancelled) return;
        setErrors((prev) => ({
          ...prev,
          sources: '来源加载失败，请检查后端状态。',
        }));
      } finally {
        if (!cancelled) {
          setLoadingState((prev) => ({ ...prev, sources: false }));
        }
      }
    }

    fetchSources();
    setMessages([]);
    setCitations([]);
    setSelectedCitationIds({});
    setAutoSelectCitations(false);
    setHoveredCitationChunkId(null);
    updateRefineQueue(() => []);
    setHasNewOutput(false);
    setRecentCompletedJobId(null);
    setRefinePrompt(refineTemplates[0]?.prompt ?? '');
    return () => {
      cancelled = true;
    };
  }, [activeNotebookId, isDemo, demoSources, refineTemplates]);

  useEffect(() => {
    if (activeNotebookId) return;
    if (!createInputRef.current) return;
    createInputRef.current.focus();
  }, [activeNotebookId]);

  useEffect(() => {
    refineQueueRef.current = refineJobs;

    if (refineRunningRef.current) return;
    if (!refineJobs.some((job) => job.status === 'queued')) return;

    runNextRefineJobRef.current();
  }, [refineJobs]);

  useEffect(() => {
    if (refinePrompt.trim().length > 0) return;
    if (!refineTemplates[0]) return;
    setRefinePrompt(refineTemplates[0].prompt);
  }, [refinePrompt, refineTemplates]);

  async function handleCreateNotebook() {
    const name = createName.trim();
    if (!name || isDemo) return;
    setCreateState('loading');
    setErrors((prev) => ({ ...prev, create: '' }));
    try {
      const created = await createNotebook(name);
      const normalized = normalizeNotebook(created);
      setNotebooks((prev) => [...prev, normalized]);
      setActiveNotebookId(normalized.id);
      setCreateName('');
    } catch (error) {
      setErrors((prev) => ({ ...prev, create: '创建失败，请检查后端状态。' }));
    } finally {
      setCreateState('idle');
    }
  }

  async function handleUpload(file) {
    if (!file || isDemo || !activeNotebookId) return;
    setUploadState('loading');
    setErrors((prev) => ({ ...prev, sources: '' }));
    try {
      await uploadSource(activeNotebookId, file);
      const data = await listSources(activeNotebookId);
      setSources(data.map(normalizeSource));
    } catch (error) {
      setErrors((prev) => ({ ...prev, sources: '上传失败，请检查文件格式或后端状态。' }));
    } finally {
      setUploadState('idle');
    }
  }

  function normalizeRefineOutputs(outputs, evidence) {
    return Object.entries(outputs ?? {}).reduce((acc, [format, output]) => {
      acc[format] = {
        paragraph: output.paragraph ?? '',
        bullets: output.bullets ?? [],
        structured: output.structured ?? null,
        evidence,
      };
      return acc;
    }, {});
  }

  function updateRefineQueue(updater) {
    const next = updater(refineQueueRef.current);
    refineQueueRef.current = next;
    setRefineJobs(next);
  }

  function markJobCompleted(jobId) {
    if (activePanelRef.current !== 'refine') {
      setHasNewOutput(true);
    }
    setRecentCompletedJobId(jobId);
    window.setTimeout(() => {
      setRecentCompletedJobId((current) => (current === jobId ? null : current));
    }, 2000);
  }

  function runNextRefineJob() {
    if (refineRunningRef.current) return;
    const nextJob = refineQueueRef.current.find((job) => job.status === 'queued');
    if (!nextJob) return;

    refineRunningRef.current = true;
    updateRefineQueue((prev) =>
      prev.map((job) => (job.id === nextJob.id ? { ...job, status: 'running' } : job)),
    );
    void processRefineJob(
      nextJob.id,
      nextJob.prompt,
      nextJob.chunkIds ?? [],
      nextJob.notebookId,
    );
  }

  async function processRefineJob(jobId, prompt, chunkIds, jobNotebookId) {
    try {
      let normalizedOutputs = {};
      let response = null;
      if (isDemo) {
        const demoOutput = buildRefineOutput(prompt);
        normalizedOutputs = refineFormats.reduce((acc, format) => {
          acc[format] = demoOutput;
          return acc;
        }, {});
      } else if (jobNotebookId) {
        response = await refineBatch(jobNotebookId, prompt, refineFormats, chunkIds);
        normalizedOutputs = normalizeRefineOutputs(response.outputs ?? {}, response.evidence);
      } else {
        throw new Error('missing notebook');
      }

      const completedAt = new Date().toISOString();
      const isCurrentNotebook =
        jobNotebookId && jobNotebookId === activeNotebookIdRef.current;
      updateRefineQueue((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'done',
                outputs: normalizedOutputs,
                error: '',
                completedAt,
                completedAtLabel: formatTimestamp(completedAt),
              }
            : job,
        ),
      );
      const stillTracked = refineQueueRef.current.some((job) => job.id === jobId);
      if (isCurrentNotebook && stillTracked) {
        markJobCompleted(jobId);
      }
      if (response?.citations && isCurrentNotebook && stillTracked) {
        setCitations(response.citations.map(normalizeCitation));
      }
    } catch (error) {
      const completedAt = new Date().toISOString();
      const isCurrentNotebook =
        jobNotebookId && jobNotebookId === activeNotebookIdRef.current;
      updateRefineQueue((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'error',
                error: '提炼失败，请稍后重试。',
                completedAt,
                completedAtLabel: formatTimestamp(completedAt),
              }
            : job,
        ),
      );
      const stillTracked = refineQueueRef.current.some((job) => job.id === jobId);
      if (isCurrentNotebook && stillTracked) {
        markJobCompleted(jobId);
        setErrors((prev) => ({ ...prev, send: '提炼生成失败，请稍后重试。' }));
      }
    } finally {
      refineRunningRef.current = false;
      runNextRefineJob();
    }
  }

  function enqueueRefineJob({ prompt: jobPrompt, chunkIds, label }) {
    const createdAt = new Date().toISOString();
    const jobLabel = label ?? resolveTemplateLabel(jobPrompt, refineTemplates);
    const job = {
      id: createId(),
      prompt: jobPrompt,
      status: 'queued',
      chunkIds,
      outputs: null,
      error: '',
      createdAt,
      createdAtLabel: formatTimestamp(createdAt),
      completedAt: null,
      completedAtLabel: '',
      pinned: false,
      title: buildJobTitle(jobLabel, createdAt),
      notebookId: activeNotebookId,
    };
    updateRefineQueue((prev) => [job, ...prev]);
    return job;
  }

  function handleToggleRefinePin(jobId) {
    updateRefineQueue((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, pinned: !job.pinned } : job)),
    );
  }

  function handleDeleteRefineJob(jobId) {
    updateRefineQueue((prev) => prev.filter((job) => job.id !== jobId));
  }

  function handleClearRefineJobs() {
    refineRunningRef.current = false;
    updateRefineQueue(() => []);
    setHasNewOutput(false);
    setRecentCompletedJobId(null);
  }

  function handleToggleRefineSetting(key) {
    setRefineSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSourceClick(source) {
    const nextPrompt = buildSourceSummaryPrompt(source.title);
    setDraft(nextPrompt);
    setActivePanel('chat');
    setPendingChatFocus(true);
  }

  function handleSendSelectedCitations() {
    if (!selectedChunkIds.length) return;
    handleRefineGenerate();
  }

  function handleCompareSelectedCitations() {
    if (!selectedChunkIds.length) return;
    if (!activeNotebookId && !isDemo) {
      setErrors((prev) => ({ ...prev, send: '请先创建笔记本。' }));
      return;
    }
    const promptText =
      compareTemplate?.prompt ??
      '基于选中引用生成对比分析，输出相同点 / 差异点 / 结论。';
    setRefinePrompt(promptText);
    enqueueRefineJob({
      prompt: promptText,
      chunkIds: [...selectedChunkIds],
      label: compareTemplate?.label ?? '对比分析',
    });
    setActivePanel('refine');
  }

  function handleToggleCitation(citationId) {
    const wasSelected = Boolean(selectedCitationIds[citationId]);
    if (autoSelectCitations && wasSelected) {
      setAutoSelectCitations(false);
    }
    setSelectedCitationIds((prev) => {
      const next = { ...prev };
      if (next[citationId]) {
        delete next[citationId];
      } else {
        next[citationId] = true;
      }
      return next;
    });
  }

  function handleSelectAllCitations() {
    setAutoSelectCitations(true);
    setSelectedCitationIds(() => {
      const next = {};
      for (const citation of citations) {
        next[citation.id] = true;
      }
      return next;
    });
  }

  function handleClearCitationSelection() {
    setAutoSelectCitations(false);
    setSelectedCitationIds({});
  }

  function handleToggleAutoSelectCitations() {
    setAutoSelectCitations((prev) => {
      const next = !prev;
      setSelectedCitationIds(() => {
        if (!next) return {};
        const selection = {};
        for (const citation of citations) {
          selection[citation.id] = true;
        }
        return selection;
      });
      return next;
    });
  }

  function handleRefineGenerate() {
    if (!activeNotebookId && !isDemo) {
      setErrors((prev) => ({ ...prev, send: '请先创建笔记本。' }));
      return;
    }
    const trimmed = refinePrompt.trim();
    if (!trimmed) return;
    const chunkIdsSnapshot = selectedChunkIds.length ? [...selectedChunkIds] : [];
    enqueueRefineJob({
      prompt: trimmed,
      chunkIds: chunkIdsSnapshot,
      label: resolveTemplateLabel(trimmed, refineTemplates),
    });
    setActivePanel('refine');
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    if (!activeNotebookId) {
      setErrors((prev) => ({ ...prev, send: '请先创建笔记本。' }));
      return;
    }

    const userMessage = { id: createId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setErrors((prev) => ({ ...prev, send: '' }));

    if (isDemo) {
      const demoCitations = [
        {
          id: '101',
          chunkId: 101,
          sourceTitle: '需求说明.md',
          snippet: '...与三栏工作区一致：左来源/引用，中聊天，右提炼输出。',
          chunkIndex: 3,
        },
        {
          id: '102',
          chunkId: 102,
          sourceTitle: '竞品对比.txt',
          snippet: '...对话区域需要始终可用，提炼区域用于结构化输出。',
          chunkIndex: 1,
        },
      ];
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: `（演示）已收到：${text}`,
        citationChunkIds: collectChunkIds(demoCitations),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCitations(demoCitations);
      setActivePanel('chat');
      return;
    }

    setLoadingState((prev) => ({ ...prev, send: true }));
    try {
      const qaResult = await askQuestion(activeNotebookId, text);
      const normalizedCitations = qaResult.citations?.map(normalizeCitation) ?? [];
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: qaResult.answer,
        citationChunkIds: collectChunkIds(normalizedCitations),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCitations(normalizedCitations);

      setActivePanel('chat');
    } catch (error) {
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: '请求失败，请检查后端服务或稍后重试。',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setErrors((prev) => ({ ...prev, send: '请求失败。' }));
    } finally {
      setLoadingState((prev) => ({ ...prev, send: false }));
    }
  }

  return (
    <div className="WorkspaceApp">
      <WorkspaceHeader
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onNotebookChange={setActiveNotebookId}
        statusLabel={statusLabel}
      />

      <WorkspaceTabs activePanel={activePanel} onChange={setActivePanel} />

      <main className="WorkspaceMain" aria-label="三栏工作区">
        <section
          className={`WorkspacePanel WorkspacePanel--sources ${
            activePanel === 'sources' ? 'isActive' : ''
          }`}
          aria-label="来源与引用"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">来源与引用</h2>
            <div className="WorkspaceTiny">笔记本：{activeNotebook?.title ?? '-'}</div>
          </div>
          <SourcesPanel
            sources={sources}
            citations={citations}
            selectedCitationIds={selectedCitationIds}
            autoSelectCitations={autoSelectCitations}
            onToggleCitation={handleToggleCitation}
            onSelectAllCitations={handleSelectAllCitations}
            onClearCitationSelection={handleClearCitationSelection}
            onToggleAutoSelectCitations={handleToggleAutoSelectCitations}
            onSourceClick={handleSourceClick}
            onSendSelectedCitations={handleSendSelectedCitations}
            onCompareSelectedCitations={handleCompareSelectedCitations}
            onCitationHover={setHoveredCitationChunkId}
            onUpload={handleUpload}
            uploadState={uploadState}
            isDemo={isDemo}
            error={errors.sources || errors.notebooks}
            showCreate={!activeNotebookId}
            createName={createName}
            onCreateNameChange={setCreateName}
            onCreate={handleCreateNotebook}
            createState={createState}
            createError={errors.create}
            createInputRef={createInputRef}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--chat ${
            activePanel === 'chat' ? 'isActive' : ''
          }`}
          aria-label="聊天"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">聊天</h2>
            <div className="WorkspaceTiny">输入 → 对话 → 输出中心</div>
          </div>
          <ChatPanel
            messages={messages}
            draft={draft}
            onDraftChange={setDraft}
            onSend={sendMessage}
            isSending={loadingState.send}
            notice={errors.send}
            isBlocked={!activeNotebookId}
            inputRef={chatInputRef}
            highlightedChunkId={hoveredCitationChunkId}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--refine ${
            activePanel === 'refine' ? 'isActive' : ''
          }`}
          aria-label="输出中心"
        >
          <div className="WorkspacePanelHeader WorkspacePanelHeader--refine">
            <h2 className="WorkspacePanelTitle OutputCenterTitle">
              输出中心
              {hasNewOutput ? (
                <span className="OutputCenterDot" aria-label="有新输出" />
              ) : null}
            </h2>
            <button
              type="button"
              className="OutputClearButton"
              onClick={handleClearRefineJobs}
              disabled={refineJobs.length === 0}
              title="清空输出历史"
            >
              清空全部
            </button>
          </div>
          <RefinePanel
            mode={refineMode}
            onModeChange={setRefineMode}
            isBlocked={!activeNotebookId}
            selectedCitationCount={selectedChunkIds.length}
            prompt={refinePrompt}
            onPromptChange={setRefinePrompt}
            onGenerate={handleRefineGenerate}
            templates={refineTemplates}
            jobs={refineJobs}
            onTogglePin={handleToggleRefinePin}
            onDeleteJob={handleDeleteRefineJob}
            settings={refineSettings}
            onToggleSetting={handleToggleRefineSetting}
            highlightedJobId={recentCompletedJobId}
          />
        </section>
      </main>
    </div>
  );
}
