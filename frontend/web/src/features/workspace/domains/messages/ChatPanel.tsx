import { memo, useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
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
  FormatQuote as QuoteIcon,
} from '@mui/icons-material';

import type { ChatMessage, Citation, OutputTypeId } from '../../shared/types';
import CitationPopover from '../../shared/components/citations/CitationPopover';
import { IconCopy, IconSave, IconSend } from '../../shared/components/Icons';
import { LAYER_LEVELS } from '../../../../shared/layer';
import { copyToClipboard } from '../../../../shared/clipboard';

interface ChatPanelProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  isStreaming?: boolean;
  streamingMessageId?: string | null;
  notice: string;
  isBlocked: boolean;
  isConnected: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  citations: Citation[];
  onCitationHover?: (chunkId: number | null, message: ChatMessage) => void;
  onCitationJump?: (citation: Citation, message: ChatMessage) => void;
  isLoadingMessages: boolean;
  messagesError: string;
  onRetryMessages: () => void;
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
  isSending,
  isStreaming = false,
  streamingMessageId = null,
  notice,
  isBlocked,
  isConnected,
  inputRef,
  citations,
  onCitationHover,
  onCitationJump,
  isLoadingMessages,
  messagesError,
  onRetryMessages,
  onSaveToNote,
  onConvertToSource,
  onConvertToOutput,
  isConverting = false,
}: ChatPanelProps) {
  const citationIndexMap = useMemo(() => {
    const map = new Map<number, { citation: Citation; index: number }>();
    citations.forEach((citation, index) => {
      if (citation.chunkId == null) return;
      map.set(citation.chunkId, { citation, index: index + 1 });
    });
    return map;
  }, [citations]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [popoverMessageId, setPopoverMessageId] = useState<string | null>(null);
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null);

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col min-h-0 p-0 gap-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4" role="log" aria-label="对话内容">
        {!isConnected ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs text-gray-500">
            未连接到后端服务，请检查服务状态后重试。
          </div>
        ) : isBlocked ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs text-gray-500">
            请先创建笔记本，再开始对话。
          </div>
        ) : isLoadingMessages ? (
          <div className="flex flex-col gap-2" aria-label="加载会话">
            <div className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-10 w-2/3 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-10 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : messagesError ? (
          <div className="text-xs text-red-600">
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
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs text-gray-500">
            开始对话吧：输入问题或指令，NotebookLM 会生成总结与要点。
          </div>
        ) : null}

        {messages.map((message) => {
          const messageCitationEntries =
            message.citations && message.citations.length > 0
              ? message.citations.map((citation, index) => {
                  const chunkId = citation.chunkId ?? null;
                  const mapped =
                    chunkId != null ? citationIndexMap.get(chunkId) ?? null : null;
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
          const scope = message.citationScope;
          const scopeLabel = scope
            ? `${scope.mode === 'selected' ? '选中引用' : '自动检索'} · ${scope.count} 条`
            : '';
          const scopeSources = scope
            ? scope.sources.length > 0
              ? `来源：${scope.sources.join('、')}`
              : '来源：未找到'
            : '';
          const scopeModeLabel =
            scope?.mode === 'selected'
              ? scope.kind === 'sources'
                ? '选中来源'
                : '选中引用'
              : '自动检索';
          const scopeSummary = scope ? `${scopeModeLabel} · ${scope.count} 条` : '';
          return (
            <div
              key={message.id}
              className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'rounded-2xl bg-gray-100 px-4 py-2 text-gray-700'
                    : 'text-gray-800'
                }`}
              >
                {message.content}
                {message.role === 'assistant' &&
                isStreaming &&
                streamingMessageId === message.id ? (
                  <span className="TypingCursor" aria-hidden="true" />
                ) : null}
              </div>
              {/* Action buttons for assistant messages */}
              {message.role === 'assistant' && message.content ? (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {/* Citation button - first in the row */}
                  {messageCitationEntries.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                        onClick={(e) => {
                          setPopoverAnchorRect(e.currentTarget.getBoundingClientRect());
                          setPopoverMessageId(message.id);
                        }}
                        aria-label={`查看全部 ${messageCitationEntries.length} 条引用`}
                      >
                        <QuoteIcon style={{ fontSize: 14 }} />
                        查看引用 ({messageCitationEntries.length})
                      </button>
                      {popoverMessageId === message.id && (
                        <CitationPopover
                          citations={messageCitationEntries.map((e) => e.citation)}
                          isOpen={true}
                          onClose={() => {
                            setPopoverMessageId(null);
                            setPopoverAnchorRect(null);
                          }}
                          anchorRect={popoverAnchorRect}
                          onJumpToCitation={(citation) => onCitationJump?.(citation, message)}
                          onCitationHover={(chunkId) => onCitationHover?.(chunkId, message)}
                        />
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                    onClick={() => onSaveToNote?.(message.content)}
                  >
                    <IconSave className="w-3.5 h-3.5" />
                    保存到笔记
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                    onClick={() => handleCopy(message.id, message.content)}
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                    {copiedId === message.id ? '已复制' : '复制'}
                  </button>

                  {/* Conversion menu - only show if conversion callbacks are provided and connected */}
                  {isConnected && (onConvertToSource || onConvertToOutput) && (
                    <Menu placement="bottom-start">
                      <MenuHandler>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
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
                            <div className="px-3 py-1 text-[10px] text-gray-400 font-medium">
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
        })}
        {notice ? <div className="text-xs text-amber-600">{notice}</div> : null}
      </div>

      <form
        className="px-3 sm:px-4 pb-3 sm:pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 sm:px-4 py-2 shadow-sm transition-all duration-200 focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-100">
          <textarea
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none resize-none border-none focus:ring-0 min-h-[32px] sm:min-h-[44px]"
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
          <IconButton
            type="submit"
            size="sm"
            className="rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="发送"
            disabled={draft.trim().length === 0 || isSending || isBlocked}
          >
            <IconSend className="w-4 h-4" />
          </IconButton>
        </div>
      </form>
    </div>
  );
}

export default memo(ChatPanel);
