import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import { REFINE_TEMPLATES } from "./data/refineTemplates";
import { useRefine } from "./useRefine";

// Mock reason: isolate refine job behavior from independent output queue scheduler lifecycle.
vi.mock("../../shared/hooks/useOutputQueue", () => ({
  useOutputQueue: () => ({
    outputQueueJobs: [],
    enqueueOutputJob: vi.fn(),
    enqueueSlidesJob: vi.fn(),
    hasPendingJobs: () => false,
    outputsLoading: false,
    outputsError: "",
    retryOutputs: vi.fn(),
    retryOutputJob: vi.fn(),
    cancelOutputJob: vi.fn(),
    deleteOutput: vi.fn(),
    clearOutputs: vi.fn(),
    fetchOutput: vi.fn(),
  }),
}));

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
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

  server.use(http.get("*/v1/workspace/tools", () => HttpResponse.json({ tools: [] })));
});

test("sets default refine prompt when empty", async () => {
  const { result } = renderHook(() => useRefine(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(result.current.refinePrompt).toBe(REFINE_TEMPLATES[0].prompt);
  });
});

test("onGenerateRefine enqueues job with selected source ids", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/refine/batch", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        outputs: { paragraph: { paragraph: "Answer", bullets: [], structured: null } },
        citations: [{ chunk_id: 9, chunk_index: 1, source_name: "Doc", snippet: "S" }],
      });
    }),
  );

  const { result } = renderHook(() => useRefine(), { wrapper: wrapSWR });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
    s.setActiveNotebook(1);
    s.setRefinePrompt("提炼核心结论");
    s.setSelectedSources({ 101: true, 102: true });
  });

  await act(async () => {
    await result.current.onGenerateRefine();
  });

  await waitFor(() => {
    expect(result.current.refineJobs).toHaveLength(1);
  });

  expect(result.current.refineJobs[0].sourceIds).toEqual([101, 102]);
  expect(useWorkspaceStore.getState().activePanel).toBe("refine");
  expect(capturedBody).toEqual({
    prompt: "提炼核心结论",
    formats: expect.any(Array),
    source_ids: [101, 102],
  });
});

test("normalizes slides tool config schema from workspace tools", async () => {
  server.use(
    http.get("*/v1/workspace/tools", () =>
      HttpResponse.json({
        tools: [
          {
            id: "slides-slidev",
            label: "演示",
            description: "演示文稿",
            tone: "indigo",
            output_type: "SLIDES",
            prompt: "生成 slides",
            enabled: true,
            config_schema: {
              engine: "slidev",
              preview: {
                kind: "external_url",
                service: "slidev",
              },
              theme_preset_options: [
                {
                  id: "default",
                  label: "Default",
                },
              ],
            },
          },
        ],
        diagnostics: {
          plugins: {
            loaded: ["slides-slidev"],
            skipped: {},
          },
          slides: {
            active_plugin_id: "slides-slidev",
            engine: "slidev",
          },
        },
      }),
    ),
  );

  const { result } = renderHook(() => useRefine(), { wrapper: wrapSWR });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState("live");
  });

  await waitFor(() => {
    expect(result.current.tools).toHaveLength(1);
  });

  expect(result.current.tools[0].configSchema?.theme_preset_options).toEqual([
    {
      id: "default",
      label: "Default",
      template: {},
    },
  ]);
  expect(result.current.tools[0].configSchema?.preview?.service).toBe("slidev");
});
