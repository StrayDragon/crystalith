import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useChat } from './useChat';

const streamRequestMock = rs.fn();

// Mock reason: deterministic SSE events for streaming chat path without real fetch streams.
rs.mock('../../../../api/stream', () => ({
  streamRequest: (...args: unknown[]) => streamRequestMock(...args),
}));

function wrapSWR({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

function buildSharedState(messageId: string, description = 'Mounted summary') {
  return {
    ui: {
      v: 1,
      components: {
        [`qa:${messageId}:summary`]: {
          type: 'ReportSection',
          schemaVersion: 1,
          props: {
            title: '统计摘要',
            description,
          },
          revision: 0,
          mounts: [{ messageId, slot: 'inline', order: 0 }],
          status: 'ready',
        },
      },
      datasets: {},
    },
  };
}

beforeEach(() => {
  streamRequestMock.mockReset();

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

  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions/:sessionId/messages', () =>
      HttpResponse.json({ items: [], total: 0, offset: 0, limit: 200 }),
    ),
  );
});

test('sendMessage swallows /research slash and does not call QA (c99)', async () => {
  const qaSpy = rs.fn();
  server.use(
    http.post('*/v2/notebooks/*/qa', async () => {
      qaSpy();
      return HttpResponse.json({ answer: 'nope' });
    }),
  );
  const pushState = rs.spyOn(window.history, 'pushState');
  const ensureSession = rs.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(62);
    s.setActiveSession(123);
    s.setDraft('/research xlsx');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(qaSpy).not.toHaveBeenCalled();
  expect(ensureSession).not.toHaveBeenCalled();
  expect(result.current.messages).toHaveLength(0);
  expect(result.current.draft).toBe('');
  expect(pushState).toHaveBeenCalled();
  const urlArg = String(pushState.mock.calls.at(-1)?.[2] ?? '');
  expect(urlArg).toContain('/research-lab/62');
  expect(urlArg).toContain('topic=');
  pushState.mockRestore();
});

test('sendMessage returns error when no notebook is active', async () => {
  const ensureSession = rs.fn().mockResolvedValue(1);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setDraft('Hello');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(result.current.sendError).toBe('请先创建笔记本。');
  expect(result.current.messages).toHaveLength(0);
});

test('sendMessage non-streaming path stores assistant message and shared_state mounts', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/*/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [{ chunkId: 5, chunkIndex: 1, sourceName: 'Doc', snippet: 'S' }],
        messageId: 9001,
        shared_state: buildSharedState('9001'),
        shared_state_revision: 1,
      });
    }),
  );

  const ensureSession = rs.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft('Hello');
  });

  await waitFor(() => {});

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  const assistant = result.current.messages[1];
  expect(assistant.id).toBe('9001');
  expect(assistant.content).toBe('Answer');
  expect(result.current.citations).toHaveLength(1);
  expect(capturedBody).toEqual({
    question: 'Hello',
    sessionId: 123,
  });
});

test('sendMessage passes selected source ids', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/*/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [],
        messageId: 9002,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      });
    }),
  );

  const ensureSession = rs.fn().mockResolvedValue(456);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(456);
    s.setSelectedSources({ 101: true, 102: true });
    s.setDraft('Hello');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(capturedBody).toEqual({
    question: 'Hello',
    sessionId: 456,
    sourceIds: [101, 102],
  });
});

test('sendMessage omits sourceIds when nothing is selected (ungrounded)', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/*/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Ungrounded answer',
        citations: [],
        messageId: 9004,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      });
    }),
  );

  const ensureSession = rs.fn().mockResolvedValue(789);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(789);
    s.setSelectedSources({});
    s.setDraft('Chat freely');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(capturedBody).toEqual({
    question: 'Chat freely',
    sessionId: 789,
  });
  expect(capturedBody).not.toHaveProperty('sourceIds');
});

test('streaming path applies snapshot and delta with backend message id', async () => {
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions/:sessionId/messages', () =>
      HttpResponse.json({
        items: [
          { id: 1, role: 'user', content: 'Hello streaming', citations: null },
          { id: 9003, role: 'assistant', content: 'Answer', citations: [] },
        ],
        total: 2,
        offset: 0,
        limit: 200,
      }),
    ),
  );

  streamRequestMock.mockImplementation(async function* () {
    yield {
      event: 'state_snapshot',
      data: {
        messageId: 9003,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    };
    yield { event: 'chunk', data: { text: 'Answer' } };
    yield {
      event: 'state_delta',
      data: {
        delta: [
          {
            op: 'add',
            path: '/ui/components/qa:9003:summary',
            value: {
              type: 'ReportSection',
              schemaVersion: 1,
              props: { title: '统计摘要', description: 'Stream mount' },
              revision: 0,
              mounts: [{ messageId: '9003', slot: 'inline', order: 0 }],
              status: 'ready',
            },
          },
        ],
      },
    };
    yield {
      event: 'done',
      data: {
        messageId: 9003,
        citations: [],
        shared_state_revision: 1,
      },
    };
  });

  const ensureSession = rs.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft('Hello streaming');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  expect(result.current.messages[1].id).toBe('9003');
  expect(result.current.messages[1].content).toBe('Answer');
  expect(streamRequestMock).toHaveBeenCalledWith(
    '/v2/notebooks/1/qa/stream',
    expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        question: 'Hello streaming',
        sessionId: 123,
      }),
    }),
  );
});

test('stopStreaming rolls back provisional assistant message before done', async () => {
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions/:sessionId/messages', () =>
      HttpResponse.json({
        items: [{ id: 1, role: 'user', content: 'Hello rollback', citations: null }],
        total: 1,
        offset: 0,
        limit: 200,
      }),
    ),
  );

  streamRequestMock.mockImplementation(async function* (
    _path: string,
    options: { signal?: AbortSignal } = {},
  ) {
    yield {
      event: 'state_snapshot',
      data: {
        messageId: 9004,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    };
    yield { event: 'chunk', data: { text: 'Partial answer' } };
    while (!options.signal?.aborted) {
      // eslint-disable-next-line no-await-in-loop -- Intentional polling in mocked SSE stream until aborted.
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  const ensureSession = rs.fn().mockResolvedValue(123);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(123);
    s.setDraft('Hello rollback');
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
    useWorkspaceStore.getState().messages.filter((message) => message.role === 'assistant'),
  ).toHaveLength(0);
  expect(
    useWorkspaceStore.getState().messages.filter((message) => message.role === 'user'),
  ).toHaveLength(1);
});
