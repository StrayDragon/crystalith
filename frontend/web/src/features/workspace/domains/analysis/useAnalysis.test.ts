import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";

import { renderHook } from "../../../../test-utils/renderHook";
import { server } from "../../../../test-utils/msw/server";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import { useAnalysis } from "./useAnalysis";

beforeEach(() => {
  useWorkspaceStore.setState({
    activeNotebookId: null,
    connectionState: "connecting",
  });
});

test("fetchAnalysis returns error when no notebook selected", async () => {
  const { result } = renderHook(() => useAnalysis());

  let analysis: unknown = null;
  await act(async () => {
    analysis = await result.current.fetchAnalysis();
  });

  expect(analysis).toBeNull();
  expect(result.current.error).toBe("请先选择笔记本。");
});

test("fetchAnalysis returns error when not connected", async () => {
  useWorkspaceStore.setState({ activeNotebookId: 1, connectionState: "connecting" });
  const { result } = renderHook(() => useAnalysis());

  let analysis: unknown = null;
  await act(async () => {
    analysis = await result.current.fetchAnalysis();
  });

  expect(analysis).toBeNull();
  expect(result.current.error).toBe("未连接到后端服务，无法分析。");
});

test("fetchAnalysis loads analysis for active notebook", async () => {
  useWorkspaceStore.setState({ activeNotebookId: 7, connectionState: "live" });
  server.use(
    http.get("*/v1/notebooks/:notebook_id/analysis", ({ params }) => {
      expect(params.notebook_id).toBe("7");
      return HttpResponse.json({ topics: [], relations: [], contradictions: [] });
    }),
  );

  const { result } = renderHook(() => useAnalysis());

  let analysis: unknown = null;
  await act(async () => {
    analysis = await result.current.fetchAnalysis();
  });

  expect(analysis).toEqual({ topics: [], relations: [], contradictions: [] });
  await waitFor(() => {
    expect(result.current.analysis).toEqual({ topics: [], relations: [], contradictions: [] });
  });
  expect(result.current.error).toBe("");
});

test("fetchAnalysis sets user-friendly error on failure", async () => {
  useWorkspaceStore.setState({ activeNotebookId: 7, connectionState: "live" });
  server.use(
    http.get("*/v1/notebooks/:notebook_id/analysis", () => new HttpResponse(null, { status: 500 })),
  );

  const { result } = renderHook(() => useAnalysis());

  let analysis: unknown = null;
  await act(async () => {
    analysis = await result.current.fetchAnalysis();
  });

  expect(analysis).toBeNull();
  expect(result.current.error).toBe("分析失败，请稍后重试。");
});
