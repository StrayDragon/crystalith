import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

import ChatPanel from './ChatPanel';
import SessionSwitcher from './SessionSwitcher';
import SourcesPanel from './SourcesPanel';
import StudioPanel from './StudioPanel';
import WorkspaceHeader from './WorkspaceHeader';
import { useWorkspaceState } from '../context/WorkspaceContext';
import { useChat } from '../hooks/useChat';
import { useNotebooks } from '../hooks/useNotebooks';
import { useRefine } from '../hooks/useRefine';
import { useSessions } from '../hooks/useSessions';
import { useSources } from '../hooks/useSources';
import type { SourceItem } from '../types';
import { buildSourceSummaryPrompt } from '../utils';

const StudioOutputViewer = lazy(() => import('./StudioOutputViewer'));

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
  const [isSessionSwitcherOpen, setIsSessionSwitcherOpen] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionSearchRef = useRef<HTMLInputElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const sizesRef = useRef({
    left: DEFAULT_SOURCES_WIDTH,
    right: DEFAULT_STUDIO_WIDTH,
  });

  const notebooks = useNotebooks();
  const sessions = useSessions();
  const sources = useSources();
  const chat = useChat({
    ensureSession: sessions.ensureSession,
    refreshSessions: sessions.refreshSessions,
  });
  const refine = useRefine();

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

  const handleOpenOutputViewer = useCallback((outputId: number) => {
    setViewerOutputId(outputId);
    setIsViewerOpen(true);
    setIsViewerFullscreen(false);
  }, []);

  const handleCloseOutputViewer = useCallback(() => {
    setIsViewerOpen(false);
    setIsViewerFullscreen(false);
  }, []);

  const handleToggleOutputViewer = useCallback(() => {
    setIsViewerFullscreen((prev) => !prev);
  }, []);

  const handleSelectOutput = useCallback((outputId: number) => {
    setViewerOutputId(outputId);
  }, []);

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

  const activeNotebook =
    notebooks.notebooks.find((item) => item.id === notebooks.activeNotebookId) ?? null;
  const isDemo = notebooks.connectionState === 'demo';
  const title =
    isDemo
      ? 'Modern Strategies for Male Hair Loss and Restoration'
      : activeNotebook?.title ?? '未命名笔记本';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 gap-3 sm:gap-4 p-3 sm:p-4 lg:p-6 lg:h-screen lg:overflow-hidden text-gray-900">
      <WorkspaceHeader
        title={title}
        createName={notebooks.createName}
        createState={notebooks.createState}
        createError={notebooks.createError}
        isDemo={notebooks.isDemo}
        onCreateNameChange={notebooks.setCreateName}
        onCreateNotebook={notebooks.createNotebook}
        onUpdateNotebook={(name) =>
          notebooks.activeNotebookId
            ? notebooks.updateNotebook(notebooks.activeNotebookId, name)
            : Promise.resolve(false)
        }
        onDeleteNotebook={() =>
          notebooks.activeNotebookId
            ? notebooks.deleteNotebook(notebooks.activeNotebookId)
            : Promise.resolve(false)
        }
        activeNotebookId={notebooks.activeNotebookId}
      />

      <main
        ref={mainRef}
        className={`grid flex-1 min-h-0 gap-y-3 lg:gap-y-0 ${isResizing ? 'cursor-col-resize select-none' : ''}`}
        aria-label="三栏工作区"
        style={{
          // We use inline style for grid layout to support dynamic resizing logic
          gridTemplateColumns: window.innerWidth >= 1024
            ? `minmax(220px, var(--sources-width, ${DEFAULT_SOURCES_WIDTH}px)) ${RESIZE_HANDLE_WIDTH}px minmax(0, 1fr) ${RESIZE_HANDLE_WIDTH}px minmax(240px, var(--studio-width, ${DEFAULT_STUDIO_WIDTH}px))`
            : '1fr',
          // Mobile layout is single column (handled by media query in Tailwind or JS check above)
          // Actually, let's use a class for mobile override to be safer
        }}
      >
        <section className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" aria-label="来源">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">来源</h2>
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
            onRemoveSources={sources.removeSources}
            onRemoveSource={sources.removeSource}
            isDemo={sources.isDemo}
            error={sources.error || notebooks.notebooksError}
            isLoading={sources.isLoading}
            removeState={sources.removeState}
            onRetry={handleRetrySources}
          />
        </section>

        <button
          type="button"
          className="hidden lg:flex items-center justify-center w-3 cursor-col-resize bg-transparent hover:bg-transparent group"
          aria-label="调整来源宽度"
          onPointerDown={(event) => {
            if (window.innerWidth < 1024) return;
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

        <section className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" aria-label="对话">
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
          />
        </section>

        <button
          type="button"
          className="hidden lg:flex items-center justify-center w-3 cursor-col-resize bg-transparent hover:bg-transparent group"
          aria-label="调整 Studio 宽度"
          onPointerDown={(event) => {
            if (window.innerWidth < 1024) return;
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

        <section className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" aria-label="Studio">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Studio</h2>
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
            onDeleteOutput={refine.onDeleteOutput}
            onSelectOutput={handleOpenOutputViewer}
            onSaveNote={refine.saveContentAsNote}
            onConvertToSource={sources.convertOutputToSource}
            isDemo={isDemo}
          />
        </section>
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
        />
      </Suspense>
    </div>
  );
}
