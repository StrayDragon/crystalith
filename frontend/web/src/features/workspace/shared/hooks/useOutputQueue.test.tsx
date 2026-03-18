import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { delay, http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useWorkspaceStore } from "../state/workspaceStore";
import { useOutputQueue } from "./useOutputQueue";
import { GENERATION_PREFERENCE_STORAGE_KEY } from "./useGenerationPreference";

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

const onQueueReset = vi.fn();
const onQueueTotal = vi.fn();
const onQueueDone = vi.fn();
const markJobCompleted = vi.fn();

beforeEach(() => {
  window.localStorage.removeItem(GENERATION_PREFERENCE_STORAGE_KEY);

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

  server.use(http.get("*/v1/notebooks/:notebook_id/outputs", () => HttpResponse.json([])));

  onQueueReset.mockClear();
  onQueueTotal.mockClear();
  onQueueDone.mockClear();
  markJobCompleted.mockClear();
});

function setWorkspaceStateForOutputQueue({
  isConnected,
  activeNotebookId,
}: {
  isConnected: boolean;
  activeNotebookId: number | null;
}) {
  useWorkspaceStore.setState({
    activeNotebookId,
    connectionState: isConnected ? "live" : "connecting",
  });
}

function useOutputQueueHarness({ isConnected }: { isConnected: boolean }) {
  const queue = useOutputQueue({
    isConnected,
    hasPendingRefineJobs: () => false,
    onQueueReset,
    onQueueTotal,
    onQueueDone,
    markJobCompleted,
  });

  return { ...queue };
}

test("enqueueOutputJob processes and updates outputs", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/outputs/:output_type", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 10,
        type: "FAQ",
        prompt: "hello",
        chunk_ids: [1],
        content: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    }),
  );

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    result.current.enqueueOutputJob({
      type: "FAQ",
      prompt: "hello",
      sourceIds: [1],
    });
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe("done");
  });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().outputs).toHaveLength(1);
  });

  expect(capturedBody).toEqual({
    prompt: "hello",
    source_ids: [1],
  });
});

test("enqueueOutputJob propagates generation preference", async () => {
  window.localStorage.setItem(GENERATION_PREFERENCE_STORAGE_KEY, "speed");

  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/outputs/:output_type", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 12,
        type: "FAQ",
        prompt: "hello",
        chunk_ids: [1],
        content: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    }),
  );

  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    result.current.enqueueOutputJob({
      type: "FAQ",
      prompt: "hello",
      sourceIds: [1],
    });
  });

  await waitFor(() => {
    expect(result.current.outputQueueJobs[0].status).toBe("done");
  });

  expect(capturedBody).toEqual({
    prompt: "hello",
    source_ids: [1],
    preference: "speed",
  });
});

test("cancelOutputJob aborts running output job", async () => {
  // Mock reason: simulate in-flight request timing deterministically without wall-clock sleeps.
  vi.useFakeTimers();
  try {
    server.use(
      http.post("*/v1/notebooks/:notebook_id/outputs/:output_type", async () => {
        await delay(200);
        return HttpResponse.json({
          id: 11,
          type: "FAQ",
          prompt: "hello",
          chunk_ids: [1],
          content: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        });
      }),
    );

    setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
    const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
      wrapper: wrapSWR,
    });

    const flushUntil = async (predicate: () => boolean) => {
      for (let i = 0; i < 10; i += 1) {
        if (predicate()) return;
        // eslint-disable-next-line no-await-in-loop -- Intentional polling helper for hook state updates in tests.
        await act(async () => {});
      }
      throw new Error("condition not met");
    };

    act(() => {
      result.current.enqueueOutputJob({
        type: "FAQ",
        prompt: "hello",
        sourceIds: [1],
      });
    });

    await flushUntil(() => result.current.outputQueueJobs[0]?.status === "running");

    await act(async () => {
      result.current.cancelOutputJob(result.current.outputQueueJobs[0].id);
      await Promise.resolve();
    });

    await flushUntil(() => result.current.outputQueueJobs[0]?.status === "cancelled");
    expect(result.current.outputQueueJobs[0]?.status).toBe("cancelled");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});

test("enqueueOutputJob returns null when no sources selected", async () => {
  setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
    wrapper: wrapSWR,
  });

  let created: any = null;
  act(() => {
    created = result.current.enqueueOutputJob({
      type: "FAQ",
      prompt: "hello",
      sourceIds: [],
    });
  });

  expect(created).toBeNull();
  expect(useWorkspaceStore.getState().errors.outputs).toBe("请先选择来源。");
});

test("enqueueSlidesJob returns null when disconnected", async () => {
  setWorkspaceStateForOutputQueue({ isConnected: false, activeNotebookId: 1 });
  const { result } = renderHook(() => useOutputQueueHarness({ isConnected: false }), {
    wrapper: wrapSWR,
  });

  let created: any = null;
  await act(async () => {
    created = await result.current.enqueueSlidesJob({
      title: "Deck",
      prompt: "Outline",
      sourceIds: [],
      generationConfig: {},
    } as any);
  });

  expect(created).toBeNull();
  expect(useWorkspaceStore.getState().errors.outputs).toBe("未连接到后端服务。");
});

test("enqueueSlidesJob settles from draft polling when stream terminal event is missed", async () => {
  const OriginalEventSource = globalThis.EventSource;

  class SilentEventSource {
    url: string;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
      this.url = url;
    }

    addEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}

    close() {}
  }

  globalThis.EventSource = SilentEventSource as unknown as typeof EventSource;

  let outputsReady = false;
  let draftReads = 0;
  let capturedBody: Record<string, unknown> | null = null;

  server.use(
    http.post("*/v1/notebooks/:notebook_id/slides/drafts", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        id: 5,
        notebook_id: 1,
        output_id: null,
        title: "Deck",
        prompt: "Outline",
        engine: "slidev",
        chunk_ids: null,
        source_ids: [1],
        outline: null,
        markdown: null,
        generation_config: {},
        stage: "input",
        status: "idle",
        error_message: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    }),
    http.get("*/v1/notebooks/:notebook_id/slides/drafts/:slide_id", () => {
      draftReads += 1;
      if (draftReads === 1) {
        return HttpResponse.json({
          id: 5,
          notebook_id: 1,
          output_id: null,
          title: "Deck",
          prompt: "Outline",
          engine: "slidev",
          chunk_ids: [1],
          source_ids: [1],
          outline: { title: "Deck", slides: [{ title: "Intro", bullets: [] }] },
          markdown: null,
          generation_config: {},
          stage: "outline",
          status: "idle",
          error_message: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:01Z",
        });
      }
      outputsReady = true;
      return HttpResponse.json({
        id: 5,
        notebook_id: 1,
        output_id: 21,
        title: "Deck",
        prompt: "Outline",
        engine: "slidev",
        chunk_ids: [1],
        source_ids: [1],
        outline: { title: "Deck", slides: [{ title: "Intro", bullets: [] }] },
        markdown: "# Deck",
        generation_config: {},
        stage: "markdown",
        status: "idle",
        error_message: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:02Z",
      });
    }),
    http.get("*/v1/notebooks/:notebook_id/outputs", () =>
      HttpResponse.json(
        outputsReady
          ? [
              {
                id: 21,
                type: "SLIDES",
                prompt: "Outline",
                chunk_ids: [1],
                content: {
                  title: "Deck",
                  slide_id: 5,
                  markdown: "# Deck",
                },
                created_at: "2024-01-01T00:00:02Z",
                updated_at: "2024-01-01T00:00:02Z",
              },
            ]
          : [],
      ),
    ),
  );

  try {
    setWorkspaceStateForOutputQueue({ isConnected: true, activeNotebookId: 1 });
    const { result } = renderHook(() => useOutputQueueHarness({ isConnected: true }), {
      wrapper: wrapSWR,
    });

    await act(async () => {
      await result.current.enqueueSlidesJob({
        title: "Deck",
        prompt: "Outline",
        sourceIds: [1],
        generationConfig: {},
      } as any);
    });

    await waitFor(() => {
      expect(result.current.outputQueueJobs[0].status).toBe("done");
    });

    await waitFor(() => {
      expect(useWorkspaceStore.getState().outputs).toHaveLength(1);
    });

    expect(capturedBody).toEqual({
      title: "Deck",
      prompt: "Outline",
      source_ids: [1],
      generation_config: {},
    });
    expect(markJobCompleted).toHaveBeenCalled();
  } finally {
    globalThis.EventSource = OriginalEventSource;
  }
});
