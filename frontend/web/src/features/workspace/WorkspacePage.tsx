import { useEffect, useMemo, useRef, useState } from 'react';

import './WorkspacePage.css';
import {
  askQuestion,
  createNotebook,
  listNotebooks,
  listSources,
  refineBatch,
  uploadSource,
} from './api';
import ChatPanel from './components/ChatPanel';
import RefinePanel from './components/RefinePanel';
import SourcesPanel from './components/SourcesPanel';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceTabs from './components/WorkspaceTabs';
import type {
  ApiNotebook,
  ApiRefineBatchResponse,
  ApiSource,
  ChatMessage,
  ConnectionState,
  Citation,
  ErrorsState,
  LoadingState,
  Notebook,
  PanelId,
  RefineJob,
  RefineMode,
  RefineOutput,
  RefineSettings,
  RefineTemplate,
  SourceItem,
  StatusLabel,
} from './types';
import {
  buildJobTitle,
  buildRefineOutput,
  buildSourceSummaryPrompt,
  collectChunkIds,
  createId,
  formatTimestamp,
  normalizeCitation,
  normalizeNotebook,
  normalizeSource,
  resolveTemplateLabel,
} from './utils';
import type { AsyncStatus } from '../../shared/types';

const REFINE_FORMATS: RefineMode[] = ['paragraph', 'bullets', 'structured'];

const REFINE_TEMPLATES: RefineTemplate[] = [
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
];

export default function WorkspacePage() {
  const demoNotebooks = useMemo<ApiNotebook[]>(
    () => [
      { id: 1, name: '示例：产品调研', updated_at: new Date().toISOString() },
      {
        id: 2,
        name: '示例：技术笔记',
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    [],
  );

  const demoSources = useMemo<ApiSource[]>(
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

  const refineFormats = useMemo(() => REFINE_FORMATS, []);
  const refineTemplates = useMemo(() => REFINE_TEMPLATES, []);
  const compareTemplate =
    refineTemplates.find((item) => item.id === 'compare-analysis') ?? null;

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitationIds, setSelectedCitationIds] = useState<Record<string, boolean>>({});
  const [autoSelectCitations, setAutoSelectCitations] = useState(false);
  const [hoveredCitationChunkId, setHoveredCitationChunkId] = useState<number | null>(null);
  const [refineMode, setRefineMode] = useState<RefineMode>('paragraph');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refineJobs, setRefineJobs] = useState<RefineJob[]>([]);
  const [refineSettings, setRefineSettings] = useState<RefineSettings>({
    autoTrigger: false,
    asyncQueue: true,
  });
  const [hasNewOutput, setHasNewOutput] = useState(false);
  const [recentCompletedJobId, setRecentCompletedJobId] = useState<string | null>(null);
  const [createState, setCreateState] = useState<AsyncStatus>('idle');
  const [createName, setCreateName] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [uploadState, setUploadState] = useState<AsyncStatus>('idle');
  const [loadingState, setLoadingState] = useState<LoadingState>({
    notebooks: false,
    sources: false,
    send: false,
  });
  const [errors, setErrors] = useState<ErrorsState>({
    notebooks: '',
    sources: '',
    send: '',
    create: '',
  });
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const refineQueueRef = useRef<RefineJob[]>([]);
  const refineRunningRef = useRef(false);
  const runNextRefineJobRef = useRef<() => void>(() => {});
  const activePanelRef = useRef(activePanel);
  const activeNotebookIdRef = useRef(activeNotebookId);
  const [pendingChatFocus, setPendingChatFocus] = useState(false);

  const isDemo = connectionState === 'demo';
  const activeNotebook = notebooks.find((notebook) => notebook.id === activeNotebookId) ?? null;
  const statusLabel = useMemo<StatusLabel>(() => {
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
        .filter((value): value is number => Number.isFinite(value) && value > 0),
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
      const next: Record<string, boolean> = {};
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

  async function handleUpload(file: File | null) {
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

  function normalizeRefineOutputs(
    outputs: ApiRefineBatchResponse['outputs'],
    evidence?: boolean,
  ): Partial<Record<RefineMode, RefineOutput>> {
    return Object.entries(outputs ?? {}).reduce(
      (acc, [format, output]) => {
        if (!output) return acc;
        const key = format as RefineMode;
        acc[key] = {
          paragraph: output.paragraph ?? '',
          bullets: output.bullets ?? [],
          structured: output.structured ?? null,
          evidence,
        };
        return acc;
      },
      {} as Partial<Record<RefineMode, RefineOutput>>,
    );
  }

  function updateRefineQueue(updater: (jobs: RefineJob[]) => RefineJob[]) {
    const next = updater(refineQueueRef.current);
    refineQueueRef.current = next;
    setRefineJobs(next);
  }

  function markJobCompleted(jobId: string) {
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

  async function processRefineJob(
    jobId: string,
    prompt: string,
    chunkIds: number[],
    jobNotebookId: number | null,
  ) {
    try {
      let normalizedOutputs: Partial<Record<RefineMode, RefineOutput>> = {};
      let response: ApiRefineBatchResponse | null = null;
      if (isDemo) {
        const demoOutput = buildRefineOutput(prompt);
        normalizedOutputs = refineFormats.reduce<Partial<Record<RefineMode, RefineOutput>>>(
          (acc, format) => {
            acc[format] = demoOutput;
            return acc;
          },
          {},
        );
      } else if (jobNotebookId) {
        response = await refineBatch(jobNotebookId, prompt, refineFormats, chunkIds);
        normalizedOutputs = normalizeRefineOutputs(response.outputs, response.evidence);
      } else {
        throw new Error('missing notebook');
      }

      const completedAt = new Date().toISOString();
      const isCurrentNotebook =
        jobNotebookId != null && jobNotebookId === activeNotebookIdRef.current;
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
        jobNotebookId != null && jobNotebookId === activeNotebookIdRef.current;
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

  function enqueueRefineJob({
    prompt: jobPrompt,
    chunkIds,
    label,
  }: {
    prompt: string;
    chunkIds?: number[];
    label?: string;
  }) {
    const createdAt = new Date().toISOString();
    const jobLabel = label ?? resolveTemplateLabel(jobPrompt, refineTemplates);
    const job: RefineJob = {
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

  function handleToggleRefinePin(jobId: string) {
    updateRefineQueue((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, pinned: !job.pinned } : job)),
    );
  }

  function handleDeleteRefineJob(jobId: string) {
    updateRefineQueue((prev) => prev.filter((job) => job.id !== jobId));
  }

  function handleClearRefineJobs() {
    refineRunningRef.current = false;
    updateRefineQueue(() => []);
    setHasNewOutput(false);
    setRecentCompletedJobId(null);
  }

  function handleToggleRefineSetting(key: keyof RefineSettings) {
    setRefineSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSourceClick(source: SourceItem) {
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

  function handleToggleCitation(citationId: string) {
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
      const next: Record<string, boolean> = {};
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
        const selection: Record<string, boolean> = {};
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
              {hasNewOutput ? <span className="OutputCenterDot" aria-label="有新输出" /> : null}
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
