import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import { useChat } from "./useChat";
import { client } from "../../../../api/generated/client.gen";

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

function buildSharedState(messageId: string, description = "Mounted summary") {
  return {
    ui: {
      v: 1,
      components: {
        [`qa:${messageId}:summary`]: {
          type: "ReportSection",
          schemaVersion: 1,
          props: {
            title: "统计摘要",
            description,
          },
          revision: 0,
          mounts: [{ messageId, slot: "inline", order: 0 }],
          status: "ready",
        },
      },
      datasets: {},
    },
  };
}

beforeEach(() => {
  useWorkspaceStore.setState({
    notebooks: [],
    activeNotebookId: null,
    sessions: [],
    activeSessionId: null,
    sources: [],
    selectedSourceIds: {},
    messages: [],
    draft: "",
    citations: [],
    hoveredCitationChunkId: null,
    hoveredMessageChunkIds: [],
    jumpToCitationChunkId: null,
    outputs: [],
    outputType: "FAQ",
    outputTypeRenderDescriptors: {},
    outputTypeFrontendBundles: {},
    refineMode: "paragraph",
    refinePrompt: "",
    refineJobs: [],
    refineSettings: { autoTrigger: false, asyncQueue: true },
    hasNewOutput: false,
    recentCompletedJobId: null,
    activePanel: "chat",
    createState: "idle",
    createName: "",
    connectionState: "connecting",
    uploadState: "idle",
    loading: {
      notebooks: false,
      sources: false,
      sessions: false,
      messages: false,
      outputs: false,
      send: false,
    },
    errors: {
      notebooks: "",
      sources: "",
      sessions: "",
      messages: "",
      outputs: "",
      send: "",
      create: "",
    },
  });

  server.use(
    http.get("*/v1/notebooks/:notebook_id/sessions/:session_id/messages", () =>
      HttpResponse.json([]),
    ),
    http.get("*/v1/notebooks/:notebook_id/sessions/:session_id/ui/state", () =>
      HttpResponse.json({
        session_id: 123,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      }),
    ),
  );
});

test("sendMessage returns error when no notebook is active", async () => {
  const ensureSession = vi.fn().mockResolvedValue(1);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setDraft("Hello");
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(result.current.sendError).toBe("请先创建笔记本。");
  expect(result.current.messages).toHaveLength(0);
});

test("sendMessage non-streaming path stores assistant message and shared_state mounts", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/qa", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: "Answer",
        citations: [{ chunk_id: 5, chunk_index: 1, source_name: "Doc", snippet: "S" }],
        message_id: 9001,
        shared_state: buildSharedState("9001"),
        shared_state_revision: 1,
      });
    }),
  );

  const ensureSession = vi.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft("Hello");
  });

  await waitFor(() => {
    expect(result.current.rivuKernel).not.toBeNull();
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  const assistant = result.current.messages[1];
  expect(assistant.id).toBe("9001");
  expect(assistant.content).toBe("Answer");
  expect(result.current.citations).toHaveLength(1);
  expect(capturedBody).toEqual({
    question: "Hello",
    session_id: 123,
  });
  expect(result.current.rivuKernel?.getState().sharedState).toEqual(buildSharedState("9001"));
});

test("sendMessage passes selected source ids", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/qa", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: "Answer",
        citations: [],
        message_id: 9002,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      });
    }),
  );

  const ensureSession = vi.fn().mockResolvedValue(456);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
    s.setActiveNotebook(1);
    s.setActiveSession(456);
    s.setSelectedSources({ 101: true, 102: true });
    s.setDraft("Hello");
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(capturedBody).toEqual({
    question: "Hello",
    session_id: 456,
    source_ids: [101, 102],
  });
});

test("streaming path applies snapshot and delta with backend message id", async () => {
  // Mock reason: the SSE client is the boundary seam here; we emulate server events deterministically.
  const ssePostMock = vi.spyOn(client.sse, "post");
  server.use(
    http.get("*/v1/notebooks/:notebook_id/sessions/:session_id/messages", () =>
      HttpResponse.json([
        { id: 1, role: "user", content: "Hello streaming", citations: null },
        { id: 9003, role: "assistant", content: "Answer", citations: [] },
      ]),
    ),
    http.get("*/v1/notebooks/:notebook_id/sessions/:session_id/ui/state", () =>
      HttpResponse.json({
        session_id: 123,
        shared_state: buildSharedState("9003", "Stream mount"),
        shared_state_revision: 1,
      }),
    ),
  );

  ssePostMock.mockImplementation(async ({ onSseEvent }: any) => {
    onSseEvent({
      event: "state_snapshot",
      data: {
        message_id: 9003,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    });
    onSseEvent({ event: "chunk", data: { text: "Answer" } });
    onSseEvent({
      event: "state_delta",
      data: {
        delta: [
          {
            op: "add",
            path: "/ui/components/qa:9003:summary",
            value: {
              type: "ReportSection",
              schemaVersion: 1,
              props: { title: "统计摘要", description: "Stream mount" },
              revision: 0,
              mounts: [{ messageId: "9003", slot: "inline", order: 0 }],
              status: "ready",
            },
          },
        ],
      },
    });
    onSseEvent({
      event: "done",
      data: {
        message_id: 9003,
        citations: [],
        shared_state_revision: 1,
      },
    });
    return {
      stream: (async function* streamEvents() {
        yield { event: "done" };
      })(),
    } as any;
  });

  const ensureSession = vi.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft("Hello streaming");
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  expect(result.current.messages[1].id).toBe("9003");
  expect(result.current.messages[1].content).toBe("Answer");
  expect(result.current.rivuKernel?.getState().sharedState).toEqual(
    buildSharedState("9003", "Stream mount"),
  );

  ssePostMock.mockRestore();
});

test("stopStreaming rolls back provisional assistant message before done", async () => {
  const ssePostMock = vi.spyOn(client.sse, "post");
  server.use(
    http.get("*/v1/notebooks/:notebook_id/sessions/:session_id/messages", () =>
      HttpResponse.json([{ id: 1, role: "user", content: "Hello rollback", citations: null }]),
    ),
  );

  ssePostMock.mockImplementation(async ({ signal, onSseEvent }: any) => {
    onSseEvent({
      event: "state_snapshot",
      data: {
        message_id: 9004,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    });
    onSseEvent({ event: "chunk", data: { text: "Partial answer" } });
    return {
      stream: (async function* streamEvents() {
        yield* [];
        while (!signal.aborted) {
          // eslint-disable-next-line no-await-in-loop -- Intentional polling in mocked SSE stream until aborted.
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })(),
    } as any;
  });

  const ensureSession = vi.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft("Hello rollback");
  });

  await act(async () => {
    void result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(true);
  });

  act(() => {
    result.current.stopStreaming();
  });

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(false);
  });

  expect(
    useWorkspaceStore.getState().messages.filter((message) => message.role === "assistant"),
  ).toHaveLength(0);
  expect(
    useWorkspaceStore.getState().messages.filter((message) => message.role === "user"),
  ).toHaveLength(1);

  ssePostMock.mockRestore();
});
