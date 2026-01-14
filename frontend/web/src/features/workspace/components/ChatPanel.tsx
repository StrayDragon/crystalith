import { useMemo } from 'react';
import type { RefObject } from 'react';

import type { ChatMessage, Citation, SuggestionItem } from '../types';
import CitationMark from './citations/CitationMark';

interface ChatPanelProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  notice: string;
  isBlocked: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  highlightedChunkIds: Set<number>;
  citations: Citation[];
  onCitationHover: (chunkId: number | null) => void;
  onCitationJump: (chunkId: number | null) => void;
  onMessageHover: (chunkIds: number[] | null) => void;
  suggestions: SuggestionItem[];
  suggestionsLoading: boolean;
  suggestionsError: string;
  onSuggestionSelect: (value: string) => void;
  onRetrySuggestions: () => void;
  isLoadingMessages: boolean;
  messagesError: string;
  onRetryMessages: () => void;
}

export default function ChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending,
  notice,
  isBlocked,
  inputRef,
  highlightedChunkIds,
  citations,
  onCitationHover,
  onCitationJump,
  onMessageHover,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onSuggestionSelect,
  onRetrySuggestions,
  isLoadingMessages,
  messagesError,
  onRetryMessages,
}: ChatPanelProps) {
  const citationIndexMap = useMemo(() => {
    const map = new Map<number, { citation: Citation; index: number }>();
    citations.forEach((citation, index) => {
      if (citation.chunkId == null) return;
      map.set(citation.chunkId, { citation, index: index + 1 });
    });
    return map;
  }, [citations]);

  const suggestionLabels: Record<SuggestionItem['type'], string> = {
    factual: '事实',
    analytical: '分析',
    comparative: '对比',
    creative: '创意',
    deep_dive: '深挖',
  };

  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatMessages" role="log" aria-label="聊天记录">
        {isBlocked ? (
          <div className="WorkspaceEmpty">请先创建笔记本，再开始对话。</div>
        ) : isLoadingMessages ? (
          <div className="ChatSkeletonList" aria-label="加载会话">
            <div className="ChatSkeletonBubble" />
            <div className="ChatSkeletonBubble isShort" />
            <div className="ChatSkeletonBubble" />
            <button type="button" className="WorkspaceLinkButton" onClick={onRetryMessages}>
              重新加载
            </button>
          </div>
        ) : messagesError ? (
          <div className="WorkspaceHint isError">
            {messagesError}
            <button type="button" className="WorkspaceLinkButton" onClick={onRetryMessages}>
              重试
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="WorkspaceEmpty">
            开始对话吧：输入问题或指令，中间显示聊天，右侧输出中心可手动触发提炼。
          </div>
        ) : null}
        {messages.map((message) => {
          const isHighlighted =
            message.citationChunkIds?.some((chunkId) => highlightedChunkIds.has(chunkId)) ??
            false;
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
          return (
            <div
              key={message.id}
              className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'} ${
                isHighlighted ? 'isHighlighted' : ''
              }`}
              onMouseEnter={() => onMessageHover(message.citationChunkIds ?? null)}
              onMouseLeave={() => onMessageHover(null)}
            >
              <div className="ChatMessage__meta">{message.role === 'user' ? '你' : '助手'}</div>
              <div className="ChatMessage__bubble">
                {message.content}
                {message.role === 'assistant' && messageCitationEntries.length > 0 ? (
                  <div className="ChatMessage__citations" aria-label="引用">
                    {messageCitationEntries.map((entry) => (
                      <CitationMark
                        key={`${message.id}-${entry.citation.id}`}
                        index={entry.index}
                        citation={entry.citation}
                        onHover={onCitationHover}
                        onJump={onCitationJump}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {notice ? <div className="ChatStatus">{notice}</div> : null}
        {!isBlocked ? (
          <div className="SuggestionPanel">
            <div className="SuggestionHeader">
              <span>推荐问题</span>
              {suggestionsLoading ? <span className="WorkspaceTiny">生成中…</span> : null}
              {suggestionsError ? (
                <button type="button" className="WorkspaceLinkButton" onClick={onRetrySuggestions}>
                  重试
                </button>
              ) : null}
            </div>
            {suggestions.length === 0 ? (
              <div className="SuggestionEmpty">暂无建议问题，继续对话获取更多提示。</div>
            ) : (
              <div className="SuggestionList">
                {suggestions.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    className="SuggestionCard"
                    onClick={() => onSuggestionSelect(item.question)}
                  >
                    <span className="SuggestionQuestion">{item.question}</span>
                    <span className={`SuggestionTag is-${item.type}`}>
                      {suggestionLabels[item.type]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <form
        className="ChatComposer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          className="ChatInput"
          name="chatPrompt"
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={isSending || isBlocked}
          placeholder={isBlocked ? '请先创建笔记本' : '在这里输入问题或指令…'}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (event.shiftKey) return;
            if (event.isComposing) return;
            event.preventDefault();
            onSend();
          }}
          rows={2}
        />
        <div className="ChatActions">
          <div className="WorkspaceTiny">Enter 发送 · Shift+Enter 换行</div>
          <button
            type="submit"
            className="PrimaryButton"
            disabled={draft.trim().length === 0 || isSending || isBlocked}
          >
            {isSending ? '检索中…' : '发送'}
          </button>
        </div>
      </form>
    </div>
  );
}
