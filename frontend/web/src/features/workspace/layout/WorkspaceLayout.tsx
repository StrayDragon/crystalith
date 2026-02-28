import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatPanel from '../domains/messages/ChatPanel';
import SessionSwitcher from '../domains/sessions/SessionSwitcher';
import type { ChatMessage as SourceDialogMessage } from '../domains/sources/SourceDetailDialog';
import SourcesPanel from '../domains/sources/SourcesPanel';
import StudioPanel from '../domains/studio/StudioPanel';
import { useAnalysis } from '../domains/analysis/useAnalysis';
import { useChat } from '../domains/messages/useChat';
import { useNotebooks } from '../domains/notebooks/useNotebooks';
import { useRefine } from '../domains/refine/useRefine';
import { useSessions } from '../domains/sessions/useSessions';
import { useSources } from '../domains/sources/useSources';
import { useKeyboardShortcuts, type KeyboardShortcutBinding } from '../shared/hooks/useKeyboardShortcuts';
import { getSlideIdFromOutput } from '../shared/outputPayload';
import { useWorkspaceStore } from '../shared/state/workspaceStore';
import type { ChatMessage, Citation, SourceItem } from '../shared/types';
import { exportOutputJsonDownload, exportOutputMarkdownDownload, exportQaJsonDownload, exportQaMarkdownDownload } from '../shared/evidenceExport';
import { toast } from '../../../shared/toast';
import { computeWorkspaceReadiness, useDependencyHealth, useWorkspaceOverlays } from './hooks';
import WorkspaceOnboardingBanner from './components/WorkspaceOnboardingBanner';
import WorkspaceHeader from './WorkspaceHeader';
import {
  ModularCanvas,
  type CommandItem,
  DEFAULT_LAYOUT,
  type ModularCanvasHandle,
  WIDGET_REGISTRY,
} from './modular-canvas';
import { WorkspaceOverlays } from './overlays';
import AddSourceFromUrlDialog from './overlays/AddSourceFromUrlDialog';
import DiagnosticsDialog from './overlays/DiagnosticsDialog';

export default function WorkspaceLayout() {
  const selectedSourceIds_raw = useWorkspaceStore((s) => s.selectedSourceIds);
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const autoCreatedNotebookId = useWorkspaceStore((s) => s.autoCreatedNotebookId);
  const errMessages = useWorkspaceStore((s) => s.errors.messages);
  const store = useWorkspaceStore;

  const canvasRef = useRef<ModularCanvasHandle>(null);
  const [locked, setLocked] = useState(true);
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>([]);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionSearchRef = useRef<HTMLInputElement | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [addSourceFromUrlOpen, setAddSourceFromUrlOpen] = useState(false);

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

  const resolveSlideDraftId = useCallback(
    (outputId: number) => {
      const output = refine.outputs.find((item) => item.id === outputId);
      if (!output) return null;
      return getSlideIdFromOutput(output);
    },
    [refine.outputs],
  );

  const fetchAnalysisIfNeeded = useCallback(() => {
    if (!analysis.analysis && !analysis.isLoading) {
      void analysis.fetchAnalysis();
    }
  }, [analysis.analysis, analysis.isLoading, analysis.fetchAnalysis]);

  const overlays = useWorkspaceOverlays({
    activeNotebookId,
    resolveSlideDraftId,
    fetchAnalysisIfNeeded,
  });

  const dependencyHealth = useDependencyHealth({ enabled: overlays.isDiagnosticsOpen });

  const slidesQueueStatus = useMemo(() => {
    if (!overlays.slidesQueueJobId) return null;
    const job = refine.outputQueueJobs.find((item) => item.id === overlays.slidesQueueJobId);
    return job?.status ?? null;
  }, [overlays.slidesQueueJobId, refine.outputQueueJobs]);

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
      overlays.openCitationSourceDetail(source);
    },
    [overlays, resolveCitationSource],
  );

  const handleLocateCitationSource = useCallback(
    (citation: Citation) => {
      const source = resolveCitationSource(citation);
      if (!source) {
        toast.error('未找到对应来源，请先同步来源列表。');
        return;
      }
      overlays.locateCitationSource(source.id);
    },
    [overlays, resolveCitationSource],
  );

  const handleCitationSaveQAAsSource = useCallback(
    async (_sourceTitle: string, messages: SourceDialogMessage[]) => {
      if (!overlays.citationSelectedSource || !sources.convertSourceQAToSource) return;
      const qaMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await sources.convertSourceQAToSource(overlays.citationSelectedSource.id, qaMessages);
    },
    [overlays.citationSelectedSource, sources.convertSourceQAToSource],
  );

  const handleSaveGraphSourceQAAsSource = useCallback(
    async (_sourceTitle: string, messages: SourceDialogMessage[]) => {
      if (!overlays.graphSelectedSource || !sources.convertSourceQAToSource) return;
      const qaMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      await sources.convertSourceQAToSource(overlays.graphSelectedSource.id, qaMessages);
    },
    [overlays.graphSelectedSource, sources.convertSourceQAToSource],
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

  const focusPanel = useCallback(
    (panel: 'sources' | 'chat' | 'studio') => {
      const nextActivePanel = panel === 'studio' ? 'refine' : panel;
      store.getState().setActivePanel(nextActivePanel);
    },
    [store],
  );

  const openSessionSearch = useCallback(() => {
    overlays.openSessionSwitcher();
    window.requestAnimationFrame(() => {
      sessionSearchRef.current?.focus();
      sessionSearchRef.current?.select();
    });
  }, [overlays]);

  const createNotebookByShortcut = useCallback(() => {
    void notebooks.createNotebookQuick('未命名笔记本');
  }, [notebooks]);

  const toggleLock = useCallback(() => {
    setLocked((prev) => !prev);
  }, []);

  const shortcutBindings = useMemo<KeyboardShortcutBinding[]>(
    () => [
      {
        id: 'open-command-palette',
        combo: 'Ctrl+K',
        handler: () => {
          overlays.toggleCommandPalette();
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
          if (overlays.closeActiveOverlay()) {
            event.preventDefault();
          }
        },
      },
      {
        id: 'open-shortcut-help',
        combo: 'Ctrl+?',
        handler: () => {
          overlays.openShortcutHelp();
        },
      },
    ],
    [
      chat.isSending,
      chat.sendMessage,
      createNotebookByShortcut,
      focusPanel,
      notebooks.activeNotebookId,
      overlays,
    ],
  );

  useKeyboardShortcuts(shortcutBindings);

  useEffect(() => {
    if (!overlays.isViewerOpen) return;
    if (refine.outputs.length === 0) {
      overlays.closeOutputViewer();
      overlays.setViewerOutputId(null);
      return;
    }
    if (
      overlays.viewerOutputId &&
      refine.outputs.some((item) => item.id === overlays.viewerOutputId)
    ) {
      return;
    }
    overlays.setViewerOutputId(refine.outputs[0].id);
  }, [overlays, refine.outputs]);

  const isConnected = notebooks.isConnected;

  const readiness = useMemo(
    () =>
      computeWorkspaceReadiness({
        connectionState: notebooks.connectionState,
        connectionError: notebooks.notebooksError,
        notebookId: notebooks.activeNotebookId,
        sourcesLoading: sources.isLoading,
        sourcesCount: sources.sources.length,
        sessionsLoading: sessions.isLoading,
        sessionId: sessions.activeSessionId,
      }),
    [
      notebooks.activeNotebookId,
      notebooks.connectionState,
      notebooks.notebooksError,
      sessions.activeSessionId,
      sessions.isLoading,
      sources.isLoading,
      sources.sources.length,
    ],
  );

  const showReadyGuide = useMemo(() => {
    return readiness.kind === 'ready' && chat.messages.length === 0 && refine.outputs.length === 0;
  }, [chat.messages.length, readiness.kind, refine.outputs.length]);

  const handleOpenDeploymentDocs = useCallback(() => {
    window.open(
      'https://github.com/StrayDragon/crystalith/blob/main/deployments/README.md',
      '_blank',
      'noopener,noreferrer',
    );
  }, []);

  const handleOpenDiagnostics = useCallback(() => {
    overlays.openDiagnostics();
  }, [overlays.openDiagnostics]);

  const handleOpenUpload = useCallback(() => {
    uploadFileInputRef.current?.click();
  }, []);

  const handleFocusSourceSearch = useCallback(() => {
    const el = document.getElementById('source-search-input') as HTMLInputElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
    el.select();
  }, []);

  const handleFocusChat = useCallback(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
  }, []);

  const handleStartSession = useCallback(async () => {
    await sessions.ensureSession();
    window.requestAnimationFrame(() => {
      handleFocusChat();
    });
  }, [handleFocusChat, sessions.ensureSession]);

  const handleCreateNotebookFromOnboarding = useCallback(async () => {
    const ok = await notebooks.createNotebookQuick('未命名笔记本');
    if (ok) {
      toast.success('已创建笔记本');
    }
  }, [notebooks.createNotebookQuick]);

  const handleOpenAddSourceFromUrl = useCallback(() => {
    setAddSourceFromUrlOpen(true);
  }, []);

  const handleCloseAddSourceFromUrl = useCallback(() => {
    setAddSourceFromUrlOpen(false);
  }, []);

  const handleAddSourceFromUrl = useCallback(
    async (url: string, mode: Parameters<typeof sources.addSourceFromUrl>[1]) => {
      await sources.addSourceFromUrl(url, mode);
      toast.success('已添加来源');
    },
    [sources.addSourceFromUrl],
  );

  const cmdPaletteCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];

    // Core onboarding actions
    cmds.push({
      id: 'create-notebook',
      label: '新建笔记本',
      icon: '📓',
      action: () => {
        void handleCreateNotebookFromOnboarding();
      },
    });

    notebooks.notebooks.slice(0, 12).forEach((notebook) => {
      cmds.push({
        id: `switch-notebook-${notebook.id}`,
        label:
          notebook.id === notebooks.activeNotebookId
            ? `切换笔记本: ${notebook.title}（当前）`
            : `切换笔记本: ${notebook.title}`,
        icon: notebook.id === notebooks.activeNotebookId ? '✅' : '📓',
        action: () => {
          notebooks.setActiveNotebookId(notebook.id);
        },
      });
    });

    cmds.push({
      id: 'import-sources-upload',
      label: '导入来源: 上传文件',
      icon: '⬆️',
      action: handleOpenUpload,
    });

    cmds.push({
      id: 'import-sources-url',
      label: '导入来源: 从 URL',
      icon: '🔗',
      action: handleOpenAddSourceFromUrl,
    });

    cmds.push({
      id: 'import-sources-search',
      label: '导入来源: 搜索',
      icon: '🔍',
      action: handleFocusSourceSearch,
    });

    cmds.push({
      id: 'start-session',
      label: '开始会话',
      icon: '💬',
      action: () => {
        void handleStartSession();
      },
    });

    if (activeNotebookId && activeSessionId && isConnected) {
      cmds.push({
        id: 'export-qa-markdown',
        label: '导出当前会话（Markdown，含引用）',
        icon: '⬇️',
        action: () => {
          exportQaMarkdownDownload({ notebookId: activeNotebookId, sessionId: activeSessionId });
        },
      });

      cmds.push({
        id: 'export-qa-json',
        label: '导出当前会话（JSON，含引用）',
        icon: '⬇️',
        action: () => {
          void exportQaJsonDownload({ notebookId: activeNotebookId, sessionId: activeSessionId });
        },
      });
    }

    if (activeNotebookId && isConnected) {
      const outputId = overlays.viewerOutputId ?? refine.outputs[0]?.id ?? null;
      if (outputId) {
        cmds.push({
          id: 'export-output-markdown',
          label: '导出当前 Output（Markdown，含引用）',
          icon: '📝',
          action: () => {
            exportOutputMarkdownDownload({ notebookId: activeNotebookId, outputId });
          },
        });

        cmds.push({
          id: 'export-output-json',
          label: '导出当前 Output（JSON，含引用）',
          icon: '🧾',
          action: () => {
            void exportOutputJsonDownload({ notebookId: activeNotebookId, outputId });
          },
        });
      }
    }

    cmds.push({
      id: 'open-slides-studio',
      label: '打开 Slides Studio',
      icon: '🖼️',
      action: () => overlays.openSlidesDialog('config'),
    });

    cmds.push({
      id: 'open-diagnostics',
      label: '健康 / 诊断',
      icon: '🩺',
      action: overlays.openDiagnostics,
    });

    cmds.push({
      id: 'shortcut-help',
      label: '快捷键帮助',
      icon: '⌨️',
      action: overlays.openShortcutHelp,
    });

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

    cmds.push({
      id: 'toggle-lock',
      label: locked ? '解锁布局（进入编辑模式）' : '锁定布局',
      icon: locked ? '🔓' : '🔒',
      action: toggleLock,
    });

    cmds.push({
      id: 'session-search',
      label: '切换会话',
      icon: '💬',
      action: openSessionSearch,
    });

    cmds.push({
      id: 'open-graph',
      label: '打开知识图谱',
      icon: '🕸',
      action: overlays.openGraphView,
    });

    return cmds;
  }, [
    activeWidgetIds,
    activeNotebookId,
    activeSessionId,
    handleCreateNotebookFromOnboarding,
    handleFocusSourceSearch,
    handleOpenAddSourceFromUrl,
    handleOpenUpload,
    handleStartSession,
    isConnected,
    locked,
    notebooks.activeNotebookId,
    notebooks.notebooks,
    notebooks.setActiveNotebookId,
    openSessionSearch,
    overlays,
    refine.outputs,
    toggleLock,
  ]);

  const widgetHeaderExtras = useMemo(
    () => ({
      chat: (
        <SessionSwitcher
          sessions={sessions.sessions}
          activeSessionId={sessions.activeSessionId}
          isOpen={overlays.isSessionSwitcherOpen}
          isLoading={sessions.isLoading}
          error={sessions.error}
          isConnected={sessions.isConnected}
          searchInputRef={sessionSearchRef}
          onToggle={overlays.toggleSessionSwitcher}
          onClose={overlays.closeSessionSwitcher}
          onSelect={sessions.setActiveSessionId}
          onCreate={async () => {
            await sessions.createSession();
          }}
          onUpdate={sessions.updateSession}
          onDelete={sessions.deleteSession}
          onRetry={sessions.retrySessions}
        />
      ),
    }),
    [overlays, sessions],
  );

  const renderWidget = useCallback(
    (widgetId: string) => {
      switch (widgetId) {
        case 'sources':
          return (
            <SourcesPanel
              sources={sources.sources}
              jumpToSource={overlays.jumpToSource}
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
                overlays.openSlidesDialog(
                  mode,
                  options?.slideId ?? null,
                  options?.queueJobId ?? null,
                );
              }}
              onDeleteOutput={refine.onDeleteOutput}
              onSelectOutput={overlays.openOutputViewer}
              onSelectOutputFullscreen={overlays.openOutputViewerFullscreen}
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
      activeNotebookId,
      chat,
      errMessages,
      handleChatCitationHover,
      handleChatCitationJump,
      handleLocateCitationSource,
      handleOutputCitationJump,
      handleSelectedSourceIdsChange,
      hasSelectedSources,
      isConnected,
      notebooks.activeNotebookId,
      overlays,
      refine,
      sources,
    ],
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50/50 dark:bg-slate-950 overflow-hidden text-gray-900 dark:text-gray-100">
      <input
        ref={uploadFileInputRef}
        type="file"
        hidden
        multiple
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        onChange={(event) => {
          sources.handleUpload(event.target.files);
          if (event.target) {
            event.target.value = '';
          }
        }}
      />

      <AddSourceFromUrlDialog
        open={addSourceFromUrlOpen}
        onClose={handleCloseAddSourceFromUrl}
        onAdd={handleAddSourceFromUrl}
      />

      <DiagnosticsDialog
        open={overlays.isDiagnosticsOpen}
        onClose={overlays.closeDiagnostics}
        isLoading={dependencyHealth.isLoading}
        error={dependencyHealth.error}
        data={dependencyHealth.data}
        onRefresh={dependencyHealth.refresh}
      />

      <div className="flex-shrink-0 relative z-10 px-4 pt-1">
        <WorkspaceHeader
          notebooks={notebooks.notebooks}
          activeNotebookId={notebooks.activeNotebookId}
          autoCreatedNotebookId={autoCreatedNotebookId}
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
          onOpenKnowledgeGraph={overlays.openGraphView}
          onOpenDiagnostics={overlays.openDiagnostics}
          onOpenShortcutHelp={overlays.openShortcutHelp}
          locked={locked}
          onToggleLock={toggleLock}
          onOpenCatalog={overlays.toggleCatalog}
          onOpenCommandPalette={overlays.openCommandPalette}
        />

        <WorkspaceOnboardingBanner
          readiness={readiness}
          showReadyGuide={showReadyGuide}
          onRetryConnection={notebooks.retryNotebooks}
          onOpenDiagnostics={handleOpenDiagnostics}
          onOpenDeploymentDocs={handleOpenDeploymentDocs}
          onCreateNotebook={handleCreateNotebookFromOnboarding}
          onUploadSources={handleOpenUpload}
          onAddSourceFromUrl={handleOpenAddSourceFromUrl}
          onFocusSourceSearch={handleFocusSourceSearch}
          onStartSession={handleStartSession}
          onFocusChat={handleFocusChat}
          onOpenSlidesStudio={() => overlays.openSlidesDialog('config')}
          onOpenCommandPalette={overlays.openCommandPalette}
          onOpenShortcutHelp={overlays.openShortcutHelp}
        />
      </div>

      <ModularCanvas
        ref={canvasRef}
        defaultLayout={DEFAULT_LAYOUT}
        locked={locked}
        widgetMeta={WIDGET_REGISTRY}
        renderWidget={renderWidget}
        widgetHeaderExtras={widgetHeaderExtras}
        onWidgetIdsChange={setActiveWidgetIds}
      />

      <WorkspaceOverlays
        commandPaletteOpen={overlays.showCommandPalette}
        onCloseCommandPalette={overlays.closeCommandPalette}
        commandPaletteCommands={cmdPaletteCommands}
        catalogOpen={overlays.showCatalog}
        onCloseCatalog={overlays.closeCatalog}
        activeWidgetIds={activeWidgetIds}
        onAddWidget={(id) => canvasRef.current?.addWidget(id)}
        shortcutHelpOpen={overlays.isShortcutHelpOpen}
        onCloseShortcutHelp={overlays.closeShortcutHelp}
        outputs={refine.outputs}
        viewerOutputId={overlays.viewerOutputId}
        viewerOpen={overlays.isViewerOpen}
        viewerFullscreen={overlays.isViewerFullscreen}
        viewerElevated={overlays.isViewerElevated}
        onCloseViewer={overlays.closeOutputViewer}
        onToggleViewerFullscreen={overlays.toggleOutputViewer}
        onSelectViewerOutput={overlays.selectOutput}
        onDeleteOutput={refine.onDeleteOutput}
        onOutputCitationJump={handleOutputCitationJump}
        onCitationHover={handleChatCitationHover}
        onLocateCitationSource={handleLocateCitationSource}
        slidesDialogOpen={overlays.isSlidesDialogOpen}
        onCloseSlidesDialog={overlays.closeSlidesDialog}
        notebookId={activeNotebookId}
        selectedSourceIds={selectedSourceIds}
        isConnected={isConnected}
        onOutputsUpdated={refine.retryOutputs}
        slidesOpenMode={overlays.slidesOpenMode}
        slidesDraftId={overlays.slidesDraftId}
        slidesQueueStatus={slidesQueueStatus}
        onQueueSlides={refine.onQueueSlides}
        graphViewOpen={overlays.isGraphViewOpen}
        onCloseGraphView={overlays.closeGraphView}
        onRefreshGraph={analysis.fetchAnalysis}
        onGraphSourceClick={overlays.openGraphSourceDetail}
        onGraphOutputClick={(output) => overlays.openOutputViewer(output.id, true)}
        onGraphSessionClick={overlays.handleGraphSessionClick}
        graphSources={sources.sources}
        graphOutputs={refine.outputs}
        graphSessions={sessions.sessions}
        graphMessages={chat.messages}
        graphAnalysis={analysis.analysis}
        graphAnalysisLoading={analysis.isLoading}
        graphAnalysisError={analysis.error}
        activeSessionId={activeSessionId}
        graphConnected={analysis.isConnected}
        graphSourceDetailOpen={overlays.graphSourceDetailOpen}
        graphSelectedSource={overlays.graphSelectedSource}
        onCloseGraphSourceDetail={overlays.closeGraphSourceDetail}
        graphSourceDetailFullscreen={overlays.graphSourceDetailFullscreen}
        onToggleGraphSourceDetailFullscreen={overlays.toggleGraphSourceDetailFullscreen}
        onSaveGraphSourceQAAsSource={handleSaveGraphSourceQAAsSource}
        citationSourceDetailOpen={overlays.citationSourceDetailOpen}
        citationSelectedSource={overlays.citationSelectedSource}
        onCloseCitationSourceDetail={overlays.closeCitationSourceDetail}
        citationSourceDetailFullscreen={overlays.citationSourceDetailFullscreen}
        onToggleCitationSourceDetailFullscreen={overlays.toggleCitationSourceDetailFullscreen}
        onSaveCitationSourceQAAsSource={handleCitationSaveQAAsSource}
        graphSessionDetailOpen={overlays.graphSessionDetailOpen}
        graphSelectedSession={overlays.graphSelectedSession}
        graphSessionMessages={overlays.graphSessionMessages}
        onCloseGraphSessionDetail={overlays.closeGraphSessionDetail}
        graphSessionDetailFullscreen={overlays.graphSessionDetailFullscreen}
        onToggleGraphSessionDetailFullscreen={overlays.toggleGraphSessionDetailFullscreen}
        graphSessionMessagesLoading={overlays.graphSessionMessagesLoading}
      />
    </div>
  );
}
