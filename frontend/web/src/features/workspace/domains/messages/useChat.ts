import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import {
  askQuestionV1NotebooksNotebookIdQaPost as askQuestion,
  convertSessionToOutputV1NotebooksNotebookIdSessionsSessionIdConvertToOutputPost as convertSessionToOutput,
  convertSessionToSourceV1NotebooksNotebookIdSessionsSessionIdConvertToSourcePost as convertSessionToSource,
  listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet as listMessages,
  type OutputTypeInput,
} from '../../../../api/generated';
import { client } from '../../../../api/generated/client.gen';
import { toast } from '../../../../shared/toast';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import {
  buildSourceScopeSnapshot,
  collectChunkIds,
  createId,
  normalizeCitation,
  normalizeMessage,
} from '../../shared/utils';

interface UseChatOptions {
  ensureSession: (title?: string | null) => Promise<number | null>;
  refreshSessions?: () => Promise<void>;
  refreshSources?: () => Promise<void>;
  refreshOutputs?: () => Promise<void>;
  enableStreaming?: boolean;
}

export function useChat({
  ensureSession,
  refreshSessions,
  refreshSources,
  refreshOutputs,
  enableStreaming = true,
}: UseChatOptions) {
  const activeNotebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const messages = useWorkspaceStore((s) => s.messages);
  const draft = useWorkspaceStore((s) => s.draft);
  const selectedSourceIds = useWorkspaceStore((s) => s.selectedSourceIds);
  const sourcesForScope = useWorkspaceStore((s) => s.sources);
  const citationsCurrent = useWorkspaceStore((s) => s.citations);
  const loadingSend = useWorkspaceStore((s) => s.loading.send);
  const errSend = useWorkspaceStore((s) => s.errors.send);
  const errMessages = useWorkspaceStore((s) => s.errors.messages);

  const store = useWorkspaceStore;
  const isConnected = connectionState === 'live';

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [lastFailedDraft, setLastFailedDraft] = useState('');
  const messagesRef = useRef(messages);
  const streamingBufferRef = useRef('');
  const streamingFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && activeSessionId && isConnected
      ? ['workspace/messages', activeNotebookId, activeSessionId]
      : null,
    () => listMessages({
      path: {
        notebook_id: activeNotebookId ?? 0,
        session_id: activeSessionId ?? 0,
      },
    }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (streamingFlushTimerRef.current) {
        clearTimeout(streamingFlushTimerRef.current);
        streamingFlushTimerRef.current = null;
      }
      streamingAbortControllerRef.current?.abort();
      streamingAbortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (error) {
      store.getState().setError('messages', '会话消息加载失败，请稍后重试。');
      return;
    }
    if (!data) return;
    const normalized = data
      .filter((item) => item.role !== 'system')
      .map(normalizeMessage);
    const scopeMap = new Map<
      string,
      (typeof messagesRef.current)[number]['citationScope']
    >();
    for (const message of messagesRef.current) {
      if (message.role !== 'assistant') continue;
      if (!message.citationScope || message.citationScope.mode !== 'selected') continue;
      const key = `${message.role}::${message.content}::${(message.citationChunkIds ?? []).join(',')}`;
      scopeMap.set(key, message.citationScope);
    }
    const merged = normalized.map((message) => {
      if (message.role !== 'assistant') return message;
      const key = `${message.role}::${message.content}::${(message.citationChunkIds ?? []).join(',')}`;
      const preservedScope = scopeMap.get(key);
      return preservedScope ? { ...message, citationScope: preservedScope } : message;
    });
    const s = store.getState();
    s.setMessages(merged);
    s.setError('messages', '');
  }, [data, error]);

  const setDraft = useCallback(
    (value: string) => store.getState().setDraft(value),
    [],
  );

  const sendMessage = useCallback(async () => {
    const s = store.getState();
    const text = s.draft.trim();
    if (!text) return;
    if (!s.activeNotebookId) {
      s.setError('send', '请先创建笔记本。');
      return;
    }
    if (s.connectionState !== 'live') {
      s.setError('send', '未连接到后端服务。');
      return;
    }

    s.setLoading('send', true);
    s.setError('send', '');
    s.setActivePanel('chat');

    const explicitSourceIds = Object.entries(s.selectedSourceIds)
      .filter(([, selected]) => selected)
      .map(([id]) => Number(id))
      .filter((value) => Number.isFinite(value) && value > 0);
    const selectedSourceTitles = s.sources
      .filter((source) => explicitSourceIds.includes(source.id))
      .map((source) => source.title);

    const selectedScope = buildSourceScopeSnapshot(selectedSourceTitles, 'selected');

    const userMessage = { id: createId(), role: 'user', content: text };
    const pendingMessages = [...s.messages, userMessage];
    s.setMessages(pendingMessages);
    s.setDraft('');

    const sessionId = await ensureSession();

    if (!sessionId) {
      setLastFailedDraft(text);
      store.getState().setLoading('send', false);
      store.getState().setError('send', '会话创建失败。');
      return;
    }

    // Use streaming if enabled
    if (enableStreaming) {
      const assistantMessageId = createId();
      const abortController = new AbortController();
      streamingAbortControllerRef.current = abortController;
      setIsStreaming(true);
      setStreamingMessageId(assistantMessageId);

      // Add empty assistant message that will be filled by streaming
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        citationScope: selectedScope ?? undefined,
      };
      store.getState().addStreamingMessage(assistantMessage);

      let hadSseError = false;
      try {
        const { stream } = await client.sse.post({
          url: '/v1/notebooks/{notebook_id}/qa/stream',
          path: { notebook_id: s.activeNotebookId },
          body: {
            question: text,
            session_id: sessionId ?? undefined,
            source_ids: explicitSourceIds.length ? explicitSourceIds : undefined,
          },
          headers: {
            Accept: 'text/event-stream',
          },
          signal: abortController.signal,
          // POST SSE should never retry — each retry re-sends the question
          sseMaxRetryAttempts: 1,
          onSseEvent: (event) => {
            const { event: eventType, data } = event;
            if (eventType === 'chunk' && data && typeof data === 'object' && 'text' in data) {
              const chunkText = String((data as { text?: unknown }).text ?? '');
              if (!chunkText) return;
              streamingBufferRef.current += chunkText;
              if (!streamingFlushTimerRef.current) {
                streamingFlushTimerRef.current = setTimeout(() => {
                  streamingFlushTimerRef.current = null;
                  if (!streamingBufferRef.current) return;
                  const buffered = streamingBufferRef.current;
                  streamingBufferRef.current = '';
                  store.getState().appendMessageContent(assistantMessageId, buffered);
                }, 50);
              }
              return;
            }
            if (eventType === 'done' && data && typeof data === 'object') {
              if (streamingFlushTimerRef.current) {
                clearTimeout(streamingFlushTimerRef.current);
                streamingFlushTimerRef.current = null;
              }
              if (streamingBufferRef.current) {
                const buffered = streamingBufferRef.current;
                streamingBufferRef.current = '';
                store.getState().appendMessageContent(assistantMessageId, buffered);
              }
              const doneData = data as { citations?: unknown[] };
              const normalizedCitations = doneData.citations?.map(normalizeCitation) ?? [];
              const scope = selectedScope;
              const s2 = store.getState();
              s2.updateMessage(assistantMessageId, {
                citationChunkIds: collectChunkIds(normalizedCitations),
                citations: normalizedCitations,
                citationScope: scope,
              });
              s2.setCitations(normalizedCitations);
              // Abort the SSE connection now that we have the complete response.
              // This prevents the SSE client from misinterpreting the stream
              // close as an error and retrying the request.
              abortController.abort();
              return;
            }
            if (eventType === 'error') {
              hadSseError = true;
              if (streamingFlushTimerRef.current) {
                clearTimeout(streamingFlushTimerRef.current);
                streamingFlushTimerRef.current = null;
              }
              if (streamingBufferRef.current) {
                const buffered = streamingBufferRef.current;
                streamingBufferRef.current = '';
                store.getState().appendMessageContent(assistantMessageId, buffered);
              }
              const errorMessage =
                data && typeof data === 'object' && 'message' in data
                  ? String((data as { message?: unknown }).message ?? '请求失败')
                  : typeof data === 'string'
                    ? data
                    : '请求失败';
              const s2 = store.getState();
              s2.updateMessage(assistantMessageId, { content: errorMessage });
              s2.setError('send', errorMessage);
            }
          },
        });

        for await (const _event of stream) {
          // handled via onSseEvent
        }

        void mutate();
        if (refreshSessions) {
          void refreshSessions();
        }
        if (hadSseError) {
          setLastFailedDraft(text);
        } else {
          setLastFailedDraft('');
        }
      } catch (error) {
        const isAborted =
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');

        if (isAborted) {
          store.getState().setError('send', '');
          setLastFailedDraft('');
        } else {
          let errorMessage = '请求失败，请检查后端服务或稍后重试。';
          if (error instanceof Error) {
            const statusError = error as Error & { status?: number };
            if (statusError.status === 503) {
              errorMessage = 'AI 服务暂时不可用，请检查模型配置或稍后重试。';
            } else if (statusError.status === 404) {
              errorMessage = '会话或笔记本不存在。';
            } else if (statusError.status === 500) {
              errorMessage = '服务器内部错误，请稍后重试。';
            } else if (error.message && error.message.length < 100) {
              errorMessage = error.message;
            }
          }
          const s2 = store.getState();
          s2.updateMessage(assistantMessageId, { content: errorMessage });
          s2.setError('send', errorMessage);
          setLastFailedDraft(text);
        }
      } finally {
        if (streamingAbortControllerRef.current === abortController) {
          streamingAbortControllerRef.current = null;
        }
        setIsStreaming(false);
        setStreamingMessageId(null);
        store.getState().setLoading('send', false);
      }
      return;
    }

    // Non-streaming fallback
    try {
      const qaResult = await askQuestion({
        path: { notebook_id: s.activeNotebookId },
        body: {
          question: text,
          session_id: sessionId ?? undefined,
          source_ids: explicitSourceIds.length ? explicitSourceIds : undefined,
        },
      });
      const normalizedCitations = qaResult.citations?.map(normalizeCitation) ?? [];
      const scope = selectedScope;
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: qaResult.answer,
        citationChunkIds: collectChunkIds(normalizedCitations),
        citations: normalizedCitations,
        citationScope: scope,
      };
      const s2 = store.getState();
      s2.setMessages([...pendingMessages, assistantMessage]);
      s2.setCitations(normalizedCitations);
      void mutate();
      if (refreshSessions) {
        void refreshSessions();
      }
      setLastFailedDraft('');
    } catch (error) {
      // Extract meaningful error message from different error types
      let errorMessage = '请求失败，请检查后端服务或稍后重试。';
      let userFacingError = '请求失败。';

      if (error instanceof Error) {
        const statusError = error as Error & { status?: number };

        if (statusError.status === 503) {
          errorMessage = 'AI 服务暂时不可用，请检查模型配置或稍后重试。';
          userFacingError = 'AI 服务配置错误，请联系管理员。';
        } else if (statusError.status === 404) {
          errorMessage = '会话或笔记本不存在。';
          userFacingError = '会话已失效，请刷新页面。';
        } else if (statusError.status === 500) {
          errorMessage = '服务器内部错误，请稍后重试。';
          userFacingError = '服务器错误，请稍后重试。';
        } else if (error.message) {
          // Use error message if available and not too technical
          const msg = error.message;
          if (msg.length < 100 && !msg.includes('fetch')) {
            errorMessage = msg;
            userFacingError = msg;
          }
        }
      }

      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: errorMessage,
      };
      const s2 = store.getState();
      s2.setMessages([...pendingMessages, assistantMessage]);
      s2.setError('send', userFacingError);
      setLastFailedDraft(text);
    } finally {
      store.getState().setLoading('send', false);
    }
  }, [
    enableStreaming,
    ensureSession,
    mutate,
    refreshSessions,
  ]);

  const retryMessages = useCallback(async () => {
    store.getState().setError('messages', '');
    await mutate();
  }, [mutate]);

  const retrySend = useCallback(async () => {
    const text = lastFailedDraft.trim();
    if (!text) return;
    store.getState().setDraft(text);
    await sendMessage();
  }, [lastFailedDraft, sendMessage]);

  const stopStreaming = useCallback(() => {
    streamingAbortControllerRef.current?.abort();
    streamingAbortControllerRef.current = null;
  }, []);

  // --- Session Conversion Methods ---
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertSessionToSource = useCallback(async () => {
    const s = store.getState();
    if (!s.activeNotebookId || !s.activeSessionId) return;
    if (s.connectionState !== 'live') {
      toast.warning('未连接到后端服务，暂不支持转换。');
      return;
    }
    setIsConverting(true);
    try {
      const result = await convertSessionToSource({
        path: { notebook_id: s.activeNotebookId, session_id: s.activeSessionId },
        body: { message_ids: null },
      });
      // Refresh sources list to show the new source
      if (refreshSources) {
        await refreshSources();
      }
      toast.success(`已转换为来源：${result.filename}（${result.chunk_count} 个分块）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '转换失败';
      toast.error(`转换失败：${message}`);
    } finally {
      setIsConverting(false);
    }
  }, [refreshSources]);

  const handleConvertSessionToOutput = useCallback(
    async (outputType: OutputTypeInput) => {
      const s = store.getState();
      if (!s.activeNotebookId || !s.activeSessionId) return;
      if (s.connectionState !== 'live') {
        toast.warning('未连接到后端服务，暂不支持转换。');
        return;
      }
      setIsConverting(true);
      try {
        const result = await convertSessionToOutput({
          path: { notebook_id: s.activeNotebookId, session_id: s.activeSessionId },
          body: { message_ids: null, output_type: outputType },
        });
        // Refresh outputs list to show the new output
        if (refreshOutputs) {
          await refreshOutputs();
        }
        toast.success(`已转换为笔记：${result.title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '转换失败';
        toast.error(`转换失败：${message}`);
      } finally {
        setIsConverting(false);
      }
    },
    [refreshOutputs],
  );

  return {
    messages,
    draft,
    setDraft,
    sendMessage,
    isSending: loadingSend,
    isStreaming,
    streamingMessageId,
    stopStreaming,
    sendError: errSend,
    citations: citationsCurrent,
    retryMessages,
    retrySend,
    isLoadingMessages: isLoading,
    messagesError: errMessages,
    // Conversion
    isConverting,
    convertSessionToSource: handleConvertSessionToSource,
    convertSessionToOutput: handleConvertSessionToOutput,
  };
}
