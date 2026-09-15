import { beforeEach, expect, test } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useSources } from './useSources';

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
    draft: '',
    citations: [],
    hoveredCitationChunkId: null,
    hoveredMessageChunkIds: [],
    jumpToCitationChunkId: null,
    outputs: [],
    outputType: 'FAQ',
    refineMode: 'paragraph',
    refinePrompt: '',
    refineJobs: [],
    refineSettings: { autoTrigger: false, asyncQueue: true },
    hasNewOutput: false,
    recentCompletedJobId: null,
    activePanel: 'chat',
    createState: 'idle',
    createName: '',
    connectionState: 'connecting',
    uploadState: 'idle',
    loading: {
      notebooks: false,
      sources: false,
      sessions: false,
      messages: false,
      outputs: false,
      send: false,
    },
    errors: {
      notebooks: '',
      sources: '',
      sessions: '',
      messages: '',
      outputs: '',
      send: '',
      create: '',
    },
  });

  server.use(
    http.get('*/v2/notebooks/:notebookId/sources', () =>
      HttpResponse.json({ items: [], total: 0, offset: 0, limit: 200 }),
    ),
    http.get('*/v2/notebooks/:notebookId/sources/tags', () => HttpResponse.json([])),
    http.get('*/v2/notebooks/:notebookId/extractors', () =>
      HttpResponse.json({ extractors: [], defaultExtractor: null, policy: null }),
    ),
  );
});

test('handleSearch updates queue status and notice on success', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/search', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        results: [{ url: 'https://example.com', title: 'Example' }],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({
      query: 'hello',
      engine: 'bing',
      mode: 'Deep Research',
    });
  });

  expect(capturedBody).toEqual({
    query: 'hello',
    engine: 'bing',
    mode: 'Fast Research',
  });

  await waitFor(() => {
    expect(result.current.searchQueue).toHaveLength(1);
    expect(result.current.searchQueue[0].status).toBe('success');
    expect(result.current.searchQueue[0].notice).toBe('已找到 1 条结果。');
  });
});

test('handleSearch maps service_error to queue error state with server message (c65)', async () => {
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/search', () =>
      HttpResponse.json({
        status: 'service_error',
        query: 'hello',
        engine: 'searxng',
        mode: 'Fast Research',
        results: [],
        message: '搜索服务暂时不可用，请稍后重试。',
        createdAt: '2024-01-01T00:00:00Z',
      }),
    ),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({ query: 'hello', engine: 'Web', mode: 'Fast Research' });
  });

  await waitFor(() => {
    expect(result.current.searchQueue[0].status).toBe('error');
  });
  expect(result.current.searchQueue[0].notice).toBe('搜索服务暂时不可用，请稍后重试。');
  expect(result.current.searchQueue[0].results).toEqual([]);
});

test('handleSearch keeps no_results as success with empty-hit notice (c65)', async () => {
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/search', () =>
      HttpResponse.json({
        status: 'no_results',
        query: 'hello',
        engine: 'searxng',
        mode: 'Fast Research',
        results: [],
        createdAt: '2024-01-01T00:00:00Z',
      }),
    ),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({ query: 'hello', engine: 'Web', mode: 'Fast Research' });
  });

  await waitFor(() => {
    expect(result.current.searchQueue[0].status).toBe('success');
  });
  expect(result.current.searchQueue[0].notice).toBe('没有找到匹配结果。');
});

test('retrySearchQueueItem removes the failed item and re-runs the original query (c65)', async () => {
  let searches = 0;
  const queries: string[] = [];
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/search', async ({ request }) => {
      searches += 1;
      const body = (await request.json()) as { query: string };
      queries.push(body.query);
      return HttpResponse.json({
        status: searches === 1 ? 'service_error' : 'no_results',
        query: body.query,
        engine: 'searxng',
        mode: 'Fast Research',
        results: [],
        message: '搜索服务暂时不可用，请稍后重试。',
        createdAt: '2024-01-01T00:00:00Z',
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({ query: 'hello', engine: 'Web', mode: 'Fast Research' });
  });
  await waitFor(() => {
    expect(result.current.searchQueue[0].status).toBe('error');
  });

  await act(async () => {
    result.current.retrySearchQueueItem(result.current.searchQueue[0]);
  });

  await waitFor(() => {
    expect(result.current.searchQueue).toHaveLength(1);
    expect(result.current.searchQueue[0].status).toBe('success');
  });
  expect(searches).toBe(2);
  expect(queries).toEqual(['hello', 'hello']);
});

test('removeSources calls batch delete endpoint and refreshes list', async () => {
  let deleteCalls = 0;
  let sourceListHits = 0;
  server.use(
    http.get('*/v2/notebooks/:notebookId/sources', () => {
      sourceListHits += 1;
      return HttpResponse.json({ items: [], total: 0, offset: 0, limit: 200 });
    }),
    http.post('*/v2/notebooks/:notebookId/sources/batch/delete', async ({ request }) => {
      deleteCalls += 1;
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toEqual({ sourceIds: [3, 4] });
      return HttpResponse.json({
        deletedCount: 2,
        deletedIds: [3, 4],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
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

test('handleUpload supports multiple files and exposes queue', async () => {
  let uploaded = 0;
  const notebookIds: string[] = [];
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/upload', async ({ request }) => {
      uploaded += 1;
      const match = new URL(request.url).pathname.match(/\/notebooks\/(\d+)\/sources\/upload/);
      notebookIds.push(match?.[1] ?? '');
      return HttpResponse.json({
        sourceId: uploaded,
        chunkCount: 1,
        parserType: 'text',
        status: 'ready',
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(11);
  });

  const fileA = new File(['aaa'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['bbb'], 'b.md', { type: 'text/markdown' });

  await act(async () => {
    await result.current.handleUpload([fileA, fileB]);
  });

  expect(uploaded).toBe(2);
  expect(notebookIds).toEqual(['11', '11']);
  expect(result.current.uploadQueue.length).toBeGreaterThanOrEqual(2);
  expect(result.current.uploadQueue.every((item: any) => item.status === 'success')).toBe(true);
});

test('batchReembedSources calls dedicated batch endpoint', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/batch/re-embed', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        reembeddedCount: 2,
        failedCount: 0,
        reembeddedIds: [5, 6],
        failedIds: [],
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(9);
  });

  let success = false;
  await act(async () => {
    success = await result.current.batchReembedSources([5, 6]);
  });

  expect(success).toBe(true);
  expect(capturedBody).toEqual({ sourceIds: [5, 6] });
});

test('assignTagToSources sends selected source ids', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/:notebookId/sources/tags/:tag_id/sources', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        tagId: 3,
        sourceIds: [1, 2],
        count: 2,
      });
    }),
  );

  const { result } = renderHook(() => useSources(), { wrapper: wrapSWR });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(12);
  });

  let success = false;
  await act(async () => {
    success = await result.current.assignTagToSources(3, [1, 2]);
  });

  expect(success).toBe(true);
  expect(capturedBody).toEqual({ sourceIds: [1, 2] });
});
