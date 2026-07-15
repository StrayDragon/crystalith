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
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { copyToClipboard } from '../../../../shared/clipboard';
import { LAYER_LEVELS, useLayer } from '../../../../shared/layer';
import { toast } from '../../../../shared/toast';
import CitationsControl from '../../shared/components/citations/CitationsControl';
import { IconCopy, IconSave, IconSend } from '../../shared/components/Icons';
import { SkeletonList } from '../../shared/components/Skeleton';
import { exportQaJsonDownload, exportQaMarkdownDownload } from '../../shared/evidenceExport';
import { useCommands } from '../../shared/hooks/useCommands';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';
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

  const citationIndexMap = useMemo(() => {
    const map = new Map<number, { citation: Citation; index: number }>();
    citations.forEach((citation, index) => {
      if (citation.chunkId == null) return;
      map.set(citation.chunkId, { citation, index: index + 1 });
    });
    return map;
  }, [citations]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { style: dropdownStyle } = useLayer('dropdown');
  const {
    commands,
    isLoading: isCommandsLoading,
    error: commandsError,
    refresh: refreshCommands,
  } = useCommands({ enabled: isConnected && !isBlocked });
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [commandContext, setCommandContext] = useState<{
    token: string;
    start: number;
    end: number;
  } | null>(null);

  const commandSuggestions = useMemo(() => {
    if (!commandContext || !commandContext.token.startsWith('/')) return [];
    const token = commandContext.token.toLowerCase();
    return commands.filter((item) => item.trigger.toLowerCase().startsWith(token));
  }, [commands, commandContext]);

  const selectedCommandSuggestion = useMemo(
    () => commandSuggestions[commandSelectedIndex] ?? null,
    [commandSuggestions, commandSelectedIndex],
  );

  useEffect(() => {
    if (!isCommandMenuOpen) return;
    if (!commandSuggestions.length) {
      setCommandSelectedIndex(0);
      return;
    }
    if (commandSuggestions[commandSelectedIndex]?.enabled) return;
    const firstEnabled = commandSuggestions.findIndex((item) => item.enabled);
    setCommandSelectedIndex(Math.max(firstEnabled, 0));
  }, [commandSelectedIndex, commandSuggestions, isCommandMenuOpen]);

  const closeCommandMenu = useCallback(() => {
    setIsCommandMenuOpen(false);
    setCommandContext(null);
  }, []);

  const updateCommandMenu = useCallback(
    (value: string, cursorIndex: number) => {
      const cursor = Math.max(0, Math.min(cursorIndex, value.length));
      const before = value.slice(0, cursor);
      const tokenStart =
        Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t')) + 1;
      const after = value.slice(cursor);
      const endOffset = after.search(/\s/);
      const tokenEnd = endOffset === -1 ? value.length : cursor + endOffset;
      const token = value.slice(tokenStart, tokenEnd);

      if (!token.startsWith('/')) {
        closeCommandMenu();
        return;
      }

      setCommandContext({ token, start: tokenStart, end: tokenEnd });
      setIsCommandMenuOpen(true);
    },
    [closeCommandMenu],
  );

  const acceptCommandSuggestion = useCallback(
    (suggestion: (typeof commandSuggestions)[number]) => {
      if (!commandContext) return;
      if (!suggestion.enabled) {
        toast.info('该指令已禁用');
        return;
      }
      const afterChar = draft[commandContext.end] ?? '';
      const needsSpace = afterChar === '' || !/\s/.test(afterChar);
      const replacement = suggestion.trigger + (needsSpace ? ' ' : '');
      const nextDraft =
        draft.slice(0, commandContext.start) + replacement + draft.slice(commandContext.end);
      onDraftChange(nextDraft);
      closeCommandMenu();

      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        const pos = commandContext.start + replacement.length;
        el.focus();
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          // ignore
        }
      });
    },
    [closeCommandMenu, commandContext, draft, inputRef, onDraftChange],
  );

  const moveCommandSelection = useCallback(
    (delta: number) => {
      if (!commandSuggestions.length) return;
      const len = commandSuggestions.length;
      let nextIndex = commandSelectedIndex;
      for (let i = 0; i < len; i += 1) {
        nextIndex = (nextIndex + delta + len) % len;
        if (commandSuggestions[nextIndex]?.enabled) {
          setCommandSelectedIndex(nextIndex);
          return;
        }
      }
      setCommandSelectedIndex((prev) => (prev + delta + len) % len);
    },
    [commandSelectedIndex, commandSuggestions],
  );

  const shouldRenderMessageList =
    isConnected && !isBlocked && !isLoadingMessages && !messagesError && messages.length > 0;

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const renderMessage = (message: ChatMessage) => {
    const numericMessageId = Number(message.id);
    const canExportMessage =
      message.role === 'assistant' &&
      isConnected &&
      notebookId != null &&
      sessionId != null &&
      Number.isFinite(numericMessageId) &&
      numericMessageId > 0;

    const messageCitationEntries =
      message.citations && message.citations.length > 0
        ? message.citations.map((citation, index) => {
            const chunkId = citation.chunkId ?? null;
            const mapped = chunkId != null ? (citationIndexMap.get(chunkId) ?? null) : null;
            return {
              citation,
              index: mapped?.index ?? index + 1,
            };
          })
        : (message.citationChunkIds ?? [])
            .map((chunkId) => citationIndexMap.get(chunkId))
            .filter((entry): entry is { citation: Citation; index: number } => Boolean(entry));

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
          <div className="whitespace-pre-wrap">
            {message.role === 'assistant' ? message.content : message.content}
            {typingCursor}
          </div>
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
              onClick={() => onSaveToNote?.(message.content)}
            >
              <IconSave className="w-3.5 h-3.5" />
              保存到笔记
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-100 transition-colors cursor-pointer"
              onClick={() => {
                void handleCopy(message.id, message.content);
              }}
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
                      onClick={() => {
                        void onConvertToSource();
                      }}
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
                        onClick={() => {
                          void onConvertToOutput('PARAGRAPH');
                        }}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                        disabled={isConverting}
                      >
                        <NotesIcon style={{ fontSize: 14 }} />
                        <span>段落</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          void onConvertToOutput('BULLETS');
                        }}
                        className="flex items-center gap-2 py-2 px-3 text-xs"
                        disabled={isConverting}
                      >
                        <NotesIcon style={{ fontSize: 14 }} />
                        <span>要点</span>
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          void onConvertToOutput('STRUCTURED');
                        }}
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

  const messageListKey = sessionId ?? 'none';

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
      <div
        className="flex-1 min-h-0 px-4 sm:px-5 lg:px-6 py-3 sm:py-4"
        role="log"
        aria-label="对话内容"
      >
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
            key={messageListKey}
            className="h-full"
            data={messages}
            computeItemKey={(index, message) => message?.id ?? `chat-message-${index}`}
            initialItemCount={20}
            initialTopMostItemIndex={Math.max(0, messages.length - 1)}
            followOutput={(isAtBottom) =>
              isAtBottom || isSending || isStreaming ? 'smooth' : false
            }
            itemContent={(_index, message) =>
              message ? renderMessage(message) : <div className="pb-4" />
            }
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
        <div className="relative flex items-center gap-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2 shadow-sm transition-all duration-200 focus-within:border-gray-400 dark:focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-gray-100 dark:focus-within:ring-slate-700">
          {isCommandMenuOpen && commandContext?.token.startsWith('/') ? (
            <div
              className="absolute bottom-full left-0 right-0 mb-2"
              style={dropdownStyle}
              role="presentation"
            >
              <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                    指令补全
                  </div>
                  <div className="flex items-center gap-2">
                    {commandsError ? (
                      <div className="text-[10px] text-red-600 dark:text-red-300">加载失败</div>
                    ) : null}
                    {isCommandsLoading ? <Spinner className="h-3 w-3" color="blue" /> : null}
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {isCommandsLoading ? (
                    <div className="px-3 py-3 text-xs text-gray-500 dark:text-slate-400">
                      正在加载指令…
                    </div>
                  ) : commandSuggestions.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500 dark:text-slate-400">
                      无匹配指令
                    </div>
                  ) : (
                    <div role="listbox" aria-label="指令补全">
                      {commandSuggestions.map((item, index) => {
                        const isSelected = index === commandSelectedIndex;
                        const disabled = !item.enabled;
                        return (
                          <button
                            key={`${item.kind}:${item.trigger}:${item.source}`}
                            type="button"
                            className={`w-full text-left px-3 py-2 flex items-start gap-3 ${
                              disabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-800/70'
                            } ${isSelected ? 'bg-gray-100 dark:bg-slate-800/70' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              acceptCommandSuggestion(item);
                            }}
                            role="option"
                            aria-selected={isSelected}
                            disabled={disabled}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs text-gray-900 dark:text-slate-100 truncate">
                                  {item.trigger}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                    item.source === 'builtin'
                                      ? 'border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                      : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
                                  }`}
                                >
                                  {item.source === 'builtin' ? '内置' : '自定义'}
                                </span>
                                {!item.enabled ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                                    已禁用
                                  </span>
                                ) : null}
                              </div>
                              {item.description ? (
                                <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-400 truncate">
                                  {item.description}
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Tab / Enter 补全</span>
                  <span>↑↓ 选择 · Esc 关闭</span>
                </div>
              </div>
            </div>
          ) : null}

          <textarea
            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-100 outline-none resize-none border-none focus:ring-0 min-h-[32px] sm:min-h-[44px]"
            name="chatPrompt"
            ref={inputRef}
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              onDraftChange(value);
              updateCommandMenu(value, event.target.selectionStart ?? value.length);
            }}
            onFocus={(event) => {
              void refreshCommands();
              updateCommandMenu(
                event.currentTarget.value,
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              );
            }}
            onBlur={() => closeCommandMenu()}
            onClick={(event) =>
              updateCommandMenu(
                event.currentTarget.value,
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              )
            }
            onKeyUp={(event) =>
              updateCommandMenu(
                event.currentTarget.value,
                event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              )
            }
            disabled={isSending || isBlocked}
            aria-label="对话输入"
            placeholder={isBlocked ? '请先创建笔记本' : '开始输入...'}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;

              if (isCommandMenuOpen && commandContext?.token.startsWith('/')) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveCommandSelection(1);
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveCommandSelection(-1);
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeCommandMenu();
                  return;
                }
                if (event.key === 'Tab' || event.key === 'Enter') {
                  const candidate =
                    (selectedCommandSuggestion?.enabled ? selectedCommandSuggestion : null) ??
                    commandSuggestions.find((item) => item.enabled) ??
                    null;
                  if (candidate) {
                    event.preventDefault();
                    acceptCommandSuggestion(candidate);
                    return;
                  }
                }
              }

              if (event.key !== 'Enter') return;
              if (event.shiftKey) return;
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
