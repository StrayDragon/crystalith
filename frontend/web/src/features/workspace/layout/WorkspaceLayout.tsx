import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Tooltip } from '@material-tailwind/react';

import ChatPanel from '../domains/messages/ChatPanel';
import SessionDetailDialog from '../domains/sessions/SessionDetailDialog';
import SessionSwitcher from '../domains/sessions/SessionSwitcher';
import type { ChatMessage as SourceDialogMessage } from '../domains/sources/SourceDetailDialog';
import SourcesPanel from '../domains/sources/SourcesPanel';
import StudioPanel from '../domains/studio/StudioPanel';
import WorkspaceHeader from './WorkspaceHeader';
import { useWorkspaceStore } from '../shared/state/workspaceStore';
import { useAnalysis } from '../domains/analysis/useAnalysis';
import { useChat } from '../domains/messages/useChat';
import { useNotebooks } from '../domains/notebooks/useNotebooks';
import { useRefine } from '../domains/refine/useRefine';
import { useSessions } from '../domains/sessions/useSessions';
import { useSources } from '../domains/sources/useSources';
import type { ChatMessage, Citation, SourceItem } from '../shared/types';
import { normalizeMessage } from '../shared/utils';
import { listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet as listMessages } from '../../../api/generated';
import { IconFullscreen, IconExitFullscreen } from '../shared/components/Icons';
import { SkeletonCard } from '../shared/components/Skeleton';
import ErrorBoundary from '../shared/components/ErrorBoundary';
import { toast } from '../../../shared/toast';

const StudioOutputViewer = lazy(() => import('../domains/outputs/StudioOutputViewer'));
const KnowledgeGraphView = lazy(() => import('../domains/analysis/KnowledgeGraphView'));
const SlidesStudioDialog = lazy(() => import('../domains/studio/SlidesStudioDialog'));
const SourceDetailDialog = lazy(() => import('../domains/sources/SourceDetailDialog'));

type ExpandedPanel = 'sources' | 'chat' | 'studio' | null;

type DragSide = 'left' | 'right';

type DragState = {
  side: DragSide;
  startX: number;
  startLeft: number;
  startRight: number;
  containerWidth: number;
};

const DEFAULT_SOURCES_WIDTH = 300;
const DEFAULT_STUDIO_WIDTH = 320;
const MIN_SOURCES_WIDTH = 220;
const MAX_SOURCES_WIDTH = 380;
const MIN_STUDIO_WIDTH = 240;
const MAX_STUDIO_WIDTH = 380;
const MIN_CHAT_WIDTH = 420;
const RESIZE_HANDLE_WIDTH = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveLeftWidth(left: number, right: number, containerWidth: number) {
  const available = Math.max(0, containerWidth - RESIZE_HANDLE_WIDTH * 2);
  const maxLeftByCenter = available - MIN_CHAT_WIDTH - right;
  const maxLeft = Math.min(MAX_SOURCES_WIDTH, maxLeftByCenter);
  const safeMax = Math.max(MIN_SOURCES_WIDTH, maxLeft);
  return clamp(left, MIN_SOURCES_WIDTH, safeMax);
}

function resolveRightWidth(right: number, left: number, containerWidth: number) {
  const available = Math.max(0, containerWidth - RESIZE_HANDLE_WIDTH * 2);
  const maxRightByCenter = available - MIN_CHAT_WIDTH - left;
  const maxRight = Math.min(MAX_STUDIO_WIDTH, maxRightByCenter);
  const safeMax = Math.max(MIN_STUDIO_WIDTH, maxRight);
  return clamp(right, MIN_STUDIO_WIDTH, safeMax);
}

export default function WorkspaceLayout() {
  const selectedSourceIds_raw = useWorkspaceStore((s) => s.selectedSourceIds);
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const errMessages = useWorkspaceStore((s) => s.errors.messages);
  const store = useWorkspaceStore;
  const [isResizing, setIsResizing] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerOutputId, setViewerOutputId] = useState<number | null>(null);
  const [isViewerElevated, setIsViewerElevated] = useState(false);
  const [isSessionSwitcherOpen, setIsSessionSwitcherOpen] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionSearchRef = useRef<HTMLInputElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const sizesRef = useRef({
    left: DEFAULT_SOURCES_WIDTH,
    right: DEFAULT_STUDIO_WIDTH,
  });
  const resizeDebounceRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);

  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);

  // Source detail dialog state for graph view
  const [graphSourceDetailOpen, setGraphSourceDetailOpen] = useState(false);
  const [graphSelectedSource, setGraphSelectedSource] = useState<SourceItem | null>(null);
  const [graphSourceDetailFullscreen, setGraphSourceDetailFullscreen] = useState(false);

  // Source detail dialog state for citation popovers
  const [citationSourceDetailOpen, setCitationSourceDetailOpen] = useState(false);
  const [citationSelectedSource, setCitationSelectedSource] = useState<SourceItem | null>(null);
  const [citationSourceDetailFullscreen, setCitationSourceDetailFullscreen] = useState(false);
  const [jumpToSource, setJumpToSource] = useState<{ id: number; token: number } | null>(null);

  // Session detail dialog state for graph view
  const [graphSessionDetailOpen, setGraphSessionDetailOpen] = useState(false);
  const [graphSelectedSession, setGraphSelectedSession] = useState<{ id: number; title: string; createdAt: string; updatedAt: string } | null>(null);
  const [graphSessionDetailFullscreen, setGraphSessionDetailFullscreen] = useState(false);
  const [graphSessionMessages, setGraphSessionMessages] = useState<ChatMessage[]>([]);
  const [graphSessionMessagesLoading, setGraphSessionMessagesLoading] = useState(false);
  const [isSlidesDialogOpen, setIsSlidesDialogOpen] = useState(false);
  const [slidesOpenMode, setSlidesOpenMode] = useState<'config' | 'preview'>('config');
  const [slidesDraftId, setSlidesDraftId] = useState<number | null>(null);
  const [slidesQueueJobId, setSlidesQueueJobId] = useState<string | null>(null);

  const notebooks = useNotebooks();
  const sessions = useSessions();
  const sources = useSources();
  const refine = useRefine();
  const analysis = useAnalysis();
  const chat = useChat({
    ensureSession: sessions.ensureSession,
    refreshSessions: sessions.refreshSessions,
    refreshSources: sources.retrySources,
    refreshOutputs: refine.retryOutputs,
  });
  const slidesQueueStatus = useMemo(() => {
    if (!slidesQueueJobId) return null;
    const job = refine.outputQueueJobs.find((item) => item.id === slidesQueueJobId);
    return job?.status ?? null;
  }, [refine.outputQueueJobs, slidesQueueJobId]);

  const selectedSourceIds = useMemo(
    () =>
      Object.entries(selectedSourceIds_raw)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((value) => Number.isFinite(value) && value > 0),
    [selectedSourceIds_raw],
  );

  const sourceById = useMemo(() => {
    const map = new Map<number, SourceItem>();
    sources.sources.forEach((source) => {
      map.set(source.id, source);
    });
    return map;
  }, [sources.sources]);

  const chunkToSourceId = useMemo(() => {
    const map = new Map<number, number>();
    let chunkOffset = 0;
    for (const source of sources.sources) {
      for (let i = 0; i < source.chunks; i++) {
        map.set(chunkOffset + i + 1, source.id);
      }
      chunkOffset += source.chunks;
    }
    return map;
  }, [sources.sources]);

  const resolveCitationSource = useCallback(
    (citation: Citation) => {
      if (citation.sourceId != null) {
        return sourceById.get(citation.sourceId) ?? null;
      }
      if (citation.chunkId != null) {
        const sourceId = chunkToSourceId.get(citation.chunkId);
        if (sourceId != null) {
          return sourceById.get(sourceId) ?? null;
        }
      }
      const title = citation.sourceTitle?.trim();
      if (title) {
        const match = sources.sources.find((source) => source.title === title);
        if (match) return match;
      }
      return null;
    },
    [chunkToSourceId, sourceById, sources.sources],
  );

  const handleSelectedSourceIdsChange = useCallback(
    (selected: Record<number, boolean>) => {
      store.getState().setSelectedSources(selected);
    },
    [],
  );

  const hasSelectedSources = useMemo(
    () => Object.values(selectedSourceIds_raw).some(Boolean),
    [selectedSourceIds_raw],
  );

  const handleChatCitationHover = useCallback(
    (chunkId: number | null) => {
      if (chunkId == null) {
        sources.setHoveredMessageChunkIds(null);
        return;
      }
      sources.setHoveredMessageChunkIds([chunkId]);
    },
    [sources],
  );

  const handleOpenCitationSourceDetail = useCallback(
    (citation: Citation) => {
      const source = resolveCitationSource(citation);
      if (!source) {
        toast.error('未找到对应来源，请先同步来源列表。');
        return;
      }
      setCitationSelectedSource(source);
      setCitationSourceDetailOpen(true);
      setCitationSourceDetailFullscreen(false);
    },
    [resolveCitationSource],
  );

  const handleLocateCitationSource = useCallback(
    (citation: Citation) => {
      const source = resolveCitationSource(citation);
      if (!source) {
        toast.error('未找到对应来源，请先同步来源列表。');
        return;
      }
      if (expandedPanel && expandedPanel !== 'sources') {
        setExpandedPanel('sources');
      }
      setJumpToSource((prev) => ({
        id: source.id,
        token: (prev?.token ?? 0) + 1,
      }));
    },
    [expandedPanel, resolveCitationSource],
  );

  const handleCitationSaveQAAsSource = useCallback(
    async (_sourceTitle: string, messages: SourceDialogMessage[]) => {
      if (!citationSelectedSource || !sources.convertSourceQAToSource) return;
      const qaMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await sources.convertSourceQAToSource(citationSelectedSource.id, qaMessages);
    },
    [citationSelectedSource, sources.convertSourceQAToSource],
  );

  const handleChatCitationJump = useCallback(
    (citation: Citation, message: ChatMessage) => {
      if (message.citations && message.citations.length > 0) {
        store.getState().setCitations(message.citations);
      }
      if (citation.chunkId != null) {
        sources.setJumpToCitationChunkId(citation.chunkId);
      }
      handleOpenCitationSourceDetail(citation);
    },
    [handleOpenCitationSourceDetail, sources],
  );

  const handleOutputCitationJump = useCallback(
    (citation: Citation, citations: Citation[]) => {
      if (citations.length > 0) {
        store.getState().setCitations(citations);
      }
      if (citation.chunkId != null) {
        sources.setJumpToCitationChunkId(citation.chunkId);
      }
      handleOpenCitationSourceDetail(citation);
    },
    [handleOpenCitationSourceDetail, sources],
  );

  const applySizes = useCallback((left: number, right: number) => {
    sizesRef.current = { left, right };
    const main = mainRef.current;
    if (!main) return;
    main.style.setProperty('--sources-width', `${left}px`);
    main.style.setProperty('--studio-width', `${right}px`);
  }, []);

  useEffect(() => {
    applySizes(sizesRef.current.left, sizesRef.current.right);
  }, [applySizes]);

  useEffect(() => {
    const applyResize = () => {
      const main = mainRef.current;
      if (!main) return;
      const { width } = main.getBoundingClientRect();
      const nextLeft = resolveLeftWidth(sizesRef.current.left, sizesRef.current.right, width);
      const nextRight = resolveRightWidth(sizesRef.current.right, nextLeft, width);
      applySizes(nextLeft, nextRight);
    };

    const handleResize = () => {
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      resizeDebounceRef.current = window.setTimeout(() => {
        applyResize();
      }, 120);
    };

    window.addEventListener('resize', handleResize);
    applyResize();

    return () => {
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [applySizes]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const pointerX = event.clientX;

      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current);
      }

      dragRafRef.current = window.requestAnimationFrame(() => {
        const latestDragState = dragStateRef.current;
        if (!latestDragState) return;
        const delta = pointerX - latestDragState.startX;

        if (latestDragState.side === 'left') {
          const nextLeft = resolveLeftWidth(
            latestDragState.startLeft + delta,
            latestDragState.startRight,
            latestDragState.containerWidth,
          );
          applySizes(nextLeft, latestDragState.startRight);
        } else {
          const nextRight = resolveRightWidth(
            latestDragState.startRight - delta,
            latestDragState.startLeft,
            latestDragState.containerWidth,
          );
          applySizes(latestDragState.startLeft, nextRight);
        }

        dragRafRef.current = null;
      });
    };

    const handleUp = () => {
      dragStateRef.current = null;
      setIsResizing(false);
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [applySizes, isResizing]);

  const handleRetrySources = useCallback(() => {
    if (notebooks.notebooksError) {
      void notebooks.retryNotebooks();
      return;
    }
    void sources.retrySources();
  }, [notebooks.notebooksError, notebooks.retryNotebooks, sources.retrySources]);

  const openSlidesDialog = useCallback(
    (mode: 'config' | 'preview', slideId?: number | null, queueJobId?: string | null) => {
      setSlidesOpenMode(mode);
      setSlidesDraftId(slideId ?? null);
      setSlidesQueueJobId(queueJobId ?? null);
      setIsSlidesDialogOpen(true);
      setIsViewerOpen(false);
      setViewerOutputId(null);
      setIsViewerFullscreen(false);
      setIsViewerElevated(false);
    },
    [],
  );

  const resolveSlideDraftId = useCallback(
    (outputId: number) => {
      const output = refine.outputs.find((item) => item.id === outputId);
      if (!output || output.type !== 'SLIDES') return null;
      const slideId = (output.content as any)?.slide_id;
      return typeof slideId === 'number' ? slideId : null;
    },
    [refine.outputs],
  );

  const handleOpenOutputViewer = useCallback((outputId: number, elevated = false) => {
    const slideId = resolveSlideDraftId(outputId);
    if (slideId) {
      openSlidesDialog('preview', slideId);
      return;
    }
    setViewerOutputId(outputId);
    setIsViewerOpen(true);
    setIsViewerFullscreen(false);
    setIsViewerElevated(elevated);
  }, [openSlidesDialog, resolveSlideDraftId]);

  const handleOpenOutputViewerFullscreen = useCallback((outputId: number) => {
    const slideId = resolveSlideDraftId(outputId);
    if (slideId) {
      openSlidesDialog('preview', slideId);
      return;
    }
    setViewerOutputId(outputId);
    setIsViewerOpen(true);
    setIsViewerFullscreen(true);
    setIsViewerElevated(false);
  }, [openSlidesDialog, resolveSlideDraftId]);

  const handleCloseOutputViewer = useCallback(() => {
    setIsViewerOpen(false);
    setIsViewerFullscreen(false);
  }, []);

  const handleToggleOutputViewer = useCallback(() => {
    setIsViewerFullscreen((prev) => !prev);
  }, []);

  const handleSelectOutput = useCallback((outputId: number) => {
    const slideId = resolveSlideDraftId(outputId);
    if (slideId) {
      openSlidesDialog('preview', slideId);
      return;
    }
    setViewerOutputId(outputId);
  }, [openSlidesDialog, resolveSlideDraftId]);

  const handleToggleExpand = useCallback((panel: ExpandedPanel) => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  }, []);

  // Handle source click from graph view - open source detail dialog
  const handleGraphSourceClick = useCallback((source: SourceItem) => {
    setGraphSelectedSource(source);
    setGraphSourceDetailOpen(true);
    setGraphSourceDetailFullscreen(false);
  }, []);

  // Handle session click from graph view - open session detail dialog
  const handleGraphSessionClick = useCallback(async (session: { id: number; title?: string; createdAt?: string; updatedAt?: string }) => {
    setGraphSelectedSession({
      id: session.id,
      title: session.title || `对话 ${session.id}`,
      createdAt: session.createdAt || '',
      updatedAt: session.updatedAt || '',
    });
    setGraphSessionDetailOpen(true);
    setGraphSessionDetailFullscreen(false);
    setGraphSessionMessages([]);

    // Fetch messages for the selected session
    if (notebooks.activeNotebookId) {
      setGraphSessionMessagesLoading(true);
      try {
        const response = await listMessages({
          path: { notebook_id: notebooks.activeNotebookId, session_id: session.id },
        });
        const normalizedMessages = response.map(normalizeMessage);
        setGraphSessionMessages(normalizedMessages);
      } catch {
        // Silently fail - dialog will show empty state
        setGraphSessionMessages([]);
      } finally {
        setGraphSessionMessagesLoading(false);
      }
    }
  }, [notebooks.activeNotebookId]);

  // ESC key to collapse expanded panel
  useEffect(() => {
    if (!expandedPanel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedPanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedPanel]);

  useEffect(() => {
    if (!isViewerOpen) return;
    if (refine.outputs.length === 0) {
      setIsViewerOpen(false);
      setViewerOutputId(null);
      return;
    }
    if (viewerOutputId && refine.outputs.some((item) => item.id === viewerOutputId)) {
      return;
    }
    setViewerOutputId(refine.outputs[0].id);
  }, [isViewerOpen, refine.outputs, viewerOutputId]);

  const isConnected = notebooks.isConnected;

  // NOTE: Mobile responsive layout is deferred - keeping 3-column horizontal layout always
  // TODO: Add mobile/tablet responsive layout when adapting for mobile devices
  return (
    <div className="flex flex-col h-screen bg-gray-50/50 gap-4 p-4 overflow-hidden text-gray-900">
      <WorkspaceHeader
        notebooks={notebooks.notebooks}
        activeNotebookId={notebooks.activeNotebookId}
        isNotebooksLoading={notebooks.isLoading}
        notebooksError={notebooks.notebooksError}
        createName={notebooks.createName}
        createState={notebooks.createState}
        createError={notebooks.createError}
        isConnected={isConnected}
        onCreateNameChange={notebooks.setCreateName}
        onCreateNotebook={notebooks.createNotebook}
        onUpdateNotebook={notebooks.updateNotebook}
        onDeleteNotebook={notebooks.deleteNotebook}
        onSelectNotebook={notebooks.setActiveNotebookId}
        onOpenKnowledgeGraph={() => {
          setIsGraphViewOpen(true);
          if (!analysis.analysis && !analysis.isLoading) {
            analysis.fetchAnalysis();
          }
        }}
      />

      <main
        ref={mainRef}
        className={`flex-1 min-h-0 grid ${isResizing ? 'cursor-col-resize select-none' : ''}`}
        aria-label="三栏工作区"
        style={{
          gridTemplateColumns: expandedPanel
            ? '1fr' // Single column when expanded
            : `minmax(220px, var(--sources-width, ${DEFAULT_SOURCES_WIDTH}px)) ${RESIZE_HANDLE_WIDTH}px minmax(0, 1fr) ${RESIZE_HANDLE_WIDTH}px minmax(240px, var(--studio-width, ${DEFAULT_STUDIO_WIDTH}px))`,
        }}
      >
        {/* Sources Panel */}
        {(!expandedPanel || expandedPanel === 'sources') && (
        <section
          className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label="来源"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">来源</h2>
            <Tooltip content={expandedPanel === 'sources' ? '收起' : '展开'}>
              <IconButton
                variant="text"
                size="sm"
                className="w-7 h-7 rounded-full text-gray-500 hover:bg-gray-200"
                onClick={() => handleToggleExpand('sources')}
              >
                {expandedPanel === 'sources' ? (
                  <IconExitFullscreen className="w-4 h-4" />
                ) : (
                  <IconFullscreen className="w-4 h-4" />
                )}
              </IconButton>
            </Tooltip>
          </div>
          <ErrorBoundary
            title="来源面板异常"
            description="来源面板渲染失败，请重试。"
          >
            <SourcesPanel
              sources={sources.sources}
              jumpToSource={jumpToSource}
              onUpload={sources.handleUpload}
              uploadState={sources.uploadState}
              uploadError={sources.uploadError}
              onRetryUpload={sources.retryUpload}
              searchState={sources.searchState}
              searchNotice={sources.searchNotice}
              searchResults={sources.searchResults}
              onSearch={sources.handleSearch}
              onClearSearchResults={sources.clearSearchResults}
              onAddSourceFromUrl={sources.addSourceFromUrl}
              onRemoveSources={sources.removeSources}
              onRemoveSource={sources.removeSource}
              isConnected={sources.isConnected}
              isLoading={sources.isLoading}
              removeState={sources.removeState}
              isFullscreen={expandedPanel === 'sources'}
              searchQueue={sources.searchQueue}
              onRemoveSearchQueueItem={sources.removeSearchQueueItem}
              onRemoveResultsFromQueue={sources.removeResultsFromQueue}
              availableExtractors={sources.availableExtractors}
              defaultExtractor={sources.defaultExtractor}
              onConvertSourceQAToSource={sources.convertSourceQAToSource}
              onReembedSource={sources.reembedSource}
              notebookId={activeNotebookId ?? undefined}
              onSelectedSourceIdsChange={handleSelectedSourceIdsChange}
            />
          </ErrorBoundary>
        </section>
        )}

        {/* Left Resize Handle - hidden when any panel is expanded */}
        {!expandedPanel && (
        <button
          type="button"
          className={`items-center justify-center w-3 cursor-col-resize bg-transparent hover:bg-transparent group ${
            expandedPanel ? 'hidden' : 'flex'
          }`}
          aria-label="调整来源宽度"
          onPointerDown={(event) => {
            if (window.innerWidth < 1024 || expandedPanel) return;
            const main = mainRef.current;
            if (!main) return;
            const { width } = main.getBoundingClientRect();
            dragStateRef.current = {
              side: 'left',
              startX: event.clientX,
              startLeft: sizesRef.current.left,
              startRight: sizesRef.current.right,
              containerWidth: width,
            };
            setIsResizing(true);
          }}
        >
          <div className={`w-0.5 h-12 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-400 ${isResizing ? 'bg-gray-500' : ''}`} />
        </button>
        )}

        {/* Chat Panel */}
        {(!expandedPanel || expandedPanel === 'chat') && (
        <section
          className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label="对话"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">对话</h2>
              <SessionSwitcher
                sessions={sessions.sessions}
                activeSessionId={sessions.activeSessionId}
                isOpen={isSessionSwitcherOpen}
                isLoading={sessions.isLoading}
                error={sessions.error}
                isConnected={sessions.isConnected}
                searchInputRef={sessionSearchRef}
                onToggle={() => setIsSessionSwitcherOpen((prev) => !prev)}
                onClose={() => setIsSessionSwitcherOpen(false)}
                onSelect={sessions.setActiveSessionId}
                onCreate={async () => {
                  await sessions.createSession();
                }}
                onUpdate={sessions.updateSession}
                onDelete={sessions.deleteSession}
                onRetry={sessions.retrySessions}
              />
            </div>
            <Tooltip content={expandedPanel === 'chat' ? '收起' : '展开'}>
              <IconButton
                variant="text"
                size="sm"
                className="w-7 h-7 rounded-full text-gray-500 hover:bg-gray-200"
                onClick={() => handleToggleExpand('chat')}
              >
                {expandedPanel === 'chat' ? (
                  <IconExitFullscreen className="w-4 h-4" />
                ) : (
                  <IconFullscreen className="w-4 h-4" />
                )}
              </IconButton>
            </Tooltip>
          </div>
          <ErrorBoundary
            title="对话面板异常"
            description="对话面板渲染失败，请重试。"
          >
            <ChatPanel
              messages={chat.messages}
              draft={chat.draft}
              onDraftChange={chat.setDraft}
              onSend={chat.sendMessage}
              isSending={chat.isSending}
              isStreaming={chat.isStreaming}
              streamingMessageId={chat.streamingMessageId}
              notice={chat.sendError}
              onRetrySend={chat.retrySend}
              isBlocked={!notebooks.activeNotebookId}
              isConnected={isConnected}
              inputRef={chatInputRef}
              citations={sources.citations}
              onCitationHover={handleChatCitationHover}
              onCitationJump={handleChatCitationJump}
              onCitationLocate={handleLocateCitationSource}
              isLoadingMessages={chat.isLoadingMessages}
              messagesError={errMessages}
              onRetryMessages={chat.retryMessages}
              onSaveToNote={refine.saveContentAsNote}
              onConvertToSource={chat.convertSessionToSource}
              onConvertToOutput={chat.convertSessionToOutput}
              isConverting={chat.isConverting}
            />
          </ErrorBoundary>
        </section>
        )}

        {/* Right Resize Handle - hidden when any panel is expanded */}
        {!expandedPanel && (
        <button
          type="button"
          className="items-center justify-center w-3 cursor-col-resize bg-transparent hover:bg-transparent group flex"
          aria-label="调整 Studio 宽度"
          onPointerDown={(event) => {
            if (window.innerWidth < 1024 || expandedPanel) return;
            const main = mainRef.current;
            if (!main) return;
            const { width } = main.getBoundingClientRect();
            dragStateRef.current = {
              side: 'right',
              startX: event.clientX,
              startLeft: sizesRef.current.left,
              startRight: sizesRef.current.right,
              containerWidth: width,
            };
            setIsResizing(true);
          }}
        >
          <div className={`w-0.5 h-12 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-400 ${isResizing ? 'bg-gray-500' : ''}`} />
        </button>
        )}

        {/* Studio Panel */}
        {(!expandedPanel || expandedPanel === 'studio') && (
        <section
          className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label="Studio"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Studio</h2>
            <Tooltip content={expandedPanel === 'studio' ? '收起' : '展开'}>
              <IconButton
                variant="text"
                size="sm"
                className="w-7 h-7 rounded-full text-gray-500 hover:bg-gray-200"
                onClick={() => handleToggleExpand('studio')}
              >
                {expandedPanel === 'studio' ? (
                  <IconExitFullscreen className="w-4 h-4" />
                ) : (
                  <IconFullscreen className="w-4 h-4" />
                )}
              </IconButton>
            </Tooltip>
          </div>
          <ErrorBoundary
            title="Studio 面板异常"
            description="输出面板渲染失败，请重试。"
          >
            <StudioPanel
              tools={refine.tools}
              toolsLoading={refine.toolsLoading}
              toolsError={refine.toolsError}
              outputs={refine.outputs}
              outputQueueJobs={refine.outputQueueJobs}
              outputsLoading={refine.outputsLoading}
              outputsError={refine.outputsError}
              onRetryOutputs={refine.retryOutputs}
              onRetryOutputJob={refine.retryOutputJob}
              onGenerateOutput={refine.onGenerateOutput}
              onOpenSlides={(options) => {
                const mode = options?.mode ?? 'config';
                openSlidesDialog(mode, options?.slideId ?? null, options?.queueJobId ?? null);
              }}
              onDeleteOutput={refine.onDeleteOutput}
              onSelectOutput={handleOpenOutputViewer}
              onSelectOutputFullscreen={handleOpenOutputViewerFullscreen}
              onSaveNote={refine.saveContentAsNote}
              onConvertToSource={sources.convertOutputToSource}
              onJumpToCitation={handleOutputCitationJump}
              isConnected={isConnected}
              isFullscreen={expandedPanel === 'studio'}
              hasSelectedSources={hasSelectedSources}
            />
          </ErrorBoundary>
        </section>
        )}
      </main>

      <Suspense fallback={<div className="fixed bottom-4 right-4 w-72"><SkeletonCard lines={3} /></div>}>
        <StudioOutputViewer
          outputs={refine.outputs}
          selectedOutputId={viewerOutputId}
          isOpen={isViewerOpen}
          isFullscreen={isViewerFullscreen}
          onClose={handleCloseOutputViewer}
          onToggleFullscreen={handleToggleOutputViewer}
          onSelectOutput={handleSelectOutput}
          onDeleteOutput={refine.onDeleteOutput}
          onJumpToCitation={handleOutputCitationJump}
          onCitationHover={handleChatCitationHover}
          onLocateSource={handleLocateCitationSource}
          elevated={isViewerElevated}
        />
      </Suspense>

      {isSlidesDialogOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20"><div className="w-[420px]"><SkeletonCard lines={6} /></div></div>}>
          <SlidesStudioDialog
            open={isSlidesDialogOpen}
            onClose={() => {
              setIsSlidesDialogOpen(false);
              setSlidesOpenMode('config');
              setSlidesDraftId(null);
              setSlidesQueueJobId(null);
            }}
            notebookId={activeNotebookId}
            selectedSourceIds={selectedSourceIds}
            isConnected={isConnected}
            onOutputsUpdated={refine.retryOutputs}
            openMode={slidesOpenMode}
            draftId={slidesDraftId}
            queueStatus={slidesQueueStatus}
            onQueueSlides={refine.onQueueSlides}
          />
        </Suspense>
      )}

      {/* Knowledge Graph View (Full Screen Overlay) */}
      {isGraphViewOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20"><div className="w-[520px]"><SkeletonCard lines={6} /></div></div>}>
          <KnowledgeGraphView
            sources={sources.sources}
            outputs={refine.outputs}
            sessions={sessions.sessions}
            messages={chat.messages}
            analysis={analysis.analysis}
            isLoading={analysis.isLoading}
            error={analysis.error}
            activeSessionId={activeSessionId}
            onClose={() => setIsGraphViewOpen(false)}
            onRefresh={analysis.fetchAnalysis}
            onSourceClick={handleGraphSourceClick}
            onOutputClick={(output) => handleOpenOutputViewer(output.id, true)}
            onSessionClick={handleGraphSessionClick}
            isConnected={analysis.isConnected}
          />
        </Suspense>
      )}

      {/* Source Detail Dialog for Graph View */}
      {graphSourceDetailOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20"><div className="w-[520px]"><SkeletonCard lines={5} /></div></div>}>
          <SourceDetailDialog
            open={graphSourceDetailOpen}
            source={graphSelectedSource}
            onClose={() => {
              setGraphSourceDetailOpen(false);
              setGraphSourceDetailFullscreen(false);
            }}
            isFullscreen={graphSourceDetailFullscreen}
            onToggleFullscreen={() => setGraphSourceDetailFullscreen((prev) => !prev)}
            onSaveQAAsSource={sources.convertSourceQAToSource ? async (sourceTitle: string, messages) => {
              if (!graphSelectedSource) return;
              const qaMessages = messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              }));
              await sources.convertSourceQAToSource(graphSelectedSource.id, qaMessages);
            } : undefined}
          />
        </Suspense>
      )}

      {/* Source Detail Dialog for Citation Popovers */}
      {citationSourceDetailOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20"><div className="w-[520px]"><SkeletonCard lines={5} /></div></div>}>
          <SourceDetailDialog
            open={citationSourceDetailOpen}
            source={citationSelectedSource}
            onClose={() => {
              setCitationSourceDetailOpen(false);
              setCitationSelectedSource(null);
              setCitationSourceDetailFullscreen(false);
            }}
            isFullscreen={citationSourceDetailFullscreen}
            onToggleFullscreen={() => setCitationSourceDetailFullscreen((prev) => !prev)}
            onSaveQAAsSource={sources.convertSourceQAToSource ? handleCitationSaveQAAsSource : undefined}
          />
        </Suspense>
      )}

      {/* Session Detail Dialog for Graph View */}
      <SessionDetailDialog
        open={graphSessionDetailOpen}
        session={graphSelectedSession}
        messages={graphSessionMessages}
        onClose={() => {
          setGraphSessionDetailOpen(false);
          setGraphSessionDetailFullscreen(false);
          setGraphSessionMessages([]);
        }}
        isFullscreen={graphSessionDetailFullscreen}
        onToggleFullscreen={() => setGraphSessionDetailFullscreen((prev) => !prev)}
        isLoading={graphSessionMessagesLoading}
      />
    </div>
  );
}
