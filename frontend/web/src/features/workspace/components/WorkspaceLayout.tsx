import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Tooltip } from '@material-tailwind/react';

import ChatPanel from './ChatPanel';
import KnowledgeGraphView from './KnowledgeGraphView';
import SessionDetailDialog from './SessionDetailDialog';
import SessionSwitcher from './SessionSwitcher';
import SourceDetailDialog from './SourceDetailDialog';
import SourcesPanel from './SourcesPanel';
import StudioPanel from './StudioPanel';
import SlidesStudioDialog from './SlidesStudioDialog';
import WorkspaceHeader from './WorkspaceHeader';
import { useWorkspaceState } from '../context/WorkspaceContext';
import { useAnalysis } from '../hooks/useAnalysis';
import { useChat } from '../hooks/useChat';
import { useNotebooks } from '../hooks/useNotebooks';
import { useRefine } from '../hooks/useRefine';
import { useSessions } from '../hooks/useSessions';
import { useSources } from '../hooks/useSources';
import type { ChatMessage, SourceItem } from '../types';
import { buildSourceSummaryPrompt, normalizeMessage } from '../utils';
import { listMessages } from '../api';
import { IconFullscreen, IconExitFullscreen } from './Icons';

const StudioOutputViewer = lazy(() => import('./StudioOutputViewer'));

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
  const state = useWorkspaceState();
  const [pendingChatFocus, setPendingChatFocus] = useState(false);
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

  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);

  // Source detail dialog state for graph view
  const [graphSourceDetailOpen, setGraphSourceDetailOpen] = useState(false);
  const [graphSelectedSource, setGraphSelectedSource] = useState<SourceItem | null>(null);
  const [graphSourceDetailFullscreen, setGraphSourceDetailFullscreen] = useState(false);

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

  const selectedChunkIds = useMemo(
    () =>
      state.citations
        .filter((citation) => state.selectedCitationIds[citation.id])
        .map((citation) => citation.chunkId ?? Number(citation.id))
        .filter((value): value is number => Number.isFinite(value) && value > 0),
    [state.citations, state.selectedCitationIds],
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
    const handleResize = () => {
      const main = mainRef.current;
      if (!main) return;
      const { width } = main.getBoundingClientRect();
      const nextLeft = resolveLeftWidth(sizesRef.current.left, sizesRef.current.right, width);
      const nextRight = resolveRightWidth(sizesRef.current.right, nextLeft, width);
      applySizes(nextLeft, nextRight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [applySizes]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const delta = event.clientX - dragState.startX;
      if (dragState.side === 'left') {
        const nextLeft = resolveLeftWidth(
          dragState.startLeft + delta,
          dragState.startRight,
          dragState.containerWidth,
        );
        applySizes(nextLeft, dragState.startRight);
      } else {
        const nextRight = resolveRightWidth(
          dragState.startRight - delta,
          dragState.startLeft,
          dragState.containerWidth,
        );
        applySizes(dragState.startLeft, nextRight);
      }
    };
    const handleUp = () => {
      dragStateRef.current = null;
      setIsResizing(false);
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [applySizes, isResizing]);

  useEffect(() => {
    if (!pendingChatFocus) return;
    const input = chatInputRef.current;
    if (input) {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }
    setPendingChatFocus(false);
  }, [pendingChatFocus]);

  const handleSourceClick = useCallback(
    (source: SourceItem) => {
      chat.setDraft(buildSourceSummaryPrompt(source.title));
      setPendingChatFocus(true);
    },
    [chat.setDraft],
  );

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
        const response = await listMessages(notebooks.activeNotebookId, session.id);
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

  const isDemo = notebooks.connectionState === 'demo';

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
        isDemo={notebooks.isDemo}
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
          <SourcesPanel
            sources={sources.sources}
            onSourceClick={handleSourceClick}
            onUpload={sources.handleUpload}
            uploadState={sources.uploadState}
            searchState={sources.searchState}
            searchNotice={sources.searchNotice}
            searchResults={sources.searchResults}
            onSearch={sources.handleSearch}
            onClearSearchResults={sources.clearSearchResults}
            onAddSourceFromUrl={sources.addSourceFromUrl}
            onRemoveSources={sources.removeSources}
            onRemoveSource={sources.removeSource}
            isDemo={sources.isDemo}
            isLoading={sources.isLoading}
            removeState={sources.removeState}
            isFullscreen={expandedPanel === 'sources'}
            searchQueue={sources.searchQueue}
            onRemoveSearchQueueItem={sources.removeSearchQueueItem}
            onRemoveResultsFromQueue={sources.removeResultsFromQueue}
            availableExtractors={sources.availableExtractors}
            defaultExtractor={sources.defaultExtractor}
            onConvertSourceQAToSource={sources.convertSourceQAToSource}
            notebookId={state.activeNotebookId ?? undefined}
          />
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
                isDemo={sessions.isDemo}
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
          <ChatPanel
            messages={chat.messages}
            draft={chat.draft}
            onDraftChange={chat.setDraft}
            onSend={chat.sendMessage}
            isSending={chat.isSending}
            notice={chat.sendError}
            isBlocked={!notebooks.activeNotebookId}
            isDemo={isDemo}
            inputRef={chatInputRef}
            citations={sources.citations}
            isLoadingMessages={chat.isLoadingMessages}
            messagesError={state.errors.messages}
            onRetryMessages={chat.retryMessages}
            onSaveToNote={refine.saveContentAsNote}
            onConvertToSource={chat.convertSessionToSource}
            onConvertToOutput={chat.convertSessionToOutput}
            isConverting={chat.isConverting}
          />
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
          <StudioPanel
            tools={refine.tools}
            toolsLoading={refine.toolsLoading}
            toolsError={refine.toolsError}
            outputs={refine.outputs}
            outputQueueJobs={refine.outputQueueJobs}
            outputsLoading={refine.outputsLoading}
            outputsError={refine.outputsError}
            onRetryOutputs={refine.retryOutputs}
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
            isDemo={isDemo}
            isFullscreen={expandedPanel === 'studio'}
          />
        </section>
        )}
      </main>

      <Suspense fallback={null}>
        <StudioOutputViewer
          outputs={refine.outputs}
          selectedOutputId={viewerOutputId}
          isOpen={isViewerOpen}
          isFullscreen={isViewerFullscreen}
          onClose={handleCloseOutputViewer}
          onToggleFullscreen={handleToggleOutputViewer}
          onSelectOutput={handleSelectOutput}
          onDeleteOutput={refine.onDeleteOutput}
          elevated={isViewerElevated}
        />
      </Suspense>

      <SlidesStudioDialog
        open={isSlidesDialogOpen}
        onClose={() => {
          setIsSlidesDialogOpen(false);
          setSlidesOpenMode('config');
          setSlidesDraftId(null);
          setSlidesQueueJobId(null);
        }}
        notebookId={state.activeNotebookId}
        selectedChunkIds={selectedChunkIds}
        isDemo={isDemo}
        onOutputsUpdated={refine.retryOutputs}
        openMode={slidesOpenMode}
        draftId={slidesDraftId}
        queueStatus={slidesQueueStatus}
        onQueueSlides={refine.onQueueSlides}
      />

      {/* Knowledge Graph View (Full Screen Overlay) */}
      {isGraphViewOpen && (
        <KnowledgeGraphView
          sources={sources.sources}
          outputs={refine.outputs}
          sessions={sessions.sessions}
          messages={chat.messages}
          analysis={analysis.analysis}
          isLoading={analysis.isLoading}
          error={analysis.error}
          onClose={() => setIsGraphViewOpen(false)}
          onRefresh={analysis.fetchAnalysis}
          onSourceClick={handleGraphSourceClick}
          onOutputClick={(output) => handleOpenOutputViewer(output.id, true)}
          onSessionClick={handleGraphSessionClick}
          isDemo={analysis.isDemo}
        />
      )}

      {/* Source Detail Dialog for Graph View */}
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
