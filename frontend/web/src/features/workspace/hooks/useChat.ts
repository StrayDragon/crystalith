import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

import {
  askQuestion,
  createNotebookSuggestions,
  createSessionSuggestions,
  listMessages,
} from '../api';
import { useWorkspaceDispatch, useWorkspaceState } from '../context/WorkspaceContext';
import type { SuggestionItem } from '../types';
import { collectChunkIds, createId, normalizeCitation, normalizeMessage } from '../utils';

const DEMO_SUGGESTIONS: SuggestionItem[] = [
  { question: '当前资料的关键结论是什么？', type: 'analytical', context: 'demo' },
  { question: '有哪些值得进一步验证的假设？', type: 'factual', context: 'demo' },
  { question: '和竞品相比，我们的差异点是什么？', type: 'comparative', context: 'demo' },
  { question: '可以延伸哪些深度探索问题？', type: 'deep_dive', context: 'demo' },
];

interface UseChatOptions {
  ensureSession: (title?: string | null) => Promise<number | null>;
  refreshSessions?: () => Promise<void>;
  enableSuggestions?: boolean;
}

export function useChat({ ensureSession, refreshSessions, enableSuggestions }: UseChatOptions) {
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  const isDemo = state.connectionState === 'demo';
  const [suggestionKey, setSuggestionKey] = useState(0);
  const suggestionsEnabled = Boolean(enableSuggestions);

  const { data, error, isLoading, mutate } = useSWR(
    state.activeSessionId && !isDemo
      ? ['workspace/messages', state.activeSessionId]
      : null,
    () => listMessages(state.activeSessionId ?? 0),
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

  const {
    data: suggestionData,
    error: suggestionError,
    isLoading: suggestionLoading,
    mutate: mutateSuggestions,
  } = useSWR(
    state.activeNotebookId && suggestionsEnabled
      ? ['workspace/suggestions', state.activeNotebookId, state.activeSessionId, suggestionKey]
      : null,
    async () => {
      if (!state.activeNotebookId) {
        return { suggestions: [] };
      }
      if (isDemo) {
        return { suggestions: DEMO_SUGGESTIONS };
      }
      if (state.activeSessionId) {
        return createSessionSuggestions(state.activeSessionId, { count: 4, mode: 'standard' });
      }
      return createNotebookSuggestions(state.activeNotebookId, { count: 4, mode: 'standard' });
    },
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!suggestionsEnabled) {
      dispatch({ type: 'SET_SUGGESTIONS', payload: [] });
      dispatch({ type: 'SET_ERROR', payload: { key: 'suggestions', value: '' } });
      return;
    }
    if (suggestionError) {
      dispatch({
        type: 'SET_ERROR',
        payload: { key: 'suggestions', value: '建议加载失败，请稍后重试。' },
      });
      return;
    }
    if (!suggestionData) return;
    dispatch({
      type: 'SET_SUGGESTIONS',
      payload: suggestionData.suggestions ?? [],
    });
    dispatch({ type: 'SET_ERROR', payload: { key: 'suggestions', value: '' } });
  }, [dispatch, suggestionData, suggestionError, suggestionsEnabled]);

  const refreshSuggestions = useCallback(async () => {
    if (!suggestionsEnabled) return;
    setSuggestionKey((prev) => prev + 1);
    await mutateSuggestions();
  }, [mutateSuggestions, suggestionsEnabled]);

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

    dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: true } });
    dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '' } });
    dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' });

    const userMessage = { id: createId(), role: 'user', content: text };
    const pendingMessages = [...state.messages, userMessage];
    dispatch({ type: 'SET_MESSAGES', payload: pendingMessages });
    dispatch({ type: 'SET_DRAFT', payload: '' });

    const sessionId = await ensureSession();

    if (isDemo) {
      const demoCitations = [
        {
          id: '101',
          chunkId: 101,
          sourceTitle: '需求说明.md',
          snippet: '...与三栏工作区一致：左来源/引用，中聊天，右提炼输出。',
          chunkIndex: 3,
        },
        {
          id: '102',
          chunkId: 102,
          sourceTitle: '竞品对比.txt',
          snippet: '...对话区域需要始终可用，提炼区域用于结构化输出。',
          chunkIndex: 1,
        },
      ];
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: `（演示）已收到：${text}`,
        citationChunkIds: collectChunkIds(demoCitations),
        citations: demoCitations,
      };
      dispatch({
        type: 'SET_MESSAGES',
        payload: [...pendingMessages, assistantMessage],
      });
      dispatch({ type: 'SET_CITATIONS', payload: demoCitations });
      dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
      await refreshSuggestions();
      return;
    }

    if (!sessionId) {
      dispatch({ type: 'SET_LOADING', payload: { key: 'send', value: false } });
      dispatch({ type: 'SET_ERROR', payload: { key: 'send', value: '会话创建失败。' } });
      return;
    }

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
      void refreshSuggestions();
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
    ensureSession,
    isDemo,
    mutate,
    refreshSessions,
    refreshSuggestions,
    state.activeNotebookId,
    state.draft,
    state.messages,
  ]);

  const applySuggestion = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_DRAFT', payload: value });
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: 'chat' });
    },
    [dispatch],
  );

  const retryMessages = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'messages', value: '' } });
    await mutate();
  }, [dispatch, mutate]);

  const retrySuggestions = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', payload: { key: 'suggestions', value: '' } });
    await mutateSuggestions();
  }, [dispatch, mutateSuggestions]);

  return {
    messages: state.messages,
    draft: state.draft,
    setDraft,
    sendMessage,
    isSending: state.loading.send,
    sendError: state.errors.send,
    citations: state.citations,
    suggestions: state.suggestions,
    suggestionsLoading: suggestionLoading,
    suggestionsError: state.errors.suggestions,
    refreshSuggestions,
    applySuggestion,
    retryMessages,
    retrySuggestions,
    isLoadingMessages: isLoading,
    messagesError: state.errors.messages,
  };
}
