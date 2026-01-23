import { memo, useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { Button, IconButton, Textarea } from '@material-tailwind/react';

import type { ChatMessage, Citation } from '../types';
import CitationMark from './citations/CitationMark';
import { IconCopy, IconSave, IconSend } from './Icons';

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
  onSaveToNote?: (content: string) => void;
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
  onSaveToNote,
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

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const showDemoSeed =
    isDemo &&
    !isBlocked &&
    !isLoadingMessages &&
    !messagesError &&
    messages.length === 0;
  const demoContent = `一、维生素类：\n- 维生素D：与毛囊周期相关，缺乏会影响再生能力。\n- 生物素（维生素B7）：促进角蛋白生成，建议从胡萝卜、坚果与鱼类中摄取。\n- 维生素E：抗氧化保护，常见于坚果与全谷物。\n\n二、需警惕的\"黑榜\"：\n- 高糖食品：刺激胰岛素反应，可能间接影响激素水平。\n- 油腻/高脂饮食：增加炎症反应与毛囊压力。\n- 生鸡蛋：生物素吸收受限，不建议大量食用。`;

  return (
    <div className="flex flex-1 flex-col min-h-0 p-0 gap-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4" role="log" aria-label="对话内容">
        {isBlocked ? (
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
        ) : messages.length === 0 && !showDemoSeed ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-xs text-gray-500">
            开始对话吧：输入问题或指令，NotebookLM 会生成总结与要点。
          </div>
        ) : null}

        {showDemoSeed ? (
          <div className="flex flex-col gap-2 items-start">
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {demoContent}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                onClick={() => onSaveToNote?.(demoContent)}
              >
                <IconSave className="w-3.5 h-3.5" />
                保存到笔记
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                onClick={() => handleCopy('demo', demoContent)}
              >
                <IconCopy className="w-3.5 h-3.5" />
                {copiedId === 'demo' ? '已复制' : '复制'}
              </button>
            </div>
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
                {message.role === 'assistant' && messageCitationEntries.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1" aria-label="引用">
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
              {message.role === 'assistant' && message.content ? (
                <div className="flex items-center gap-2 mt-1">
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
