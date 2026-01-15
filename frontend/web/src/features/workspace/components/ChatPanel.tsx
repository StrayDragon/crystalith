import type { RefObject } from 'react';

import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  notice: string;
  isBlocked: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  highlightedChunkId: number | null;
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
  highlightedChunkId,
}: ChatPanelProps) {
  return (
    <div className="WorkspacePanelBody WorkspacePanelBody--chat">
      <div className="ChatMessages" role="log" aria-label="聊天记录">
        {isBlocked ? (
          <div className="WorkspaceEmpty">请先创建笔记本，再开始对话。</div>
        ) : messages.length === 0 ? (
          <div className="WorkspaceEmpty">
            开始对话吧：输入问题或指令，中间显示聊天，右侧输出中心可手动触发提炼。
          </div>
        ) : null}
        {messages.map((message) => {
          const isHighlighted =
            highlightedChunkId != null &&
            message.citationChunkIds?.includes(highlightedChunkId);
          return (
            <div
              key={message.id}
              className={`ChatMessage ${message.role === 'user' ? 'isUser' : 'isAssistant'} ${
                isHighlighted ? 'isHighlighted' : ''
              }`}
            >
              <div className="ChatMessage__meta">{message.role === 'user' ? '你' : '助手'}</div>
              <div className="ChatMessage__bubble">{message.content}</div>
            </div>
          );
        })}
        {notice ? <div className="ChatStatus">{notice}</div> : null}
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
