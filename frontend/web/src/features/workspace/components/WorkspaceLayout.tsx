import { useCallback, useEffect, useRef, useState } from 'react';

import ChatPanel from './ChatPanel';
import RefinePanel from './RefinePanel';
import SessionSwitcher from './SessionSwitcher';
import SourcesPanel from './SourcesPanel';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceTabs from './WorkspaceTabs';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import { useChat } from '../hooks/useChat';
import { useNotebooks } from '../hooks/useNotebooks';
import { useRefine } from '../hooks/useRefine';
import { useSessions } from '../hooks/useSessions';
import { useSources } from '../hooks/useSources';
import type { PanelId, SourceItem } from '../types';
import { buildSourceSummaryPrompt } from '../utils';

export default function WorkspaceLayout() {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const [pendingChatFocus, setPendingChatFocus] = useState(false);
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState(false);
  const [outputTypeOpen, setOutputTypeOpen] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const sessionSearchRef = useRef<HTMLInputElement | null>(null);

  const notebooks = useNotebooks();
  const sessions = useSessions();
  const sources = useSources();
  const chat = useChat({
    ensureSession: sessions.ensureSession,
    refreshSessions: sessions.refreshSessions,
  });
  const refine = useRefine();

  const setActivePanel = useCallback(
    (panel: PanelId) => {
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: panel });
    },
    [dispatch],
  );

  useEffect(() => {
    if (!pendingChatFocus) return;
    if (state.activePanel !== 'chat') return;
    const input = chatInputRef.current;
    if (input) {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }
    setPendingChatFocus(false);
  }, [pendingChatFocus, state.activePanel]);

  useEffect(() => {
    if (notebooks.activeNotebookId) return;
    if (!createInputRef.current) return;
    createInputRef.current.focus();
  }, [notebooks.activeNotebookId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        setSessionSwitcherOpen(true);
        sessionSearchRef.current?.focus();
        return;
      }
      if (event.key === 'Escape') {
        setSessionSwitcherOpen(false);
        setOutputTypeOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSourceClick = useCallback(
    (source: SourceItem) => {
      chat.setDraft(buildSourceSummaryPrompt(source.title));
      setActivePanel('chat');
      setPendingChatFocus(true);
    },
    [chat.setDraft, setActivePanel],
  );

  const handleSuggestionSelect = useCallback(
    (question: string) => {
      chat.applySuggestion(question);
      setPendingChatFocus(true);
    },
    [chat.applySuggestion],
  );

  const handleCitationJump = useCallback(
    (chunkId: number | null) => {
      if (!chunkId) return;
      sources.setJumpToCitationChunkId(chunkId);
      sources.setHoveredCitationChunkId(chunkId);
      setActivePanel('sources');
    },
    [setActivePanel, sources.setJumpToCitationChunkId, sources.setHoveredCitationChunkId],
  );

  const handleMessageHover = useCallback(
    (chunkIds: number[] | null) => {
      sources.setHoveredMessageChunkIds(chunkIds);
    },
    [sources.setHoveredMessageChunkIds],
  );

  const handleRetrySources = useCallback(() => {
    if (notebooks.notebooksError) {
      void notebooks.retryNotebooks();
      return;
    }
    void sources.retrySources();
  }, [notebooks.notebooksError, notebooks.retryNotebooks, sources.retrySources]);

  return (
    <div className="WorkspaceApp">
      <WorkspaceHeader
        notebooks={notebooks.notebooks}
        activeNotebookId={notebooks.activeNotebookId}
        onNotebookChange={notebooks.setActiveNotebookId}
        statusLabel={notebooks.statusLabel}
      />

      <WorkspaceTabs activePanel={state.activePanel} onChange={setActivePanel} />

      <main className="WorkspaceMain" aria-label="三栏工作区">
        <section
          className={`WorkspacePanel WorkspacePanel--sources ${
            state.activePanel === 'sources' ? 'isActive' : ''
          }`}
          aria-label="来源与引用"
        >
          <div className="WorkspacePanelHeader">
            <h2 className="WorkspacePanelTitle">来源与引用</h2>
            <div className="WorkspaceTiny">
              笔记本：{notebooks.notebooks.find((item) => item.id === notebooks.activeNotebookId)
                ?.title ?? '-'}
            </div>
          </div>
          <SourcesPanel
            sources={sources.sources}
            citations={sources.citations}
            selectedCitationIds={sources.selectedCitationIds}
            autoSelectCitations={sources.autoSelectCitations}
            onToggleCitation={sources.toggleCitation}
            onSelectAllCitations={sources.selectAllCitations}
            onClearCitationSelection={sources.clearCitationSelection}
            onToggleAutoSelectCitations={sources.toggleAutoSelect}
            onSourceClick={handleSourceClick}
            onSendSelectedCitations={refine.onGenerateRefine}
            onCompareSelectedCitations={refine.onCompareSelected}
            onCopySelectedCitations={sources.copySelectedCitations}
            onCitationHover={sources.setHoveredCitationChunkId}
            highlightedChunkIds={sources.highlightedChunkIds}
            jumpToCitationChunkId={sources.jumpToCitationChunkId}
            onUpload={sources.handleUpload}
            uploadState={sources.uploadState}
            isDemo={sources.isDemo}
            error={sources.error || notebooks.notebooksError}
            showCreate={!notebooks.activeNotebookId}
            createName={notebooks.createName}
            onCreateNameChange={notebooks.setCreateName}
            onCreate={notebooks.createNotebook}
            createState={notebooks.createState}
            createError={notebooks.createError}
            createInputRef={createInputRef}
            isLoading={sources.isLoading}
            onRetry={handleRetrySources}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--chat ${
            state.activePanel === 'chat' ? 'isActive' : ''
          }`}
          aria-label="聊天"
        >
          <div className="WorkspacePanelHeader">
            <div>
              <h2 className="WorkspacePanelTitle">聊天</h2>
              <div className="WorkspaceTiny">输入 → 对话 → 输出中心</div>
            </div>
            <SessionSwitcher
              sessions={sessions.sessions}
              activeSessionId={sessions.activeSessionId}
              isOpen={sessionSwitcherOpen}
              isLoading={sessions.isLoading}
              error={sessions.error}
              isDemo={sessions.isDemo}
              searchInputRef={sessionSearchRef}
              onToggle={() => setSessionSwitcherOpen((prev) => !prev)}
              onClose={() => setSessionSwitcherOpen(false)}
              onSelect={sessions.setActiveSessionId}
              onCreate={() => sessions.createSession()}
              onRetry={sessions.retrySessions}
            />
          </div>
          <ChatPanel
            messages={chat.messages}
            draft={chat.draft}
            onDraftChange={chat.setDraft}
            onSend={chat.sendMessage}
            isSending={chat.isSending}
            notice={chat.sendError}
            isBlocked={!notebooks.activeNotebookId}
            inputRef={chatInputRef}
            highlightedChunkIds={sources.highlightedChunkIds}
            citations={sources.citations}
            onCitationHover={sources.setHoveredCitationChunkId}
            onCitationJump={handleCitationJump}
            onMessageHover={handleMessageHover}
            suggestions={chat.suggestions}
            suggestionsLoading={chat.suggestionsLoading}
            suggestionsError={chat.suggestionsError}
            onSuggestionSelect={handleSuggestionSelect}
            onRetrySuggestions={chat.retrySuggestions}
            isLoadingMessages={state.loading.messages}
            messagesError={state.errors.messages}
            onRetryMessages={chat.retryMessages}
          />
        </section>

        <section
          className={`WorkspacePanel WorkspacePanel--refine ${
            state.activePanel === 'refine' ? 'isActive' : ''
          }`}
          aria-label="输出中心"
        >
          <div className="WorkspacePanelHeader WorkspacePanelHeader--refine">
            <h2 className="WorkspacePanelTitle OutputCenterTitle">
              输出中心
              {refine.hasNewOutput ? (
                <span className="OutputCenterDot" aria-label="有新输出" />
              ) : null}
            </h2>
            <div className="OutputHeaderActions">
              <button
                type="button"
                className="OutputClearButton"
                onClick={refine.onClearJobs}
                disabled={refine.refineJobs.length === 0}
                title="清空输出历史"
              >
                清空提炼
              </button>
              <button
                type="button"
                className="OutputClearButton"
                onClick={refine.onClearOutputs}
                disabled={refine.outputs.length === 0}
                title="清空结构化输出"
              >
                清空结构化
              </button>
            </div>
          </div>
          <RefinePanel
            mode={refine.refineMode}
            onModeChange={refine.setRefineMode}
            isBlocked={!notebooks.activeNotebookId}
            selectedCitationCount={sources.selectedCount}
            prompt={refine.refinePrompt}
            onPromptChange={refine.setRefinePrompt}
            onGenerate={refine.onGenerateRefine}
            templates={refine.refineTemplates}
            jobs={refine.refineJobs}
            onTogglePin={refine.onTogglePin}
            onDeleteJob={refine.onDeleteJob}
            settings={refine.refineSettings}
            onToggleSetting={refine.onToggleSetting}
            highlightedJobId={refine.recentCompletedJobId}
            outputTypeOptions={refine.outputTypeOptions}
            outputType={refine.outputType}
            onOutputTypeChange={refine.setOutputType}
            isOutputTypeOpen={outputTypeOpen}
            onToggleOutputType={() => setOutputTypeOpen((prev) => !prev)}
            onCloseOutputType={() => setOutputTypeOpen(false)}
            outputs={refine.outputs}
            outputQueueJobs={refine.outputQueueJobs}
            queueSummary={refine.queueSummary}
            outputsLoading={refine.outputsLoading}
            outputsError={refine.outputsError}
            onGenerateOutput={refine.onGenerateOutput}
            onRetryOutputs={refine.retryOutputs}
            onReplayRefineJob={refine.onReplayRefineJob}
            onReplayOutput={refine.onReplayOutput}
            onDeleteOutput={refine.onDeleteOutput}
          />
        </section>
      </main>
    </div>
  );
}
