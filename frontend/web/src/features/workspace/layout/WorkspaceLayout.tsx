import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatPanel from '../domains/messages/ChatPanel';
import SessionDetailDialog from '../domains/sessions/SessionDetailDialog';
import SessionSwitcher from '../domains/sessions/SessionSwitcher';
import type { ChatMessage as SourceDialogMessage } from '../domains/sources/SourceDetailDialog';
import SourcesPanel from '../domains/sources/SourcesPanel';
import StudioPanel from '../domains/studio/StudioPanel';
import WorkspaceHeader from './WorkspaceHeader';
import ShortcutHelpPanel from './ShortcutHelpPanel';
import { useWorkspaceStore } from '../shared/state/workspaceStore';
import { useKeyboardShortcuts, type KeyboardShortcutBinding } from '../shared/hooks/useKeyboardShortcuts';
import { WORKSPACE_SHORTCUTS } from '../shared/shortcuts';
import { useAnalysis } from '../domains/analysis/useAnalysis';
import { useChat } from '../domains/messages/useChat';
import { useNotebooks } from '../domains/notebooks/useNotebooks';
import { useRefine } from '../domains/refine/useRefine';
import { useSessions } from '../domains/sessions/useSessions';
import { useSources } from '../domains/sources/useSources';
import type { ChatMessage, Citation, SourceItem } from '../shared/types';
import { normalizeMessage } from '../shared/utils';
import { listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet as listMessages } from '../../../api/generated';
import { unwrapData } from '../../../api/unwrap';
import { SkeletonCard } from '../shared/components/Skeleton';
import { toast } from '../../../shared/toast';

import {
  ModularCanvas,
  type ModularCanvasHandle,
  CommandPalette,
  type CommandItem,
  WidgetCatalog,
  WIDGET_REGISTRY,
  DEFAULT_LAYOUT,
} from './modular-canvas';

const StudioOutputViewer = lazy(() => import('../domains/outputs/StudioOutputViewer'));
const KnowledgeGraphView = lazy(() => import('../domains/analysis/KnowledgeGraphView'));
const SlidesStudioDialog = lazy(() => import('../domains/studio/SlidesStudioDialog'));
const SourceDetailDialog = lazy(() => import('../domains/sources/SourceDetailDialog'));

export default function WorkspaceLayout() {
  const selectedSourceIds_raw = useWorkspaceStore((s) => s.selectedSourceIds);
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const errMessages = useWorkspaceStore((s) => s.errors.messages);
  const store = useWorkspaceStore;

  // ─── Modular Canvas state ───
  const canvasRef = useRef<ModularCanvasHandle>(null);
  const [locked, setLocked] = useState(true); // default locked
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>([]);

  // ─── Viewer / dialog state ───
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerOutputId, setViewerOutputId] = useState<number | null>(null);
  const [isViewerElevated, setIsViewerElevated] = useState(false);
  const [isSessionSwitcherOpen, setIsSessionSwitcherOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionSearchRef = useRef<HTMLInputElement | null>(null);

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

  // ─── Domain hooks ───
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

  // ─── Derived state ───
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

  // ─── Handlers ───
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
      setJumpToSource((prev) => ({
        id: source.id,
        token: (prev?.token ?? 0) + 1,
      }));
    },
    [resolveCitationSource],
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

  const focusPanel = useCallback((panel: 'sources' | 'chat' | 'studio') => {
    const nextActivePanel = panel === 'studio' ? 'refine' : panel;
    store.getState().setActivePanel(nextActivePanel);
  }, [store]);

  const openSessionSearch = useCallback(() => {
    setIsSessionSwitcherOpen(true);
    window.requestAnimationFrame(() => {
      sessionSearchRef.current?.focus();
      sessionSearchRef.current?.select();
    });
  }, []);

  const createNotebookByShortcut = useCallback(() => {
    void notebooks.createNotebookQuick('未命名笔记本');
  }, [notebooks]);

  // ─── Lock toggle ───
  const toggleLock = useCallback(() => {
    setLocked((prev) => !prev);
  }, []);

  // ─── Close overlays ───
  const closeActiveOverlay = useCallback(() => {
    if (showCmdPalette) {
      setShowCmdPalette(false);
      return true;
    }

    if (showCatalog) {
      setShowCatalog(false);
      return true;
    }

    if (isShortcutHelpOpen) {
      setIsShortcutHelpOpen(false);
      return true;
    }

    if (graphSessionDetailOpen) {
      setGraphSessionDetailOpen(false);
      setGraphSessionDetailFullscreen(false);
      setGraphSessionMessages([]);
      return true;
    }

    if (citationSourceDetailOpen) {
      setCitationSourceDetailOpen(false);
      setCitationSelectedSource(null);
      setCitationSourceDetailFullscreen(false);
      return true;
    }

    if (graphSourceDetailOpen) {
      setGraphSourceDetailOpen(false);
      setGraphSourceDetailFullscreen(false);
      return true;
    }

    if (isSlidesDialogOpen) {
      setIsSlidesDialogOpen(false);
      setSlidesOpenMode('config');
      setSlidesDraftId(null);
      setSlidesQueueJobId(null);
      return true;
    }

    if (isViewerOpen) {
      handleCloseOutputViewer();
      return true;
    }

    if (isGraphViewOpen) {
      setIsGraphViewOpen(false);
      return true;
    }

    if (isSessionSwitcherOpen) {
      setIsSessionSwitcherOpen(false);
      return true;
    }

    return false;
  }, [
    showCmdPalette,
    showCatalog,
    citationSourceDetailOpen,
    graphSessionDetailOpen,
    graphSourceDetailOpen,
    isGraphViewOpen,
    isSessionSwitcherOpen,
    isShortcutHelpOpen,
    isSlidesDialogOpen,
    isViewerOpen,
    handleCloseOutputViewer,
  ]);

  // ─── Keyboard shortcuts ───
  const shortcutBindings = useMemo<KeyboardShortcutBinding[]>(() => [
    {
      id: 'open-command-palette',
      combo: 'Ctrl+K',
      handler: () => {
        setShowCmdPalette((v) => !v);
      },
    },
    {
      id: 'create-notebook',
      combo: 'Ctrl+N',
      handler: () => {
        createNotebookByShortcut();
      },
    },
    {
      id: 'focus-sources',
      combo: 'Ctrl+1',
      handler: () => {
        focusPanel('sources');
      },
    },
    {
      id: 'focus-chat',
      combo: 'Ctrl+2',
      handler: () => {
        focusPanel('chat');
      },
    },
    {
      id: 'focus-studio',
      combo: 'Ctrl+3',
      handler: () => {
        focusPanel('studio');
      },
    },
    {
      id: 'send-message',
      combo: 'Ctrl+Enter',
      allowInInput: true,
      handler: () => {
        if (!notebooks.activeNotebookId || chat.isSending) return;
        void chat.sendMessage();
      },
    },
    {
      id: 'close-overlay',
      combo: 'Escape',
      allowInInput: true,
      preventDefault: false,
      handler: (event) => {
        if (closeActiveOverlay()) {
          event.preventDefault();
        }
      },
    },
    {
      id: 'open-shortcut-help',
      combo: 'Ctrl+?',
      handler: () => {
        setIsShortcutHelpOpen(true);
      },
    },
  ], [
    chat.isSending,
    chat.sendMessage,
    closeActiveOverlay,
    createNotebookByShortcut,
    focusPanel,
    notebooks.activeNotebookId,
  ]);

  useKeyboardShortcuts(shortcutBindings);

  // ─── Graph view handlers ───
  const handleGraphSourceClick = useCallback((source: SourceItem) => {
    setGraphSelectedSource(source);
    setGraphSourceDetailOpen(true);
    setGraphSourceDetailFullscreen(false);
  }, []);

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

	    if (notebooks.activeNotebookId) {
	      setGraphSessionMessagesLoading(true);
	      try {
	        const response = await unwrapData(listMessages<true>({
	          path: { notebook_id: notebooks.activeNotebookId, session_id: session.id },
	        }));
	        const normalizedMessages = response.map(normalizeMessage);
	        setGraphSessionMessages(normalizedMessages);
	      } catch {
	        setGraphSessionMessages([]);
	      } finally {
        setGraphSessionMessagesLoading(false);
      }
    }
  }, [notebooks.activeNotebookId]);

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

  // ─── Command palette items ───
  const cmdPaletteCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];

    // Add/remove module commands
    Object.entries(WIDGET_REGISTRY).forEach(([id, meta]) => {
      const isActive = activeWidgetIds.includes(id);
      if (!isActive) {
        cmds.push({
          id: `add-${id}`,
          label: `添加模块: ${meta.label}`,
          icon: meta.icon,
          action: () => canvasRef.current?.addWidget(id),
        });
      } else {
        cmds.push({
          id: `remove-${id}`,
          label: `移除模块: ${meta.label}`,
          icon: meta.icon,
          action: () => canvasRef.current?.removeWidget(id),
        });
      }
    });

    // Lock/unlock
    cmds.push({
      id: 'toggle-lock',
      label: locked ? '解锁布局（进入编辑模式）' : '锁定布局',
      icon: locked ? '🔓' : '🔒',
      action: toggleLock,
    });

    // Session search
    cmds.push({
      id: 'session-search',
      label: '切换会话',
      icon: '💬',
      action: openSessionSearch,
    });

    // Knowledge graph
    cmds.push({
      id: 'open-graph',
      label: '打开知识图谱',
      icon: '🕸',
      action: () => {
        setIsGraphViewOpen(true);
        if (!analysis.analysis && !analysis.isLoading) {
          analysis.fetchAnalysis();
        }
      },
    });

    // Shortcut help
    cmds.push({
      id: 'shortcut-help',
      label: '快捷键帮助',
      icon: '⌨️',
      action: () => setIsShortcutHelpOpen(true),
    });

    return cmds;
  }, [activeWidgetIds, locked, toggleLock, openSessionSearch, analysis]);

  // ─── Widget header extras (e.g., SessionSwitcher in chat widget header) ───
  const widgetHeaderExtras = useMemo(() => ({
    chat: (
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
    ),
  }), [
    sessions.sessions,
    sessions.activeSessionId,
    isSessionSwitcherOpen,
    sessions.isLoading,
    sessions.error,
    sessions.isConnected,
    sessions.setActiveSessionId,
    sessions.createSession,
    sessions.updateSession,
    sessions.deleteSession,
    sessions.retrySessions,
  ]);

  // ─── Render widget content by id ───
  const renderWidget = useCallback(
    (widgetId: string) => {
      switch (widgetId) {
        case 'sources':
          return (
            <SourcesPanel
              sources={sources.sources}
              jumpToSource={jumpToSource}
              onUpload={sources.handleUpload}
              uploadState={sources.uploadState}
              uploadError={sources.uploadError}
              uploadQueue={sources.uploadQueue}
              onRetryUpload={sources.retryUpload}
              onClearUploadQueue={sources.clearUploadQueue}
              searchState={sources.searchState}
              searchNotice={sources.searchNotice}
              searchResults={sources.searchResults}
              onSearch={sources.handleSearch}
              onClearSearchResults={sources.clearSearchResults}
              onAddSourceFromUrl={sources.addSourceFromUrl}
              onRemoveSources={sources.removeSources}
              onRemoveSource={sources.removeSource}
              onBatchReembedSources={sources.batchReembedSources}
              sourceTags={sources.sourceTags}
              tagMutationState={sources.tagMutationState}
              onCreateSourceTag={sources.createSourceTag}
              onAssignTagToSources={sources.assignTagToSources}
              onRemoveTagFromSources={sources.removeTagFromSources}
              sortBy={sources.sortBy}
              sortOrder={sources.sortOrder}
              tagFilter={sources.tagFilter}
              onSortByChange={sources.setSortBy}
              onSortOrderChange={sources.setSortOrder}
              onTagFilterChange={sources.setTagFilter}
              isConnected={sources.isConnected}
              isLoading={sources.isLoading}
              removeState={sources.removeState}
              isFullscreen={false}
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
          );

        case 'chat':
          return (
            <ChatPanel
              messages={chat.messages}
              draft={chat.draft}
              onDraftChange={chat.setDraft}
              onSend={chat.sendMessage}
              onStopStreaming={chat.stopStreaming}
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
              hasSources={sources.sources.length > 0}
              onSaveToNote={refine.saveContentAsNote}
              onConvertToSource={chat.convertSessionToSource}
              onConvertToOutput={chat.convertSessionToOutput}
              isConverting={chat.isConverting}
            />
          );

        case 'studio':
          return (
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
              onCancelOutputJob={refine.cancelOutputJob}
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
              isFullscreen={false}
              hasSelectedSources={hasSelectedSources}
            />
          );

        default:
          return (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              未知模块
            </div>
          );
      }
    },
    [
      // sources
      sources, jumpToSource, activeNotebookId, handleSelectedSourceIdsChange,
      // chat
      chat, isConnected, errMessages, notebooks.activeNotebookId,
      handleChatCitationHover, handleChatCitationJump, handleLocateCitationSource,
      // studio
      refine, openSlidesDialog, handleOpenOutputViewer, handleOpenOutputViewerFullscreen,
      handleOutputCitationJump, hasSelectedSources,
    ],
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50/50 dark:bg-slate-950 overflow-hidden text-gray-900 dark:text-gray-100">
      {/* ── Header (fixed top bar – outside GridStack) ── */}
      <div className="flex-shrink-0 relative z-10 px-4 pt-1">
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
          onCreateNotebookFromTemplate={notebooks.createNotebookFromTemplate}
          onUpdateNotebook={notebooks.updateNotebook}
          onDeleteNotebook={notebooks.deleteNotebook}
          onSelectNotebook={notebooks.setActiveNotebookId}
          onOpenKnowledgeGraph={() => {
            setIsGraphViewOpen(true);
            if (!analysis.analysis && !analysis.isLoading) {
              analysis.fetchAnalysis();
            }
          }}
          locked={locked}
          onToggleLock={toggleLock}
          onOpenCatalog={() => setShowCatalog((v) => !v)}
          onOpenCommandPalette={() => { setShowCmdPalette(true); }}
        />
      </div>

      {/* ── Modular Canvas (GridStack layout) ── */}
      <ModularCanvas
        ref={canvasRef}
        defaultLayout={DEFAULT_LAYOUT}
        locked={locked}
        widgetMeta={WIDGET_REGISTRY}
        renderWidget={renderWidget}
        widgetHeaderExtras={widgetHeaderExtras}
        onWidgetIdsChange={setActiveWidgetIds}
      />

      {/* ── Command Palette ── */}
      <CommandPalette
        open={showCmdPalette}
        onClose={() => setShowCmdPalette(false)}
        commands={cmdPaletteCommands}
      />

      {/* ── Widget Catalog ── */}
      <WidgetCatalog
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        widgetMeta={WIDGET_REGISTRY}
        activeWidgetIds={activeWidgetIds}
        onAddWidget={(id) => canvasRef.current?.addWidget(id)}
      />

      {/* ── Shortcut Help ── */}
      <ShortcutHelpPanel
        open={isShortcutHelpOpen}
        shortcuts={WORKSPACE_SHORTCUTS}
        onClose={() => setIsShortcutHelpOpen(false)}
      />

      {/* ── Output Viewer ── */}
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

      {/* ── Slides Dialog ── */}
      {isSlidesDialogOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60"><div className="w-[420px]"><SkeletonCard lines={6} /></div></div>}>
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

      {/* ── Knowledge Graph View ── */}
      {isGraphViewOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60"><div className="w-[520px]"><SkeletonCard lines={6} /></div></div>}>
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

      {/* ── Source Detail Dialog for Graph View ── */}
      {graphSourceDetailOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60"><div className="w-[520px]"><SkeletonCard lines={5} /></div></div>}>
          <SourceDetailDialog
            open={graphSourceDetailOpen}
            source={graphSelectedSource}
            onClose={() => {
              setGraphSourceDetailOpen(false);
              setGraphSourceDetailFullscreen(false);
            }}
            isFullscreen={graphSourceDetailFullscreen}
            onToggleFullscreen={() => setGraphSourceDetailFullscreen((prev) => !prev)}
            onSaveQAAsSource={async (sourceTitle: string, messages) => {
              if (!graphSelectedSource) return;
              const qaMessages = messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              }));
              await sources.convertSourceQAToSource(graphSelectedSource.id, qaMessages);
            }}
          />
        </Suspense>
      )}

      {/* ── Source Detail Dialog for Citation Popovers ── */}
      {citationSourceDetailOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 dark:bg-gray-950/60"><div className="w-[520px]"><SkeletonCard lines={5} /></div></div>}>
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
            onSaveQAAsSource={handleCitationSaveQAAsSource}
          />
        </Suspense>
      )}

      {/* ── Session Detail Dialog for Graph View ── */}
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
