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
import { useWorkspaceDispatch, useWorkspaceState } from '../../app/WorkspaceContext';
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
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isConnected = state.connectionState === 'live';
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesRef = useRef(state.messages);

  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && state.activeSessionId && isConnected
      ? ['workspace/messages', state.activeNotebookId, state.activeSessionId]
      : null,
    () => listMessages({
      path: {
        notebook_id: state.activeNotebookId ?? 0,
        session_id: state.activeSessionId ?? 0,
      },
    }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useEffect(() => {
    if (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'messages', value: '会话消息加载失败，请稍后重试。' },
      });
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
    dispatch({ type: 'SET_MESSAGES', payload: merged });
    dispatch({ type: 'SET_ERROR', payload: { key: 'messages', value: '' } });
  }, [data, dispatch, error]);

  const setDraft = useCallback(
    (value: string) => dispatch({ type: 'SET_DRAFT', payload: value }),
    [dispatch],
  );

  const sendMessage = useCallback(async () => {
    const text = state.draft.trim();
    if (!text) return;
    if (!state.activeNotebookId) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '请先创建笔记本。' } });
      return;
    }
    if (!isConnected) {
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '未连接到后端服务。' } });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '' } });
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' });

    const selectedSourceIds = Object.entries(state.selectedSourceIds)
      .filter(([, selected]) => selected)
      .map(([id]) => Number(id))
      .filter((value) => Number.isFinite(value) && value > 0);
    const explicitSourceIds = selectedSourceIds;
    const selectedSourceTitles = state.sources
      .filter((source) => explicitSourceIds.includes(source.id))
      .map((source) => source.title);

    const selectedScope = buildSourceScopeSnapshot(selectedSourceTitles, 'selected');

    const userMessage = { id: createId(), role: 'user', content: text };
    const pendingMessages = [...state.messages, userMessage];
    dispatch({ type: 'SET_MESSAGES', payload: pendingMessages });
    dispatch({ type: 'SET_DRAFT', payload: '' });

    const sessionId = await ensureSession();

    if (!sessionId) {
      dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '会话创建失败。' } });
      return;
    }

    const resolvedChunkIds: number[] | undefined = undefined;

    // Use streaming if enabled
    if (enableStreaming) {
      const assistantMessageId = createId();
      setIsStreaming(true);
      setStreamingMessageId(assistantMessageId);

      // Add empty assistant message that will be filled by streaming
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        citationScope: selectedScope ?? undefined,
      };
      dispatch({ type: 'ADD_STREAMING_MESSAGE', payload: assistantMessage });

      try {
        const { stream } = await client.sse.post({
          url: '/v1/notebooks/{notebook_id}/qa/stream',
          path: { notebook_id: state.activeNotebookId },
          body: {
            question: text,
            session_id: sessionId ?? undefined,
            chunk_ids: resolvedChunkIds,
            source_ids: explicitSourceIds.length ? explicitSourceIds : undefined,
          },
          headers: {
            Accept: 'text/event-stream',
          },
          onSseEvent: (event) => {
            const { event: eventType, data } = event;
            if (eventType === 'chunk' && data && typeof data === 'object' && 'text' in data) {
              const chunkText = String((data as { text?: unknown }).text ?? '');
              if (!chunkText) return;
              dispatch({
                type: 'APPEND_MESSAGE_CONTENT',
                payload: { messageId: assistantMessageId, text: chunkText },
              });
              return;
            }
            if (eventType === 'done' && data && typeof data === 'object') {
              const doneData = data as { citations?: unknown[] };
              const normalizedCitations = doneData.citations?.map(normalizeCitation) ?? [];
              const scope = selectedScope;
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  messageId: assistantMessageId,
                  updates: {
                    citationChunkIds: collectChunkIds(normalizedCitations),
                    citations: normalizedCitations,
                    citationScope: scope,
                  },
                },
              });
              dispatch({ type: 'SET_CITATIONS', payload: normalizedCitations });
              return;
            }
            if (eventType === 'error') {
              const errorMessage =
                data && typeof data === 'object' && 'message' in data
                  ? String((data as { message?: unknown }).message ?? '请求失败')
                  : typeof data === 'string'
                    ? data
                    : '请求失败';
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  messageId: assistantMessageId,
                  updates: { content: errorMessage },
                },
              });
              dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: errorMessage } });
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
      } catch (error) {
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
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            messageId: assistantMessageId,
            updates: { content: errorMessage },
          },
        });
        dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: errorMessage } });
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
        dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
      }
      return;
    }

    // Non-streaming fallback
    try {
      const qaResult = await askQuestion({
        path: { notebook_id: state.activeNotebookId },
        body: {
          question: text,
          session_id: sessionId ?? undefined,
          chunk_ids: resolvedChunkIds,
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
      dispatch({
        type: 'SET_MESSAGES',
        payload: [...pendingMessages, assistantMessage],
      });
      dispatch({ type: 'SET_CITATIONS', payload: normalizedCitations });
      void mutate();
      if (refreshSessions) {
        void refreshSessions();
      }
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
      dispatch({
        type: 'SET_MESSAGES',
        payload: [...pendingMessages, assistantMessage],
      });
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: userFacingError } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
    }
  }, [
    dispatch,
    enableStreaming,
    ensureSession,
    isConnected,
    mutate,
    refreshSessions,
    state.activeNotebookId,
    state.draft,
    state.messages,
    state.selectedSourceIds,
    state.sources,
  ]);

  const retryMessages = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'messages', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

  // --- Session Conversion Methods ---
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertSessionToSource = useCallback(async () => {
    if (!state.activeNotebookId || !state.activeSessionId) return;
    if (!isConnected) {
      toast.warning('未连接到后端服务，暂不支持转换。');
      return;
    }
    setIsConverting(true);
    try {
      const result = await convertSessionToSource({
        path: { notebook_id: state.activeNotebookId, session_id: state.activeSessionId },
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
  }, [state.activeNotebookId, state.activeSessionId, isConnected, refreshSources]);

  const handleConvertSessionToOutput = useCallback(
    async (outputType: OutputTypeInput) => {
      if (!state.activeNotebookId || !state.activeSessionId) return;
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持转换。');
        return;
      }
      setIsConverting(true);
      try {
        const result = await convertSessionToOutput({
          path: { notebook_id: state.activeNotebookId, session_id: state.activeSessionId },
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
    [state.activeNotebookId, state.activeSessionId, isConnected, refreshOutputs],
  );

  return {
    messages: state.messages,
    draft: state.draft,
    setDraft,
    sendMessage,
    isSending: state.loading.send,
    isStreaming,
    streamingMessageId,
    sendError: state.errors.send,
    citations: state.citations,
    retryMessages,
    isLoadingMessages: isLoading,
    messagesError: state.errors.messages,
    // Conversion
    isConverting,
    convertSessionToSource: handleConvertSessionToSource,
    convertSessionToOutput: handleConvertSessionToOutput,
  };
}
