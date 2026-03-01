import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Virtuoso } from 'react-virtuoso';
import {
  IconButton,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Spinner,
} from '@material-tailwind/react';
import {
  DriveFileMove as ConvertIcon,
  Notes as NotesIcon,
  Source as SourceIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';

import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';
import CitationsControl from '../../shared/components/citations/CitationsControl';
import { IconCopy, IconSave, IconSend } from '../../shared/components/Icons';
import { SkeletonList } from '../../shared/components/Skeleton';
import { LAYER_LEVELS } from '../../../../shared/layer';
import { copyToClipboard } from '../../../../shared/clipboard';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { exportQaJsonDownload, exportQaMarkdownDownload } from '../../shared/evidenceExport';
import { parseChatUiEnvelope } from './chatUiEnvelope';
import { chatUiComponentRegistry } from './chatUiRegistry';
import JsonFallbackCard from './components/JsonFallbackCard';
import ToolActionCard from './components/ToolActionCard';

interface ChatPanelProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStopStreaming?: () => void;
  isSending: boolean;
  isStreaming?: boolean;
  streamingMessageId?: string | null;
  notice: string;
  onRetrySend?: () => void;
  isBlocked: boolean;
  isConnected: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  citations: Citation[];
  onCitationHover?: (chunkId: number | null, message: ChatMessage) => void;
  onCitationJump?: (citation: Citation, message: ChatMessage) => void;
  onCitationLocate?: (citation: Citation, message: ChatMessage) => void;
  isLoadingMessages: boolean;
  messagesError: string;
  onRetryMessages: () => void;
  hasSources?: boolean;
  onSaveToNote?: (content: string) => void;
  // Conversion callbacks
  onConvertToSource?: () => Promise<void>;
  onConvertToOutput?: (outputType: OutputTypeId) => Promise<void>;
  isConverting?: boolean;
}

function ChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  onStopStreaming,
  isSending,
  isStreaming = false,
  streamingMessageId = null,
  notice,
  onRetrySend,
  isBlocked,
  isConnected,
  inputRef,
  citations,
  onCitationHover,
  onCitationJump,
  onCitationLocate,
  isLoadingMessages,
  messagesError,
  onRetryMessages,
  hasSources = false,
  onSaveToNote,
  onConvertToSource,
  onConvertToOutput,
  isConverting = false,
}: ChatPanelProps) {
  const notebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const sessionId = useWorkspaceStore((s) => s.activeSessionId);
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg?.role === 'assistant') return msg.id;
    }
    return null;
  }, [messages]);

  const citationIndexMap = useMemo(() => {
    const map = new Map<number, { citation: Citation; index: number }>();
    citations.forEach((citation, index) => {
      if (citation.chunkId == null) return;
      map.set(citation.chunkId, { citation, index: index + 1 });
    });
    return map;
  }, [citations]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toolRuns, setToolRuns] = useState<Record<string, { status: 'pending' | 'running' | 'success' | 'error'; outputText?: string | null; errorMessage?: string | null }>>({});
  const autoExecSeenRef = useRef(new Set<string>());
  const toolInFlightRef = useRef(new Set<string>());

  const shouldRenderMessageList =
    isConnected &&
    !isBlocked &&
    !isLoadingMessages &&
    !messagesError &&
    messages.length > 0;

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const runQaExportPreview = useCallback(
    async (params: { format: 'markdown' | 'json'; messageId: number }) => {
      if (notebookId == null || sessionId == null) {
        throw new Error('未选择会话，无法导出预览。');
      }
      const query = new URLSearchParams();
      query.set('session_id', String(sessionId));
      query.set('message_id', String(params.messageId));
      query.set('format', params.format);
      const url = `/v1/notebooks/${notebookId}/qa/export?${query.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`请求失败: HTTP ${resp.status}`);
      }
      if (params.format === 'json') {
        const data = (await resp.json()) as unknown;
        const text = JSON.stringify(data, null, 2);
        return text.length > 4000 ? text.slice(0, 4000) + '\n…' : text;
      }
      const text = await resp.text();
      return text.length > 4000 ? text.slice(0, 4000) + '\n…' : text;
    },
    [notebookId, sessionId],
  );

  const renderMessage = (message: ChatMessage) => {
    const numericMessageId = Number(message.id);
    const canExportMessage =
      message.role === 'assistant' &&
      isConnected &&
      notebookId != null &&
      sessionId != null &&
      Number.isFinite(numericMessageId) &&
      numericMessageId > 0;

    const parsedAssistantContent =
      message.role === 'assistant' ? parseChatUiEnvelope(message.content) : null;
    const assistantFallbackText = parsedAssistantContent?.fallbackText ?? message.content;
    const assistantEnvelope = parsedAssistantContent?.envelope ?? null;

    const toolResultByUseId = new Map<string, { status: 'success' | 'error'; outputText?: string | null; errorMessage?: string | null }>();
    if (assistantEnvelope) {
      for (const part of assistantEnvelope.parts) {
        if (part.type !== 'tool_result') continue;
        const outputText = part.output ? JSON.stringify(part.output, null, 2) : null;
        toolResultByUseId.set(part.tool_use_id, {
          status: part.status,
          outputText: outputText && outputText.length > 4000 ? outputText.slice(0, 4000) + '\n…' : outputText,
          errorMessage: part.error_message ?? null,
        });
      }
    }

    const messageCitationEntries =
      message.citations && message.citations.length > 0
        ? message.citations.map((citation, index) => {
            const chunkId = citation.chunkId ?? null;
            const mapped = chunkId != null ? citationIndexMap.get(chunkId) ?? null : null;
            return {
              citation,
              index: mapped?.index ?? index + 1,
            };
          })
        : (message.citationChunkIds ?? [])
            .map((chunkId) => citationIndexMap.get(chunkId))
            .filter(
              (entry): entry is { citation: Citation; index: number } =>
                Boolean(entry),
            );

    const typingCursor =
      message.role === 'assistant' && isStreaming && streamingMessageId === message.id ? (
        <span className="TypingCursor" aria-hidden="true" />
      ) : null;

    return (
      <div
        className={`flex flex-col gap-2 pb-4 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
        data-testid="chat-message-item"
      >
        <div
          className={`text-sm leading-relaxed ${
            message.role === 'user'
              ? 'rounded-2xl bg-gray-100 dark:bg-slate-800 px-4 py-2 text-gray-700 dark:text-slate-100'
              : 'text-gray-800 dark:text-slate-100'
          }`}
        >
          {message.role === 'assistant' && assistantEnvelope ? (
            <div className="flex flex-col gap-2">
              {assistantEnvelope.parts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <div
                      key={`text:${index}`}
                      className="whitespace-pre-wrap"
                    >
                      {part.text}
                    </div>
                  );
                }
                if (part.type === 'component') {
                  const registration = chatUiComponentRegistry[part.name] ?? null;
                  if (!registration) {
                    return (
                      <JsonFallbackCard
                        key={`component:${part.id}`}
                        title={`Unknown component: ${part.name}`}
                        json={part}
                      />
                    );
                  }
                  const validated = registration.validateProps(part.props);
                  if (!validated.ok) {
                    return (
                      <JsonFallbackCard
                        key={`component:${part.id}`}
                        title={`Invalid props: ${part.name}`}
                        json={{ part, issues: validated.issues }}
                      />
                    );
                  }
                  const Component = registration.Component;
                  return (
                    <Component
                      key={`component:${part.id}`}
                      {...validated.data}
                    />
                  );
                }
                if (part.type === 'tool_result') {
                  // Rendered alongside its corresponding tool_use when possible.
                  return null;
                }
                if (part.type === 'tool_use') {
                  const runKey = `${message.id}:${part.id}`;
                  const runState = toolRuns[runKey] ?? { status: 'pending' as const };
                  const persisted = toolResultByUseId.get(part.id) ?? null;
                  const status = persisted ? (persisted.status === 'success' ? 'success' : 'error') : runState.status;
                  const outputText = persisted?.outputText ?? runState.outputText ?? null;
                  const errorMessage = persisted?.errorMessage ?? runState.errorMessage ?? null;

                  const autoExecWhitelist = new Set(['qa_export_markdown_preview']);
                  const isWhitelisted = autoExecWhitelist.has(part.name);
                  const requiresConfirm = Boolean(part.requires_confirm) || !isWhitelisted;
                  const autoExecute =
                    Boolean(part.auto_execute) &&
                    isWhitelisted &&
                    latestAssistantMessageId === message.id;

                  const canExecute = canExportMessage && (part.name === 'qa_export_markdown_preview' || part.name === 'qa_export_json_preview');

                  const onExecute = async () => {
                    if (!canExecute) return;
                    if (toolInFlightRef.current.has(runKey)) return;
                    if (autoExecute) {
                      if (autoExecSeenRef.current.has(runKey)) return;
                      autoExecSeenRef.current.add(runKey);
                    }
                    toolInFlightRef.current.add(runKey);
                    setToolRuns((prev) => ({
                      ...prev,
                      [runKey]: { status: 'running', outputText: null, errorMessage: null },
                    }));
                    try {
                      const preview = await runQaExportPreview({
                        format: part.name === 'qa_export_json_preview' ? 'json' : 'markdown',
                        messageId: numericMessageId,
                      });
                      setToolRuns((prev) => ({
                        ...prev,
                        [runKey]: { status: 'success', outputText: preview, errorMessage: null },
                      }));
                    } catch (error) {
                      const message = error instanceof Error ? error.message : '请求失败';
                      setToolRuns((prev) => ({
                        ...prev,
                        [runKey]: { status: 'error', outputText: null, errorMessage: message },
                      }));
                    } finally {
                      toolInFlightRef.current.delete(runKey);
                    }
                  };

                  return (
                    <ToolActionCard
                      key={`tool:${part.id}`}
                      title={part.name}
                      description={requiresConfirm ? '需要确认后执行' : '可自动执行'}
                      status={status}
                      outputText={outputText}
                      errorMessage={errorMessage}
                      canExecute={canExecute}
                      requiresConfirm={requiresConfirm}
                      autoExecute={autoExecute}
                      onExecute={onExecute}
                    />
                  );
                }
                return null;
              })}
              {typingCursor}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">
              {message.role === 'assistant' ? assistantFallbackText : message.content}
              {typingCursor}
            </div>
          )}
        </div>
        {message.role === 'assistant' && message.content ? (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {messageCitationEntries.length > 0 && (
              <>
                <CitationsControl
                  citations={messageCitationEntries.map((entry) => entry.citation)}
                  onCitationHover={(chunkId) => onCitationHover?.(chunkId, message)}
                  onLocateSource={(citation) => onCitationLocate?.(citation, message)}
                  onOpenSource={(citation) => onCitationJump?.(citation, message)}
                />
              </>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
              onClick={() => onSaveToNote?.(assistantFallbackText)}
            >
              <IconSave className="w-3.5 h-3.5" />
              保存到笔记
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
              onClick={() => handleCopy(message.id, assistantFallbackText)}
            >
              <IconCopy className="w-3.5 h-3.5" />
              {copiedId === message.id ? '已复制' : '复制'}
            </button>

            {canExportMessage && (
              <Menu placement="bottom-start">
                <MenuHandler>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <DownloadIcon style={{ fontSize: 14 }} />
                    导出
                    <ExpandMoreIcon style={{ fontSize: 12 }} />
                  </button>
                </MenuHandler>
                <MenuList className="p-1 min-w-[160px]" style={{ zIndex: LAYER_LEVELS.dropdown }}>
                  <MenuItem
                    onClick={() =>
                      exportQaMarkdownDownload({
                        notebookId: notebookId ?? 0,
                        sessionId: sessionId ?? 0,
                        messageId: numericMessageId,
                      })
                    }
                    className="flex items-center gap-2 py-2 px-3 text-xs"
                  >
                    <span>导出 Markdown</span>
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      void exportQaJsonDownload({
                        notebookId: notebookId ?? 0,
                        sessionId: sessionId ?? 0,
                        messageId: numericMessageId,
                      })
                    }
                    className="flex items-center gap-2 py-2 px-3 text-xs"
                  >
                    <span>导出 JSON</span>
                  </MenuItem>
                </MenuList>
              </Menu>
            )}

            {isConnected && (onConvertToSource || onConvertToOutput) && (
              <Menu placement="bottom-start">
                <MenuHandler>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
                    disabled={isConverting}
                  >
                    {isConverting ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <ConvertIcon style={{ fontSize: 14 }} />
                    )}
                    转换
                    <ExpandMoreIcon style={{ fontSize: 12 }} />
                  </button>
                </MenuHandler>
                <MenuList className="p-1 min-w-[160px]" style={{ zIndex: LAYER_LEVELS.dropdown }}>
                  {onConvertToSource && (
                    <MenuItem
                      onClick={() => onConvertToSource()}
                      className="flex items-center gap-2 py-2 px-3 text-xs"
                      disabled={isConverting}
                    >
                      <SourceIcon style={{ fontSize: 14 }} />
                      <span>转为来源</span>
                    </MenuItem>
                  )}
                  {onConvertToOutput && (
                    <>
                      <div className="px-3 py-1 text-[10px] text-gray-400 dark:text-slate-400 font-medium">
                        转为笔记
                      </div>
                      <MenuItem
                        onClick={() => onConvertToOutput('PARAGRAPH')}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                        disabled={isConverting}
                      >
                        <NotesIcon style={{ fontSize: 14 }} />
                        <span>段落</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => onConvertToOutput('BULLETS')}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                        disabled={isConverting}
                      >
                        <NotesIcon style={{ fontSize: 14 }} />
                        <span>要点</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => onConvertToOutput('STRUCTURED')}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                        disabled={isConverting}
                      >
                        <NotesIcon style={{ fontSize: 14 }} />
                        <span>结构化</span>
                      </MenuItem>
                    </>
                  )}
                </MenuList>
              </Menu>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderNotice = useMemo(() => {
    if (!notice) return null;

    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
        <span>{notice}</span>
        {onRetrySend ? (
          <button
            type="button"
            className="text-xs font-semibold text-gray-900 dark:text-slate-100 hover:underline cursor-pointer"
            onClick={onRetrySend}
          >
            重试发送
          </button>
        ) : null}
      </div>
    );
  }, [notice, onRetrySend]);

  return (
    <div className="flex flex-1 flex-col min-h-0 p-0 gap-0">
      <div className="flex-1 min-h-0 px-4 sm:px-5 lg:px-6 py-3 sm:py-4" role="log" aria-label="对话内容">
        {!isConnected ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-6 text-xs text-gray-500 dark:text-slate-300">
            未连接到后端服务，请检查服务状态后重试。
          </div>
        ) : isBlocked ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-6 text-xs text-gray-500 dark:text-slate-300">
            请先创建笔记本，再开始对话。
          </div>
        ) : isLoadingMessages ? (
          <SkeletonList items={3} className="py-1" />
        ) : messagesError ? (
          <div className="text-xs text-red-600 dark:text-red-300">
            {messagesError}
            <button
              type="button"
              className="ml-2 text-xs font-semibold text-gray-900 hover:underline cursor-pointer"
              onClick={onRetryMessages}
            >
              重试
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 px-4 py-6 text-xs text-gray-500 dark:text-slate-300">
            {hasSources
              ? '选择来源后提问：输入问题即可基于文档生成回答。'
              : '添加文档开始分析：上传来源后即可开始提问。'}
          </div>
        ) : null}

        {shouldRenderMessageList ? (
          <Virtuoso
            className="h-full"
            data={messages}
            computeItemKey={(index, message) => message?.id ?? `chat-message-${index}`}
            initialItemCount={20}
            followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
            itemContent={(_index, message) => (message ? renderMessage(message) : <div className="pb-4" />)}
            components={{
              Footer: () => (renderNotice ? <div className="pt-1">{renderNotice}</div> : null),
            }}
          />
        ) : renderNotice ? (
          renderNotice
        ) : null}
      </div>

      <form
        className="px-3 sm:px-4 pb-3 sm:pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2 shadow-sm transition-all duration-200 focus-within:border-gray-400 dark:focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-gray-100 dark:focus-within:ring-slate-700">
          <textarea
            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-100 outline-none resize-none border-none focus:ring-0 min-h-[32px] sm:min-h-[44px]"
            name="chatPrompt"
            ref={inputRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={isSending || isBlocked}
            aria-label="对话输入"
            placeholder={isBlocked ? '请先创建笔记本' : '开始输入...'}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              if (event.shiftKey) return;
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              onSend();
            }}
            rows={1}
          />
          {isStreaming ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              aria-label="停止生成"
              onClick={onStopStreaming}
            >
              停止生成
            </button>
          ) : (
            <IconButton
              type="submit"
              size="sm"
              className="rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="发送"
              disabled={draft.trim().length === 0 || isSending || isBlocked}
            >
              <IconSend className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      </form>
    </div>
  );
}

export default memo(ChatPanel);
