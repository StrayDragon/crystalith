import { memo, useMemo } from 'react';
import type { RefObject } from 'react';

import type { ChatMessage, Citation, SuggestionItem } from '../types';
import CitationMark from './citations/CitationMark';
import SuggestionPanel from './SuggestionPanel';
import { IconCopy, IconFeedback, IconSave, IconSend } from './Icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  notice: string;
  isBlocked: boolean;
  isDemo: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  citations: Citation[];
  isLoadingMessages: boolean;
  messagesError: string;
  onRetryMessages: () => void;
  suggestions: SuggestionItem[];
  suggestionsLoading: boolean;
  suggestionsError: string;
  onRefreshSuggestions: () => void;
  onApplySuggestion: (text: string) => void;
}

function ChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending,
  notice,
  isBlocked,
  isDemo,
  inputRef,
  citations,
  isLoadingMessages,
  messagesError,
  onRetryMessages,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  onRefreshSuggestions,
  onApplySuggestion,
}: ChatPanelProps) {
  const citationIndexMap = useMemo(() => {
    const map = new Map<number, { citation: Citation; index: number }>();
    citations.forEach((citation, index) => {
      if (citation.chunkId == null) return;
      map.set(citation.chunkId, { citation, index: index + 1 });
    });
    return map;
  }, [citations]);

  const showDemoSeed =
    isDemo &&
    !isBlocked &&
    !isLoadingMessages &&
    !messagesError &&
    messages.length === 0;
  const showActions = !isBlocked && (messages.length > 0 || showDemoSeed);
  const demoContent = `一、维生素类：\n- 维生素D：与毛囊周期相关，缺乏会影响再生能力。\n- 生物素（维生素B7）：促进角蛋白生成，建议从胡萝卜、坚果与鱼类中摄取。\n- 维生素E：抗氧化保护，常见于坚果与全谷物。\n\n二、需警惕的\"黑榜\"：\n- 高糖食品：刺激胰岛素反应，可能间接影响激素水平。\n- 油腻/高脂饮食：增加炎症反应与毛囊压力。\n- 生鸡蛋：生物素吸收受限，不建议大量食用。`;

  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatScroll" role="log" aria-label="对话内容">
        {isBlocked ? (
          <div className="ChatEmpty">请先创建笔记本，再开始对话。</div>
        ) : isLoadingMessages ? (
          <div className="ChatSkeletonList" aria-label="加载会话">
            <div className="ChatSkeletonItem" />
            <div className="ChatSkeletonItem isShort" />
            <div className="ChatSkeletonItem" />
          </div>
        ) : messagesError ? (
          <div className="WorkspaceHint isError">
            {messagesError}
            <button type="button" className="WorkspaceLinkButton" onClick={onRetryMessages}>
              重试
            </button>
          </div>
        ) : messages.length === 0 && !showDemoSeed ? (
          <div className="ChatEmpty">开始对话吧：输入问题或指令，NotebookLM 会生成总结与要点。</div>
        ) : null}

        {showDemoSeed ? (
          <div className="ChatMessage isAssistant">
            <div className="ChatMessage__body">{demoContent}</div>
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
          return (
            <div
              key={message.id}
              className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'}`}
            >
              <div className="ChatMessage__body">
                {message.content}
                {message.role === 'assistant' && messageCitationEntries.length > 0 ? (
                  <div className="ChatMessage__citations" aria-label="引用">
                    {messageCitationEntries.map((entry) => (
                      <CitationMark
                        key={`${message.id}-${entry.citation.id}`}
                        index={entry.index}
                        citation={entry.citation}
                        onHover={() => undefined}
                        onJump={() => undefined}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {notice ? <div className="ChatNotice">{notice}</div> : null}
      </div>

      {showActions ? (
        <div className="ChatActionRow" aria-label="对话操作">
          <button type="button" className="ChatActionButton">
            <span aria-hidden="true">
              <IconSave />
            </span>
            保存到笔记
          </button>
          <button type="button" className="ChatActionButton">
            <span aria-hidden="true">
              <IconCopy />
            </span>
            复制
          </button>
          <button type="button" className="ChatActionButton">
            <span aria-hidden="true">
              <IconFeedback />
            </span>
            反馈
          </button>
        </div>
      ) : null}

      <SuggestionPanel
        suggestions={suggestions}
        isBlocked={isBlocked}
        isLoading={suggestionsLoading}
        error={suggestionsError}
        onRefresh={onRefreshSuggestions}
        onSelectSuggestion={onApplySuggestion}
      />

      <form
        className="ChatComposer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="ChatComposerRow">
          <textarea
            className="ChatInput"
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
              if (event.isComposing) return;
              event.preventDefault();
              onSend();
            }}
            rows={1}
          />
          <button
            type="submit"
            className="ChatSendButton"
            aria-label="发送"
            disabled={draft.trim().length === 0 || isSending || isBlocked}
          >
            <IconSend />
          </button>
        </div>
      </form>
    </div>
  );
}

export default memo(ChatPanel);
