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
  const statusLabel =
    {
      READY: '已索引',
      PROCESSING: '处理中',
      FAILED: '失败',
    }[row.status] ?? row.status;

  return {
    id: Number(row.id),
    title: row.filename ?? '未命名文件',
    type: formatSourceType(row),
    status: statusLabel,
    statusTone: row.status ?? 'READY',
    chunks: row.chunk_count ?? 0,
  };
}

function normalizeCitation(row) {
  return {
    id: `${row.chunk_id}`,
    sourceTitle: row.source_name,
    snippet: row.snippet,
    chunkIndex: row.chunk_index,
    score: row.score,
  };
}

function WorkspaceHeader({ notebooks, activeNotebookId, onNotebookChange, statusLabel }) {
  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) ?? null;

  return (
    <header className="WorkspaceHeader">
      <div className="WorkspaceHeader__left">
        <div className="WorkspaceBrand">研究工作台</div>
        <div className="WorkspaceMeta">三栏：来源 / 聊天 / 提炼</div>
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
        { id: 'sources', label: '来源/引用' },
        { id: 'chat', label: '聊天' },
        { id: 'refine', label: '提炼' },
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
              <li key={source.id} className="WorkspaceListItem">
                <div className="WorkspaceListItem__main">
                  <div className="WorkspaceListItem__title">{source.title}</div>
                  <div className="WorkspaceListItem__sub">
                    {source.type} · {source.status}
                  </div>
                </div>
                <div className={`WorkspaceBadge ${source.statusTone}`}>{source.chunks} 段</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="WorkspaceSection">
        <h3 className="WorkspaceSectionTitle">引用</h3>
        {citations.length === 0 ? (
          <div className="WorkspaceEmpty">暂无引用。发送一次消息后这里会展示引用片段。</div>
        ) : (
          <ul className="WorkspaceList">
            {citations.map((c) => (
              <li key={c.id} className="WorkspaceListItem WorkspaceListItem--compact">
                <div className="WorkspaceListItem__main">
                  <div className="WorkspaceListItem__title">{c.sourceTitle}</div>
                  <div className="WorkspaceListItem__sub">{c.snippet}</div>
                </div>
                <div className="WorkspaceBadge"># {c.chunkIndex}</div>
              </li>
            ))}
          </ul>
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
}) {
  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatMessages" role="log" aria-label="聊天记录">
        {isBlocked ? (
          <div className="WorkspaceEmpty">请先创建笔记本，再开始对话。</div>
        ) : messages.length === 0 ? (
          <div className="WorkspaceEmpty">
            开始对话吧：输入问题或指令，中间显示聊天，右侧可手动生成提炼。
          </div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'}`}
          >
            <div className="ChatMessage__meta">{message.role === 'user' ? '你' : '助手'}</div>
            <div className="ChatMessage__bubble">{message.content}</div>
          </div>
        ))}
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

function RefinePanel({
  mode,
  onModeChange,
  output,
  isLoading,
  isBlocked,
  prompt,
  onPromptChange,
  onGenerate,
  templates,
  queue,
  activeJobId,
  onSelectJob,
  activeError,
}) {
  const hasOutput = Boolean(
    output?.paragraph || output?.bullets?.length || output?.structured?.title,
  );
  const showError = Boolean(activeError);
  const statusLabels = {
    queued: '排队中',
    running: '生成中',
    done: '已完成',
    error: '失败',
  };

  return (
    <div className="WorkspacePanelBody">
      <div className="RefineCard">
        <div className="RefineCard__header">
          <div>
            <div className="RefineCard__title">提炼卡片</div>
            <div className="RefineCard__subtitle">基于当前来源库生成输出，可自定义提炼目标。</div>
          </div>
          <div className="RefineCard__badge">
            {queue.length ? `队列 ${queue.length} 项` : '暂无任务'}
          </div>
        </div>
        <div className="RefineTemplates" role="list">
          {templates.map((item) => (
            <button
              key={item.label}
              type="button"
              className="RefineTemplate"
              onClick={() => onPromptChange(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          className="RefinePrompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={3}
          disabled={isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '例如：提炼关键结论、术语与风险点。'}
        />
        <div className="RefineModes" role="tablist" aria-label="提炼格式">
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
            加入队列
          </button>
        </div>
      </div>

      <div className="RefineQueue">
        <div className="RefineQueue__header">
          <div className="RefineQueue__title">生成队列</div>
          <div className="RefineQueue__meta">点击任务可查看输出</div>
        </div>
        {queue.length === 0 ? (
          <div className="WorkspaceEmpty">暂无任务，点击上方按钮生成提炼。</div>
        ) : (
          <div className="RefineQueue__list">
            {queue.map((job) => (
              <button
                key={job.id}
                type="button"
                className={`RefineQueueItem ${job.id === activeJobId ? 'isActive' : ''}`}
                onClick={() => onSelectJob(job.id)}
              >
                <div className="RefineQueueItem__top">
                  <span className={`RefineQueueItem__status is-${job.status}`}>
                    {statusLabels[job.status]}
                  </span>
                  <span className="RefineQueueItem__time">{job.createdAtLabel}</span>
                </div>
                <div className="RefineQueueItem__prompt">{job.prompt}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="RefineOutputBlock">
        {!hasOutput ? (
          <div className="WorkspaceEmpty">
            {isBlocked
              ? '请先创建笔记本。'
              : showError
                ? activeError
                : isLoading
                  ? '正在生成提炼结果…'
                  : '暂无输出，选择队列中的任务查看内容。'}
          </div>
        ) : (
          <div className="RefineOutput" aria-label="提炼结果">
            {mode === 'paragraph' ? <p className="RefineParagraph">{output.paragraph}</p> : null}
            {mode === 'bullets' ? (
              <ul className="RefineBullets">
                {output.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {mode === 'structured' && output.structured ? (
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
        label: '关键结论',
        prompt: '提炼这份资料的核心结论与可执行要点。',
      },
      {
        label: '风险与盲点',
        prompt: '找出文档中提到的风险、限制或未覆盖的关键点。',
      },
      {
        label: '术语速记',
        prompt: '提炼关键术语并解释其含义（保持简洁）。',
      },
    ],
    [],
  );

  const [notebooks, setNotebooks] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [activePanel, setActivePanel] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [citations, setCitations] = useState([]);
  const [refineMode, setRefineMode] = useState('paragraph');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineJobs, setRefineJobs] = useState([]);
  const [activeRefineJobId, setActiveRefineJobId] = useState(null);
  const [createState, setCreateState] = useState('idle');
  const [createName, setCreateName] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const [uploadState, setUploadState] = useState('idle');
  const [loadingState, setLoadingState] = useState({
    notebooks: false,
    sources: false,
    refine: false,
    send: false,
  });
  const [errors, setErrors] = useState({ notebooks: '', sources: '', send: '', create: '' });
  const createInputRef = useRef(null);
  const refineQueueRef = useRef([]);
  const refineRunningRef = useRef(false);

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

  const activeRefineJob =
    refineJobs.find((job) => job.id === activeRefineJobId) ?? refineJobs[0] ?? null;
  const currentRefineOutput =
    activeRefineJob?.outputs?.[refineMode] ?? {
      paragraph: '',
      bullets: [],
      structured: null,
      evidence: false,
    };

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
    updateRefineQueue(() => []);
    setActiveRefineJobId(null);
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
    setRefineJobs((prev) => {
      const next = updater(prev);
      refineQueueRef.current = next;
      return next;
    });
  }

  function runNextRefineJob() {
    if (refineRunningRef.current) return;
    const nextJob = refineQueueRef.current.find((job) => job.status === 'queued');
    if (!nextJob) return;

    refineRunningRef.current = true;
    updateRefineQueue((prev) =>
      prev.map((job) => (job.id === nextJob.id ? { ...job, status: 'running' } : job)),
    );
    void processRefineJob(nextJob.id, nextJob.prompt);
  }

  async function processRefineJob(jobId, prompt) {
    setLoadingState((prev) => ({ ...prev, refine: true }));
    try {
      let normalizedOutputs = {};
      let response = null;
      if (isDemo) {
        const demoOutput = buildRefineOutput(prompt);
        normalizedOutputs = refineFormats.reduce((acc, format) => {
          acc[format] = demoOutput;
          return acc;
        }, {});
      } else if (activeNotebookId) {
        response = await refineBatch(activeNotebookId, prompt, refineFormats);
        normalizedOutputs = normalizeRefineOutputs(response.outputs ?? {}, response.evidence);
      }

      updateRefineQueue((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'done',
                outputs: normalizedOutputs,
                error: '',
              }
            : job,
        ),
      );
      if (response?.citations) {
        setCitations(response.citations.map(normalizeCitation));
      }
    } catch (error) {
      updateRefineQueue((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'error',
                error: '提炼失败，请稍后重试。',
              }
            : job,
        ),
      );
      setErrors((prev) => ({ ...prev, send: '提炼生成失败，请稍后重试。' }));
    } finally {
      setLoadingState((prev) => ({ ...prev, refine: false }));
      refineRunningRef.current = false;
      runNextRefineJob();
    }
  }

  function handleRefineGenerate() {
    if (!activeNotebookId && !isDemo) {
      setErrors((prev) => ({ ...prev, send: '请先创建笔记本。' }));
      return;
    }
    const trimmed = refinePrompt.trim();
    if (!trimmed) return;
    const createdAt = new Date().toISOString();
    const job = {
      id: createId(),
      prompt: trimmed,
      status: 'queued',
      outputs: null,
      error: '',
      createdAt,
      createdAtLabel: formatTimestamp(createdAt),
    };
    updateRefineQueue((prev) => [...prev, job]);
    setActiveRefineJobId(job.id);

    runNextRefineJob();
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
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: `（演示）已收到：${text}`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCitations([
        {
          id: createId(),
          sourceTitle: '需求说明.md',
          snippet: '...与三栏工作区一致：左来源/引用，中聊天，右提炼输出。',
          chunkIndex: 3,
        },
        {
          id: createId(),
          sourceTitle: '竞品对比.txt',
          snippet: '...对话区域需要始终可用，提炼区域用于结构化输出。',
          chunkIndex: 1,
        },
      ]);
      setActivePanel('chat');
      return;
    }

    setLoadingState((prev) => ({ ...prev, send: true }));
    try {
      const qaResult = await askQuestion(activeNotebookId, text);
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: qaResult.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (qaResult.citations) {
        setCitations(qaResult.citations.map(normalizeCitation));
      }

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
            <h2 className="WorkspacePanelTitle">来源/引用</h2>
            <div className="WorkspaceTiny">笔记本：{activeNotebook?.title ?? '-'}</div>
          </div>
          <SourcesPanel
            sources={sources}
            citations={citations}
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
            <div className="WorkspaceTiny">输入 → 对话 → 提炼</div>
          </div>
          <ChatPanel
            messages={messages}
            draft={draft}
            onDraftChange={setDraft}
            onSend={sendMessage}
            isSending={loadingState.send}
            notice={errors.send}
            isBlocked={!activeNotebookId}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--refine ${
            activePanel === 'refine' ? 'isActive' : ''
          }`}
          aria-label="提炼"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">提炼</h2>
            <div className="WorkspaceTiny">输出面板</div>
          </div>
          <RefinePanel
            mode={refineMode}
            onModeChange={setRefineMode}
            output={currentRefineOutput}
            isLoading={loadingState.refine}
            isBlocked={!activeNotebookId}
            prompt={refinePrompt}
            onPromptChange={setRefinePrompt}
            onGenerate={handleRefineGenerate}
            templates={refineTemplates}
            queue={refineJobs}
            activeJobId={activeRefineJobId}
            onSelectJob={setActiveRefineJobId}
            activeError={activeRefineJob?.error ?? ''}
          />
        </section>
      </main>
    </div>
  );
}
