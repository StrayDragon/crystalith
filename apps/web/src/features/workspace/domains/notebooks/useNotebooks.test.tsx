import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test } from 'vitest';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useNotebooks } from './useNotebooks';

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
    autoCreatedNotebookId: null,
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
    outputTypeRenderDescriptors: {},
    outputTypeFrontendBundles: {},
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
});

test('loads notebooks and sets active notebook to the most recently updated', async () => {
  server.use(
    http.get('*/v1/notebooks', () =>
      HttpResponse.json([
        { id: 11, name: 'Core Notebook A', updated_at: '2026-01-01T00:00:00Z' },
        { id: 12, name: 'Core Notebook B', updated_at: '2026-02-01T00:00:00Z' },
      ]),
    ),
  );

  renderHook(() => useNotebooks(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().connectionState).toBe('live');
  });

  const state = useWorkspaceStore.getState();
  expect(state.notebooks.map((n) => n.id)).toEqual([11, 12]);
  expect(state.activeNotebookId).toBe(12);
  expect(state.errors.notebooks).toBe('');
});

test('sets error state when notebook listing fails', async () => {
  server.use(http.get('*/v1/notebooks', () => new HttpResponse(null, { status: 500 })));

  renderHook(() => useNotebooks(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().connectionState).toBe('error');
  });

  const state = useWorkspaceStore.getState();
  expect(state.notebooks).toEqual([]);
  expect(state.activeNotebookId).toBeNull();
  expect(state.errors.notebooks).toBe('未连接到后端服务，请检查后重试。');
});

test('auto-creates a default notebook when list is empty', async () => {
  let createCalls = 0;
  server.use(
    http.get('*/v1/notebooks', () => HttpResponse.json([])),
    http.post('*/v1/notebooks', async ({ request }) => {
      createCalls += 1;
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toEqual({ name: '未命名笔记本' });
      return HttpResponse.json({
        id: 21,
        name: '未命名笔记本',
        updated_at: '2026-01-01T00:00:00Z',
      });
    }),
  );

  renderHook(() => useNotebooks(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(createCalls).toBe(1);
    expect(useWorkspaceStore.getState().autoCreatedNotebookId).toBe(21);
    expect(useWorkspaceStore.getState().activeNotebookId).toBe(21);
  });

  expect(useWorkspaceStore.getState().notebooks.map((n) => n.id)).toEqual([21]);
});

test('handleCreateNotebook creates notebook and makes it active', async () => {
  let createCalls = 0;
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.get('*/v1/notebooks', () =>
      HttpResponse.json([{ id: 11, name: 'Existing', updated_at: '2026-01-01T00:00:00Z' }]),
    ),
    http.post('*/v1/notebooks', async ({ request }) => {
      createCalls += 1;
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: 99, name: 'New One', updated_at: '2026-01-01T00:00:00Z' });
    }),
  );

  const { result } = renderHook(() => useNotebooks(), { wrapper: wrapSWR });

  await waitFor(() => {
    expect(useWorkspaceStore.getState().connectionState).toBe('live');
  });

  act(() => {
    useWorkspaceStore.getState().setCreateName('New One');
  });

  let ok = false;
  await act(async () => {
    ok = await result.current.createNotebook();
  });

  expect(ok).toBe(true);
  expect(createCalls).toBe(1);
  expect(capturedBody).toEqual({ name: 'New One' });
  expect(useWorkspaceStore.getState().activeNotebookId).toBe(99);
  expect(useWorkspaceStore.getState().notebooks.map((n) => n.id)).toEqual([11, 99]);
});
