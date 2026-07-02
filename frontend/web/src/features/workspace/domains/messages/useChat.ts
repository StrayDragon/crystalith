import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

import {
  askQuestionV1NotebooksNotebookIdQaPost as askQuestion,
  convertSessionToOutputV1NotebooksNotebookIdSessionsSessionIdConvertToOutputPost as convertSessionToOutput,
  convertSessionToSourceV1NotebooksNotebookIdSessionsSessionIdConvertToSourcePost as convertSessionToSource,
  listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet as listMessages,
  type Citation as ApiCitation,
  type OutputTypeInput,
} from "../../../../api/generated";
import { unwrapData } from "../../../../api/unwrap";
import { client } from "../../../../api/generated/client.gen";
import { toast } from "../../../../shared/toast";
import { t } from "../../../../shared/i18n";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import type { ChatMessage as WorkspaceChatMessage } from "../../shared/types";
import {
  buildSourceScopeSnapshot,
  collectChunkIds,
  createId,
  normalizeCitation,
  normalizeMessage,
} from "../../shared/utils";
import {
  createRivuSessionRuntime,
  type RivuSessionRuntime,
  type SessionUiStatePayload,
} from "./rivuRuntime";

interface UseChatOptions {
  ensureSession: (title?: string | null) => Promise<number | null>;
  refreshSessions?: () => Promise<void>;
  refreshSources?: () => Promise<void>;
  refreshOutputs?: () => Promise<void>;
  enableStreaming?: boolean;
}

function ensureAssistantMessage(
  messageId: string,
  scope: WorkspaceChatMessage["citationScope"] | undefined,
) {
  const state = useWorkspaceStore.getState();
  const existing = state.messages.find((message) => message.id === messageId);
  if (existing) {
    state.updateMessage(messageId, { citationScope: scope });
    return;
  }
  state.addStreamingMessage({
    id: messageId,
    role: "assistant",
    content: "",
    citationScope: scope,
  });
}

async function fetchUiState(notebookId: number, sessionId: number): Promise<SessionUiStatePayload> {
  const response = await fetch(`/v1/notebooks/${notebookId}/sessions/${sessionId}/ui/state`);
  if (!response.ok) {
    throw new Error(`UI state request failed: HTTP ${response.status}`);
  }
  return (await response.json()) as SessionUiStatePayload;
}

function parseApiErrorPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { message?: unknown; details?: unknown };
  const details = typeof record.details === "string" ? record.details.trim() : "";
  const message = typeof record.message === "string" ? record.message.trim() : "";
  return details || message || null;
}

function createSseFetchCapturingErrorBody() {
  let lastErrorBody: string | null = null;
  const sseFetch: typeof fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init);
    if (!response.ok) {
      try {
        const payload = await response.clone().json();
        lastErrorBody = parseApiErrorPayload(payload);
      } catch {
        lastErrorBody = null;
      }
    }
    return response;
  };
  return {
    fetch: sseFetch,
    consumeLastErrorBody: () => {
      const body = lastErrorBody;
      lastErrorBody = null;
      return body;
    },
  };
}

function mapSseTransportError(message: string, detail?: string | null): string {
  const combined = `${message} ${detail ?? ""}`.toLowerCase();
  if (
    combined.includes("missing api_key") ||
    combined.includes("openai_api_key") ||
    combined.includes("ai_config_missing")
  ) {
    return "Embedding 模型未配置 API Key，请在 config/secret.env 设置 OPENAI_API_KEY 后重启后端。";
  }
  if (detail && detail.length > 0 && detail.length <= 160) {
    return detail;
  }
  const statusMatch = message.match(/SSE failed:\s*(\d{3})\b/i);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  if (status === 503) {
    return "可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置或稍后重试。";
  }
  if (status === 404) {
    return "会话或笔记本不存在。";
  }
  if (status === 500) {
    return "服务器内部错误，请检查模型/Embedding 配置或稍后重试。";
  }
  if (message.length > 0 && message.length < 120) {
    return message;
  }
  return "请求失败，请检查后端服务或稍后重试。";
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
  const isConnected = connectionState === "live";

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [lastFailedDraft, setLastFailedDraft] = useState("");
  const [_runtimeVersion, setRuntimeVersion] = useState(0);
  const messagesRef = useRef(messages);
  const streamingBufferRef = useRef("");
  const streamingMarkdownRef = useRef("");
  const streamingFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingAbortControllerRef = useRef<AbortController | null>(null);
  const runtimeRef = useRef<{
    notebookId: number;
    sessionId: number;
    runtime: RivuSessionRuntime;
  } | null>(null);

  const ensureRuntime = useCallback((notebookId: number, sessionId: number) => {
    const current = runtimeRef.current;
    if (current && current.notebookId === notebookId && current.sessionId === sessionId) {
      return current.runtime;
    }
    const runtime = createRivuSessionRuntime({ notebookId, sessionId });
    runtimeRef.current = { notebookId, sessionId, runtime };
    setRuntimeVersion((value) => value + 1);
    return runtime;
  }, []);

  const rivuRuntime =
    activeNotebookId != null &&
    activeSessionId != null &&
    runtimeRef.current?.notebookId === activeNotebookId &&
    runtimeRef.current?.sessionId === activeSessionId
      ? runtimeRef.current.runtime
      : null;

  const { data, error, isLoading, mutate } = useSWR(
    activeNotebookId && activeSessionId && isConnected
      ? ["workspace/messages", activeNotebookId, activeSessionId]
      : null,
    () =>
      unwrapData(
        listMessages<true>({
          path: {
            notebook_id: activeNotebookId ?? 0,
            session_id: activeSessionId ?? 0,
          },
        }),
      ),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (activeNotebookId != null && activeSessionId != null) {
      ensureRuntime(activeNotebookId, activeSessionId);
      return;
    }
    runtimeRef.current = null;
    setRuntimeVersion((value) => value + 1);
  }, [activeNotebookId, activeSessionId, ensureRuntime]);

  useEffect(() => {
    if (!isConnected || activeNotebookId == null || activeSessionId == null) {
      return;
    }
    const runtime = ensureRuntime(activeNotebookId, activeSessionId);
    let cancelled = false;
    void fetchUiState(activeNotebookId, activeSessionId)
      .then((payload) => {
        if (cancelled) return;
        runtime.dispatchSnapshot(payload.shared_state ?? {});
      })
      .catch(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [activeNotebookId, activeSessionId, ensureRuntime, isConnected]);

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
      store.getState().setError("messages", "会话消息加载失败，请稍后重试。");
      return;
    }
    if (!data) return;
    const normalized = data.filter((item) => item.role !== "system").map(normalizeMessage);
    const scopeMap = new Map<string, (typeof messagesRef.current)[number]["citationScope"]>();
    for (const message of messagesRef.current) {
      if (message.role !== "assistant") continue;
      if (!message.citationScope || message.citationScope.mode !== "selected") continue;
      const key = `${message.role}::${message.content}::${(message.citationChunkIds ?? []).join(",")}`;
      scopeMap.set(key, message.citationScope);
    }
    const merged = normalized.map((message) => {
      if (message.role !== "assistant") return message;
      const key = `${message.role}::${message.content}::${(message.citationChunkIds ?? []).join(",")}`;
      const preservedScope = scopeMap.get(key);
      return preservedScope ? { ...message, citationScope: preservedScope } : message;
    });
    const s = store.getState();
    s.setMessages(merged);
    s.setError("messages", "");
  }, [data, error, store]);

  const setDraft = useCallback((value: string) => store.getState().setDraft(value), [store]);

  const sendMessage = useCallback(async () => {
    const s = store.getState();
    const text = s.draft.trim();
    if (!text) return;
    if (!s.activeNotebookId) {
      s.setError("send", "请先创建笔记本。");
      return;
    }
    if (s.connectionState !== "live") {
      s.setError("send", "未连接到后端服务。");
      return;
    }

    const notebookId = s.activeNotebookId;

    s.setLoading("send", true);
    s.setError("send", "");
    s.setActivePanel("chat");

    const explicitSourceIds = Object.entries(s.selectedSourceIds)
      .filter(([, selected]) => selected)
      .map(([id]) => Number(id))
      .filter((value) => Number.isFinite(value) && value > 0);
    const selectedSourceTitles = s.sources
      .filter((source) => explicitSourceIds.includes(source.id))
      .map((source) => source.title);

    const selectedScope = buildSourceScopeSnapshot(selectedSourceTitles, "selected");

    const userMessage: WorkspaceChatMessage = { id: createId(), role: "user", content: text };
    const pendingMessages: WorkspaceChatMessage[] = [...s.messages, userMessage];
    s.setMessages(pendingMessages);
    s.setDraft("");

    const sessionId = await ensureSession();
    if (!sessionId) {
      setLastFailedDraft(text);
      store.getState().setLoading("send", false);
      store.getState().setError("send", "会话创建失败。");
      return;
    }

    const runtime = ensureRuntime(notebookId, sessionId);

    if (enableStreaming) {
      const abortController = new AbortController();
      streamingAbortControllerRef.current = abortController;
      setIsStreaming(true);
      setStreamingMessageId(null);
      streamingMarkdownRef.current = "";
      streamingBufferRef.current = "";

      let hadSseError = false;
      let receivedDone = false;
      let sseTransportError: string | null = null;
      let stableAssistantMessageId: string | null = null;
      let terminalErrorMessage = "";

      const rollbackLocalStreamingState = () => {
        if (!stableAssistantMessageId) {
          streamingMarkdownRef.current = "";
          streamingBufferRef.current = "";
          return;
        }
        const state = store.getState();
        state.setMessages(
          state.messages.filter((message) => message.id !== stableAssistantMessageId),
        );
        streamingMarkdownRef.current = "";
        streamingBufferRef.current = "";
      };

      const resyncServerState = () => {
        void mutate();
        void fetchUiState(notebookId, sessionId)
          .then((payload) => {
            runtime.dispatchSnapshot(payload.shared_state ?? {});
          })
          .catch(() => {
            // best-effort resync only
          });
      };

      const flushBufferedContent = () => {
        if (!stableAssistantMessageId) return;
        if (streamingFlushTimerRef.current) {
          clearTimeout(streamingFlushTimerRef.current);
          streamingFlushTimerRef.current = null;
        }
        if (!streamingBufferRef.current) return;
        const buffered = streamingBufferRef.current;
        streamingBufferRef.current = "";
        streamingMarkdownRef.current += buffered;
        ensureAssistantMessage(stableAssistantMessageId, selectedScope ?? undefined);
        store.getState().updateMessage(stableAssistantMessageId, {
          content: streamingMarkdownRef.current,
        });
      };

      const { fetch: sseFetch, consumeLastErrorBody } = createSseFetchCapturingErrorBody();

      try {
        const { stream } = await client.sse.post({
          url: "/v1/notebooks/{notebook_id}/qa/stream",
          path: { notebook_id: notebookId },
          body: {
            question: text,
            session_id: sessionId,
            source_ids: explicitSourceIds.length ? explicitSourceIds : undefined,
          },
          headers: {
            Accept: "text/event-stream",
          },
          signal: abortController.signal,
          sseMaxRetryAttempts: 1,
          fetch: sseFetch,
          onSseError: (error) => {
            const detail = consumeLastErrorBody();
            if (detail) {
              sseTransportError = detail;
              return;
            }
            if (error instanceof Error) {
              sseTransportError = error.message;
            } else if (typeof error === "string") {
              sseTransportError = error;
            } else {
              sseTransportError = "流式连接失败";
            }
          },
          onSseEvent: (event) => {
            const { event: eventType, data: eventData } = event;
            if (eventType === "state_snapshot" && eventData && typeof eventData === "object") {
              const payload = eventData as {
                message_id?: unknown;
                shared_state?: unknown;
              };
              if (payload.shared_state && typeof payload.shared_state === "object") {
                runtime.dispatchSnapshot(payload.shared_state as Record<string, unknown>);
              }
              const nextMessageId = payload.message_id;
              if (
                typeof nextMessageId === "number" &&
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
              return;
            }
            if (eventType === "state_delta" && eventData && typeof eventData === "object") {
              const payload = eventData as { delta?: unknown };
              if (Array.isArray(payload.delta)) {
                runtime.dispatchDelta(payload.delta as Array<Record<string, unknown>>);
              }
              return;
            }
            if (
              eventType === "chunk" &&
              eventData &&
              typeof eventData === "object" &&
              "text" in eventData
            ) {
              const chunkText = String((eventData as { text?: unknown }).text ?? "");
              if (!chunkText) return;
              streamingBufferRef.current += chunkText;
              if (!streamingFlushTimerRef.current) {
                streamingFlushTimerRef.current = setTimeout(() => {
                  streamingFlushTimerRef.current = null;
                  flushBufferedContent();
                }, 50);
              }
              return;
            }
            if (eventType === "done" && eventData && typeof eventData === "object") {
              receivedDone = true;
              const doneData = eventData as {
                citations?: ApiCitation[];
                message_id?: unknown;
              };
              const doneMessageId =
                typeof doneData.message_id === "number" &&
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
              return;
            }
            if (eventType === "error") {
              hadSseError = true;
              terminalErrorMessage =
                eventData && typeof eventData === "object" && "message" in eventData
                  ? String((eventData as { message?: unknown }).message ?? "请求失败")
                  : typeof eventData === "string"
                    ? eventData
                    : "请求失败";
              store.getState().setError("send", terminalErrorMessage);
            }
          },
        });

        for await (const _event of stream) {
          // handled via onSseEvent
        }

        if (!receivedDone) {
          rollbackLocalStreamingState();
          resyncServerState();
          if (!hadSseError) {
            const detail = consumeLastErrorBody();
            terminalErrorMessage = mapSseTransportError(
              sseTransportError ?? "",
              detail ?? sseTransportError,
            );
            store.getState().setError("send", terminalErrorMessage);
          }
        }

        if (refreshSessions) {
          void refreshSessions();
        }
        if (hadSseError || !receivedDone) {
          setLastFailedDraft(text);
        } else {
          void mutate();
          setLastFailedDraft("");
        }
      } catch (err) {
        const isAborted =
          abortController.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");

        if (!receivedDone) {
          rollbackLocalStreamingState();
          resyncServerState();
        }

        if (isAborted) {
          if (!receivedDone) {
            const errorMessage = terminalErrorMessage || "请求已中断，请重试。";
            store.getState().setError("send", errorMessage);
            setLastFailedDraft(text);
          } else {
            store.getState().setError("send", "");
            setLastFailedDraft("");
          }
        } else {
          const detail = consumeLastErrorBody();
          let errorMessage = mapSseTransportError(
            sseTransportError ?? (err instanceof Error ? err.message : ""),
            detail ?? terminalErrorMessage,
          );
          if (err instanceof Error) {
            const statusMatch = err.message.match(/SSE failed:\s*(\d{3})\b/i);
            const status = statusMatch
              ? Number(statusMatch[1])
              : (err as Error & { status?: number }).status;
            if (status === 503 && !detail && !sseTransportError) {
              errorMessage = "可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置或稍后重试。";
            } else if (status === 404 && !detail && !sseTransportError) {
              errorMessage = "会话或笔记本不存在。";
            } else if (status === 500 && !detail && !sseTransportError) {
              errorMessage = "服务器内部错误，请检查模型/Embedding 配置或稍后重试。";
            }
          }
          store.getState().setError("send", errorMessage);
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
        store.getState().setLoading("send", false);
      }
      return;
    }

    try {
      const qaResult = await unwrapData(
        askQuestion<true>({
          path: { notebook_id: notebookId },
          body: {
            question: text,
            session_id: sessionId,
            source_ids: explicitSourceIds.length ? explicitSourceIds : undefined,
          },
        }),
      );
      const normalizedCitations = qaResult.citations?.map(normalizeCitation) ?? [];
      const messageId =
        typeof qaResult.message_id === "number" &&
        Number.isFinite(qaResult.message_id) &&
        qaResult.message_id > 0
          ? String(qaResult.message_id)
          : createId();
      const assistantMessage: WorkspaceChatMessage = {
        id: messageId,
        role: "assistant",
        content: qaResult.answer,
        citationChunkIds: collectChunkIds(normalizedCitations),
        citations: normalizedCitations,
        citationScope: selectedScope ?? undefined,
      };
      const sharedState =
        qaResult.shared_state && typeof qaResult.shared_state === "object"
          ? (qaResult.shared_state as Record<string, unknown>)
          : {};
      runtime.dispatchSnapshot(sharedState);
      const s2 = store.getState();
      s2.setMessages([...pendingMessages, assistantMessage]);
      s2.setCitations(normalizedCitations);
      void mutate();
      if (refreshSessions) {
        void refreshSessions();
      }
      setLastFailedDraft("");
    } catch (err) {
      let errorMessage = "请求失败，请检查后端服务或稍后重试。";
      let userFacingError = "请求失败。";

      if (err instanceof Error) {
        const statusError = err as Error & { status?: number };

        if (statusError.status === 503) {
          errorMessage = "可选 AI 服务暂时不可用（核心功能仍可用），请检查模型配置或稍后重试。";
          userFacingError = "可选 AI 服务暂时不可用，请稍后重试或切换模型。";
        } else if (statusError.status === 404) {
          errorMessage = "会话或笔记本不存在。";
          userFacingError = "会话已失效，请刷新页面。";
        } else if (statusError.status === 500) {
          errorMessage = "服务器内部错误，请稍后重试。";
          userFacingError = "服务器错误，请稍后重试。";
        } else if (err.message) {
          const msg = err.message;
          if (msg.length < 100 && !msg.includes("fetch")) {
            errorMessage = msg;
            userFacingError = msg;
          }
        }
      }

      const assistantMessage: WorkspaceChatMessage = {
        id: createId(),
        role: "assistant",
        content: errorMessage,
      };
      const s2 = store.getState();
      s2.setMessages([...pendingMessages, assistantMessage]);
      s2.setError("send", userFacingError);
      setLastFailedDraft(text);
    } finally {
      store.getState().setLoading("send", false);
    }
  }, [enableStreaming, ensureRuntime, ensureSession, mutate, refreshSessions, store]);

  const retryMessages = useCallback(async () => {
    store.getState().setError("messages", "");
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
    if (s.connectionState !== "live") {
      toast.warning(t("messages.convert.connection_required"));
      return;
    }
    setIsConverting(true);
    try {
      const result = await unwrapData(
        convertSessionToSource<true>({
          path: { notebook_id: s.activeNotebookId, session_id: s.activeSessionId },
          body: { message_ids: null },
        }),
      );
      if (refreshSources) {
        await refreshSources();
      }
      toast.success(
        t("messages.convert.to_source.success", {
          filename: result.filename,
          chunkCount: result.chunk_count,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("messages.convert.failure_default");
      toast.error(t("messages.convert.failure", { message }));
    } finally {
      setIsConverting(false);
    }
  }, [refreshSources, store]);

  const handleConvertSessionToOutput = useCallback(
    async (outputType: OutputTypeInput) => {
      const s = store.getState();
      if (!s.activeNotebookId || !s.activeSessionId) return;
      if (s.connectionState !== "live") {
        toast.warning(t("messages.convert.connection_required"));
        return;
      }
      setIsConverting(true);
      try {
        const result = await unwrapData(
          convertSessionToOutput<true>({
            path: { notebook_id: s.activeNotebookId, session_id: s.activeSessionId },
            body: { message_ids: null, output_type: outputType },
          }),
        );
        if (refreshOutputs) {
          await refreshOutputs();
        }
        toast.success(t("messages.convert.to_output.success", { title: result.title }));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("messages.convert.failure_default");
        toast.error(t("messages.convert.failure", { message }));
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
    rivuKernel: rivuRuntime?.kernel ?? null,
    rivuHost: rivuRuntime?.host ?? null,
  };
}
