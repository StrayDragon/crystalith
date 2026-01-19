import { useCallback, useEffect, useRef, useState } from 'react';

import ChatPanel from './ChatPanel';
import SourcesPanel from './SourcesPanel';
import StudioPanel from './StudioPanel';
import StudioOutputViewer from './StudioOutputViewer';
import WorkspaceHeader from './WorkspaceHeader';
import { useWorkspaceState } from '../context/WorkspaceContext';
import { useChat } from '../hooks/useChat';
import { useNotebooks } from '../hooks/useNotebooks';
import { useRefine } from '../hooks/useRefine';
import { useSessions } from '../hooks/useSessions';
import { useSources } from '../hooks/useSources';
import type { SourceItem } from '../types';
import { buildSourceSummaryPrompt } from '../utils';

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
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
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
    enableSuggestions: true,
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
    <div className="WorkspaceApp">
      <WorkspaceHeader
        title={title}
        createName={notebooks.createName}
        createState={notebooks.createState}
        createError={notebooks.createError}
        isDemo={notebooks.isDemo}
        onCreateNameChange={notebooks.setCreateName}
        onCreateNotebook={notebooks.createNotebook}
      />

      <main
        ref={mainRef}
        className={`WorkspaceMain ${isResizing ? 'isResizing' : ''}`}
        aria-label="三栏工作区"
      >
        <section className="WorkspacePanel WorkspacePanel--sources" aria-label="来源">
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">来源</h2>
            <button type="button" className="PanelIconButton" aria-label="来源设置">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M6 7h12M6 12h12M6 17h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
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
            isDemo={sources.isDemo}
            error={sources.error || notebooks.notebooksError}
            isLoading={sources.isLoading}
            onRetry={handleRetrySources}
          />
        </section>

        <button
          type="button"
          className="WorkspaceResizeHandle WorkspaceResizeHandle--left"
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
        />

        <section className="WorkspacePanel WorkspacePanel--chat" aria-label="对话">
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">对话</h2>
            <div className="PanelHeaderActions">
              <button type="button" className="PanelIconButton" aria-label="筛选对话">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 6h16M7 12h10M10 18h4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button type="button" className="PanelIconButton" aria-label="更多操作">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="18" cy="12" r="1.5" fill="currentColor" />
                </svg>
              </button>
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
            isLoadingMessages={state.loading.messages}
            messagesError={state.errors.messages}
            onRetryMessages={chat.retryMessages}
            suggestions={chat.suggestions}
            suggestionsLoading={chat.suggestionsLoading}
            suggestionsError={chat.suggestionsError}
            onRefreshSuggestions={chat.refreshSuggestions}
            onApplySuggestion={chat.applySuggestion}
          />
        </section>

        <button
          type="button"
          className="WorkspaceResizeHandle WorkspaceResizeHandle--right"
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
        />

        <section className="WorkspacePanel WorkspacePanel--studio" aria-label="Studio">
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">Studio</h2>
            <button type="button" className="PanelIconButton" aria-label="Studio 设置">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                <path d="M12 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <StudioPanel
            tools={refine.tools}
            outputs={refine.outputs}
            outputsLoading={refine.outputsLoading}
            outputsError={refine.outputsError}
            onRetryOutputs={refine.retryOutputs}
            onGenerateOutput={refine.onGenerateOutput}
            onSelectOutput={handleOpenOutputViewer}
            recentOutputJobId={refine.recentOutputJobId}
            isDemo={isDemo}
          />
        </section>
      </main>

      <StudioOutputViewer
        outputs={refine.outputs}
        selectedOutputId={viewerOutputId}
        isOpen={isViewerOpen}
        isFullscreen={isViewerFullscreen}
        onClose={handleCloseOutputViewer}
        onToggleFullscreen={handleToggleOutputViewer}
        onSelectOutput={handleSelectOutput}
      />
    </div>
  );
}
