import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import {
  askQuestion,
  askQuestionStream,
  convertSessionToOutput,
  convertSessionToSource,
  listMessages,
} from '../../shared/api';
import type { OutputType } from '../../shared/api';
import { toast } from '../../../../shared/toast';
import { useWorkspaceDispatch, useWorkspaceState } from '../../app/WorkspaceContext';
import { collectChunkIds, createId, normalizeCitation, normalizeMessage } from '../../shared/utils';

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
  const streamingMessageIdRef = useRef<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    state.activeNotebookId && state.activeSessionId && isConnected
      ? ['workspace/messages', state.activeNotebookId, state.activeSessionId]
      : null,
    () => listMessages(state.activeNotebookId ?? 0, state.activeSessionId ?? 0),
    { revalidateOnFocus: false },
  );

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
    dispatch({ type: 'SET_MESSAGES', payload: normalized });
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

    // Use streaming if enabled
    if (enableStreaming) {
      const assistantMessageId = createId();
      streamingMessageIdRef.current = assistantMessageId;
      setIsStreaming(true);

      // Add empty assistant message that will be filled by streaming
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      };
      dispatch({ type: 'ADD_STREAMING_MESSAGE', payload: assistantMessage });

      try {
        const { done } = await askQuestionStream(
          state.activeNotebookId,
          text,
          sessionId,
          {
            onChunk: (chunkText) => {
              dispatch({
                type: 'APPEND_MESSAGE_CONTENT',
                payload: { messageId: assistantMessageId, text: chunkText },
              });
            },
            onDone: (doneData) => {
              const normalizedCitations = doneData.citations?.map(normalizeCitation) ?? [];
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  messageId: assistantMessageId,
                  updates: {
                    citationChunkIds: collectChunkIds(normalizedCitations),
                    citations: normalizedCitations,
                  },
                },
              });
              dispatch({ type: 'SET_CITATIONS', payload: normalizedCitations });
            },
            onError: (errorMessage) => {
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  messageId: assistantMessageId,
                  updates: { content: errorMessage },
                },
              });
              dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: errorMessage } });
            },
          },
        );

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
        streamingMessageIdRef.current = null;
        dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
      }
      return;
    }

    // Non-streaming fallback
    try {
      const qaResult = await askQuestion(state.activeNotebookId, text, sessionId);
      const normalizedCitations = qaResult.citations?.map(normalizeCitation) ?? [];
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: qaResult.answer,
        citationChunkIds: collectChunkIds(normalizedCitations),
        citations: normalizedCitations,
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
      const result = await convertSessionToSource(
        state.activeNotebookId,
        state.activeSessionId,
        null, // Convert entire session
      );
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
    async (outputType: OutputType) => {
      if (!state.activeNotebookId || !state.activeSessionId) return;
      if (!isConnected) {
        toast.warning('未连接到后端服务，暂不支持转换。');
        return;
      }
      setIsConverting(true);
      try {
        const result = await convertSessionToOutput(
          state.activeNotebookId,
          state.activeSessionId,
          outputType,
          null, // Convert entire session
        );
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
