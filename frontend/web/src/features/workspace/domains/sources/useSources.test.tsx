import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import { useSources } from "./useSources";

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

  server.use(
    http.get("*/v1/notebooks/:notebook_id/sources", () => HttpResponse.json([])),
    http.get("*/v1/notebooks/:notebook_id/sources/tags", () => HttpResponse.json([])),
    http.get("*/v1/notebooks/:notebook_id/sources/extractors", () =>
      HttpResponse.json({ extractors: [] }),
    ),
  );
});

test("handleSearch updates queue status and notice on success", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/sources/search", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        results: [{ url: "https://example.com", title: "Example" }],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({
      query: "hello",
      engine: "bing",
      mode: "web",
    });
  });

  expect(capturedBody).toEqual({
    query: "hello",
    engine: "bing",
    mode: "web",
  });

  await waitFor(() => {
    expect(result.current.searchQueue).toHaveLength(1);
    expect(result.current.searchQueue[0].status).toBe("success");
  });

  expect(result.current.searchNotice).toBe("已找到 1 条结果。");
});

test("removeSources calls batch delete endpoint and refreshes list", async () => {
  let deleteCalls = 0;
  let sourceListHits = 0;
  server.use(
    http.get("*/v1/notebooks/:notebook_id/sources", () => {
      sourceListHits += 1;
      return HttpResponse.json([]);
    }),
    http.delete("*/v1/notebooks/:notebook_id/sources/batch", async () => {
      deleteCalls += 1;
      return HttpResponse.json({
        deleted_count: 2,
        deleted_ids: [3, 4],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setActiveNotebook(7);
  });

  let success = false;
  await act(async () => {
    success = await result.current.removeSources([3, 4]);
  });

  expect(success).toBe(true);
  expect(deleteCalls).toBe(1);
  await waitFor(() => {
    expect(sourceListHits).toBeGreaterThan(1);
  });
});

test("handleUpload supports multiple files and exposes queue", async () => {
  let uploaded = 0;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/sources", async () => {
      uploaded += 1;
      return HttpResponse.json({ id: uploaded });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setActiveNotebook(11);
  });

  const fileA = new File(["aaa"], "a.txt", { type: "text/plain" });
  const fileB = new File(["bbb"], "b.md", { type: "text/markdown" });

  await act(async () => {
    await result.current.handleUpload([fileA, fileB]);
  });

  expect(uploaded).toBe(2);
  expect(result.current.uploadQueue.length).toBeGreaterThanOrEqual(2);
  expect(result.current.uploadQueue.every((item: any) => item.status === "success")).toBe(true);
});

test("batchReembedSources calls dedicated batch endpoint", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/sources/batch/re-embed", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        reembedded_count: 2,
        failed_count: 0,
        reembedded_ids: [5, 6],
        failed_ids: [],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setActiveNotebook(9);
  });

  let success = false;
  await act(async () => {
    success = await result.current.batchReembedSources([5, 6]);
  });

  expect(success).toBe(true);
  expect(capturedBody).toEqual({ source_ids: [5, 6] });
});

test("assignTagToSources sends selected source ids", async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post("*/v1/notebooks/:notebook_id/sources/tags/:tag_id/sources", async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        tag_id: 3,
        source_ids: [1, 2],
        count: 2,
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState("live");
    useWorkspaceStore.getState().setActiveNotebook(12);
  });

  let success = false;
  await act(async () => {
    success = await result.current.assignTagToSources(3, [1, 2]);
  });

  expect(success).toBe(true);
  expect(capturedBody).toEqual({ source_ids: [1, 2] });
});
