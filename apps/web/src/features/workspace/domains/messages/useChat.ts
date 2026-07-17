import type { Citation } from '@crystalith/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';
import { streamRequest } from '../../../../api/stream';
import { t } from '../../../../shared/i18n';
import { toast } from '../../../../shared/toast';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { ChatMessage as WorkspaceChatMessage } from '../../shared/types';
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

function ensureAssistantMessage(
  messageId: string,
  scope: WorkspaceChatMessage['citationScope'] | undefined,
) {
  const state = useWorkspaceStore.getState();
  const existing = state.messages.find((message) => message.id === messageId);
  if (existing) {
    state.updateMessage(messageId, { citationScope: scope });
    return;
  }
  state.addStreamingMessage({
    id: messageId,
    role: 'assistant',
    content: '',
    citationScope: scope,
  });
}

function mapTransportError(error: Error | null, status?: number): string {
  if (status === 503) {
    return '可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置或稍后重试。';
  }
  if (status === 404) {
    return '会话或笔记本不存在。';
  }
  if (status === 500) {
    return '服务器内部错误，请检查模型/Embedding 配置或稍后重试。';
  }
  const message = error?.message ?? '';
  if (message.length > 0 && message.length < 120) {
    return message;
  }
  return '请求失败，请检查后端服务或稍后重试。';
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
  const streamingMarkdownRef = useRef('');
  const streamingFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && activeSessionId && isConnected
      ? ['workspace/messages', activeNotebookId, activeSessionId]
      : null,
    async () => {
      const { data: result, error: fetchErr } = await api.v2
        .notebooks({ nid: activeNotebookId! })
        .sessions({ sid: activeSessionId! })
        .messages.get({ query: { offset: 0, limit: 200 } });
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      return result ?? [];
    },
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
      .filter((item: Record<string, unknown>) => item.role !== 'system')
      .map((item: Record<string, unknown>) =>
        normalizeMessage(item as unknown as Parameters<typeof normalizeMessage>[0]),
      );
    const scopeMap = new Map<string, (typeof messagesRef.current)[number]['citationScope']>();
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
  }, [data, error, store]);

  const setDraft = useCallback((value: string) => store.getState().setDraft(value), [store]);

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

    const notebookId = s.activeNotebookId;

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

    const userMessage: WorkspaceChatMessage = { id: createId(), role: 'user', content: text };
    const pendingMessages: WorkspaceChatMessage[] = [...s.messages, userMessage];
    s.setMessages(pendingMessages);
    s.setDraft('');

    const sessionId = await ensureSession();
    if (!sessionId) {
      setLastFailedDraft(text);
      store.getState().setLoading('send', false);
      store.getState().setError('send', '会话创建失败。');
      return;
    }

    if (enableStreaming) {
      const abortController = new AbortController();
      streamingAbortControllerRef.current = abortController;
      setIsStreaming(true);
      setStreamingMessageId(null);
      streamingMarkdownRef.current = '';
      streamingBufferRef.current = '';

      let receivedDone = false;
      let stableAssistantMessageId: string | null = null;
      let terminalErrorMessage = '';

      const rollbackLocalStreamingState = () => {
        if (!stableAssistantMessageId) {
          streamingMarkdownRef.current = '';
          streamingBufferRef.current = '';
          return;
        }
        const state = store.getState();
        state.setMessages(
          state.messages.filter((message) => message.id !== stableAssistantMessageId),
        );
        streamingMarkdownRef.current = '';
        streamingBufferRef.current = '';
      };

      const resyncServerState = () => {
        void mutate();
      };

      const flushBufferedContent = () => {
        if (!stableAssistantMessageId) return;
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        if (!streamingBufferRef.current) return;
        const buffered = streamingBufferRef.current;
        streamingBufferRef.current = '';
        streamingMarkdownRef.current += buffered;
        ensureAssistantMessage(stableAssistantMessageId, selectedScope ?? undefined);
        store.getState().updateMessage(stableAssistantMessageId, {
          content: streamingMarkdownRef.current,
        });
      };

      try {
        const body: Record<string, unknown> = {
          question: text,
          notebook_id: notebookId,
          session_id: sessionId,
        };
        if (explicitSourceIds.length) {
          (body as Record<string, unknown>).source_ids = explicitSourceIds;
        }

        const stream = streamRequest('/v2/qa/stream', {
          method: 'POST',
          body,
          signal: abortController.signal,
        });

        for await (const sseEvent of stream) {
          const { event: eventType, data: eventData } = sseEvent;

          if (
            eventType === 'chunk' &&
            eventData &&
            typeof eventData === 'object' &&
            'text' in eventData
          ) {
            const chunkText =
              typeof (eventData as { text?: unknown }).text === 'string'
                ? ((eventData as { text?: unknown }).text as string)
                : '';
            if (!chunkText) continue;
            streamingBufferRef.current += chunkText;
            if (!streamingFlushTimerRef.current) {
              streamingFlushTimerRef.current = setTimeout(() => {
                streamingFlushTimerRef.current = null;
                flushBufferedContent();
              }, 50);
            }
            continue;
          }

          if (eventType === 'state_snapshot' && eventData && typeof eventData === 'object') {
            const payload = eventData as {
              message_id?: unknown;
              shared_state?: unknown;
            };
            const nextMessageId = payload.message_id;
            if (
              typeof nextMessageId === 'number' &&
              Number.isFinite(nextMessageId) &&
              nextMessageId > 0
            ) {
              stableAssistantMessageId = String(nextMessageId);
              setStreamingMessageId(stableAssistantMessageId);
              ensureAssistantMessage(stableAssistantMessageId, selectedScope ?? undefined);
              if (streamingMarkdownRef.current || streamingBufferRef.current) {
                flushBufferedContent();
              }
            }
            continue;
          }

          if (eventType === 'done' && eventData && typeof eventData === 'object') {
            receivedDone = true;
            const doneData = eventData as {
              citations?: Citation[];
              message_id?: unknown;
            };
            const doneMessageId =
              typeof doneData.message_id === 'number' &&
              Number.isFinite(doneData.message_id) &&
              doneData.message_id > 0
                ? String(doneData.message_id)
                : stableAssistantMessageId;
            if (doneMessageId) {
              stableAssistantMessageId = doneMessageId;
              setStreamingMessageId(doneMessageId);
              ensureAssistantMessage(doneMessageId, selectedScope ?? undefined);
            }
            flushBufferedContent();
            const normalizedCitations = doneData.citations?.map(normalizeCitation) ?? [];
            if (stableAssistantMessageId) {
              store.getState().updateMessage(stableAssistantMessageId, {
                citationChunkIds: collectChunkIds(normalizedCitations),
                citations: normalizedCitations,
                citationScope: selectedScope ?? undefined,
              });
            }
            store.getState().setCitations(normalizedCitations);
            continue;
          }

          if (eventType === 'error') {
            terminalErrorMessage =
              eventData && typeof eventData === 'object' && 'message' in eventData
                ? typeof (eventData as { message?: unknown }).message === 'string'
                  ? (eventData as { message: string }).message
                  : '请求失败'
                : typeof eventData === 'string'
                  ? eventData
                  : '请求失败';
            store.getState().setError('send', terminalErrorMessage);
          }
        }

        if (!receivedDone) {
          rollbackLocalStreamingState();
          resyncServerState();
          if (!terminalErrorMessage) {
            terminalErrorMessage = '流式连接已断开，请重试。';
            store.getState().setError('send', terminalErrorMessage);
          }
        }

        if (refreshSessions) {
          void refreshSessions();
        }
        if (!receivedDone) {
          setLastFailedDraft(text);
        } else {
          void mutate();
          setLastFailedDraft('');
        }
      } catch (error) {
        const isAborted =
          abortController.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');

        if (!receivedDone) {
          rollbackLocalStreamingState();
          resyncServerState();
        }

        if (isAborted) {
          if (!receivedDone) {
            const errorMessage = terminalErrorMessage || '请求已中断，请重试。';
            store.getState().setError('send', errorMessage);
            setLastFailedDraft(text);
          } else {
            store.getState().setError('send', '');
            setLastFailedDraft('');
          }
        } else {
          const errStatus = (error as Error & { status?: number }).status;
          const errorMessage = mapTransportError(error instanceof Error ? error : null, errStatus);
          store.getState().setError('send', errorMessage);
          setLastFailedDraft(text);
        }
      } finally {
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        if (streamingAbortControllerRef.current === abortController) {
          streamingAbortControllerRef.current = null;
        }
        setIsStreaming(false);
        setStreamingMessageId(null);
        store.getState().setLoading('send', false);
      }
      return;
    }

    // Non-streaming path
    try {
      const qaBody: {
        question: string;
        notebook_id: number;
        session_id: number;
        source_ids?: number[];
      } = {
        question: text,
        notebook_id: notebookId,
        session_id: sessionId,
      };
      if (explicitSourceIds.length) {
        qaBody.source_ids = explicitSourceIds;
      }
      const { data: qaResult, error: qaErr } = await api.v2.qa.post(qaBody);
      if (qaErr)
        throw new Error(typeof qaErr === 'string' ? qaErr : typeof qaErr === 'string' ? qaErr : '');
      const result = qaResult! as Record<string, unknown>;

      const normalizedCitations = ((result.citations as unknown[]) ?? []).map((c: unknown) =>
        normalizeCitation(c as Parameters<typeof normalizeCitation>[0]),
      );
      const messageId =
        typeof result.message_id === 'number' &&
        Number.isFinite(result.message_id) &&
        (result.message_id as number) > 0
          ? String(result.message_id)
          : createId();
      const assistantMessage: WorkspaceChatMessage = {
        id: messageId,
        role: 'assistant',
        content: result.answer as string,
        citationChunkIds: collectChunkIds(normalizedCitations),
        citations: normalizedCitations,
        citationScope: selectedScope ?? undefined,
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
      const errStatus = (error as Error & { status?: number }).status;
      const userFacingError = mapTransportError(error instanceof Error ? error : null, errStatus);

      const assistantMessage: WorkspaceChatMessage = {
        id: createId(),
        role: 'assistant',
        content: userFacingError,
      };
      const s2 = store.getState();
      s2.setMessages([...pendingMessages, assistantMessage]);
      s2.setError('send', userFacingError);
      setLastFailedDraft(text);
    } finally {
      store.getState().setLoading('send', false);
    }
  }, [enableStreaming, ensureSession, mutate, refreshSessions, store]);

  const retryMessages = useCallback(async () => {
    store.getState().setError('messages', '');
    await mutate();
  }, [mutate, store]);

  const retrySend = useCallback(async () => {
    const text = lastFailedDraft.trim();
    if (!text) return;
    store.getState().setDraft(text);
    await sendMessage();
  }, [lastFailedDraft, sendMessage, store]);

  const stopStreaming = useCallback(() => {
    streamingAbortControllerRef.current?.abort();
    streamingAbortControllerRef.current = null;
  }, []);

  const [isConverting, setIsConverting] = useState(false);

  const handleConvertSessionToSource = useCallback(async () => {
    const s = store.getState();
    if (!s.activeNotebookId || !s.activeSessionId) return;
    if (s.connectionState !== 'live') {
      toast.warning(t('messages.convert.connection_required'));
      return;
    }
    setIsConverting(true);
    try {
      const { data: result, error: convErr } = await api.v2
        .notebooks({ nid: s.activeNotebookId })
        .sessions({ sid: s.activeSessionId })
        // eslint-disable-next-line no-unexpected-multiline
        ['convert-to-source'].post();
      if (convErr)
        throw new Error(
          typeof convErr === 'string' ? convErr : typeof convErr === 'string' ? convErr : '',
        );
      if (refreshSources) {
        await refreshSources();
      }
      toast.success(
        t('messages.convert.to_source.success', {
          filename: result!.filename,
          chunkCount: result!.chunk_count,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('messages.convert.failure_default');
      toast.error(t('messages.convert.failure', { message }));
    } finally {
      setIsConverting(false);
    }
  }, [refreshSources, store]);

  const handleConvertSessionToOutput = useCallback(
    async (outputType: string) => {
      const s = store.getState();
      if (!s.activeNotebookId || !s.activeSessionId) return;
      if (s.connectionState !== 'live') {
        toast.warning(t('messages.convert.connection_required'));
        return;
      }
      setIsConverting(true);
      try {
        const { data: result, error: convErr } = await api.v2
          .notebooks({ nid: s.activeNotebookId })
          .sessions({ sid: s.activeSessionId })
          // eslint-disable-next-line no-unexpected-multiline
          ['convert-to-output'].post({ output_type: outputType });
        if (convErr)
          throw new Error(
            typeof convErr === 'string' ? convErr : typeof convErr === 'string' ? convErr : '',
          );
        if (refreshOutputs) {
          await refreshOutputs();
        }
        toast.success(t('messages.convert.to_output.success', { title: (result as any).title }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('messages.convert.failure_default');
        toast.error(t('messages.convert.failure', { message }));
      } finally {
        setIsConverting(false);
      }
    },
    [refreshOutputs, store],
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
    isConverting,
    convertSessionToSource: handleConvertSessionToSource,
    convertSessionToOutput: handleConvertSessionToOutput,
  };
}
