import { beforeEach, expect, test, rs } from '@rstest/core';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { server } from '../../../../test-utils/msw/server';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { reconcileMessages, useChat } from './useChat';

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
    // c122: typed-generation wire field
    generationTypeId: 'qa',
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
    // c122: typed-generation wire field
    generationTypeId: 'qa',
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
    // c122: typed-generation wire field
    generationTypeId: 'qa',
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

// covers: r400
test('sendMessage forwards /prompt directive text verbatim as question', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v2/notebooks/*/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [],
        messageId: 9501,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      });
    }),
  );

  const ensureSession = rs.fn().mockResolvedValue(321);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: false }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setActiveSession(321);
    s.setDraft('/prompt:analysis 总结这篇论文');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect((capturedBody as Record<string, unknown> | null)?.question).toBe(
    '/prompt:analysis 总结这篇论文',
  );
});

// covers: r404
test('streaming UI is driven by server state_snapshot stable messageId', async () => {
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions/:sessionId/messages', () =>
      HttpResponse.json({
        items: [
          { id: 1, role: 'user', content: 'snapshot drives ui', citations: null },
          {
            id: 9601,
            role: 'assistant',
            content: '快照驱动回答',
            citations: [{ chunkId: 7, chunkIndex: 1, sourceName: 'Doc', snippet: 'S' }],
          },
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
        messageId: 9601,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    };
    yield { event: 'chunk', data: { text: '快照驱动' } };
    yield { event: 'chunk', data: { text: '回答' } };
    yield {
      event: 'done',
      data: {
        messageId: 9601,
        citations: [{ chunkId: 7, chunkIndex: 1, sourceName: 'Doc', snippet: 'S' }],
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
    s.setDraft('snapshot drives ui');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  // 助手消息以服务端稳定 messageId 建立关联
  expect(result.current.messages[1].id).toBe('9601');
  expect(result.current.messages[1].content).toBe('快照驱动回答');
  // done 事件的 citations 挂到同一 messageId
  expect(result.current.messages[1].citations).toHaveLength(1);
  // 流结束后流式标记清除，UI 状态由快照权威
  expect(result.current.isStreaming).toBe(false);
  expect(result.current.streamingMessageId).toBeNull();
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

test('reconcileMessages keeps optimistic user rows when the fetch is still empty', () => {
  const local = [{ id: 'local-1', role: 'user' as const, content: '第一问' }];
  expect(reconcileMessages([], local, true)).toEqual(local);
  expect(reconcileMessages([], local, false)).toEqual([]);
});

test('reconcileMessages drops optimistic user once the server echo arrives', () => {
  const local = [{ id: 'local-1', role: 'user' as const, content: '第一问' }];
  const fetched = [{ id: '9', role: 'user' as const, content: '第一问' }];
  expect(reconcileMessages(fetched, local, true)).toEqual(fetched);
});

test('sendMessage keeps the optimistic user bubble if session create fetches []', async () => {
  streamRequestMock.mockImplementation(async function* () {
    yield {
      event: 'state_snapshot',
      data: { messageId: 7701, shared_state: buildSharedState('7701') },
    };
    yield { event: 'chunk', data: { text: '答' } };
    await new Promise<void>(() => {
      /* hold the stream so SWR's empty GET can race */
    });
  });

  const ensureSession = rs.fn().mockImplementation(async () => {
    useWorkspaceStore.getState().setActiveSession(88);
    return 88;
  });
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setDraft('第一问会出现在对话区');
  });

  act(() => {
    void result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(true);
  });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  });

  const userRows = useWorkspaceStore
    .getState()
    .messages.filter((message) => message.role === 'user');
  expect(userRows.some((message) => message.content === '第一问会出现在对话区')).toBe(true);

  act(() => {
    result.current.stopStreaming();
  });
});

test('streaming completion holds send flags until the post-done refetch lands', async () => {
  let sendStarted = false;
  let releaseRefetch: (() => void) | null = null;
  server.use(
    http.get('*/v2/notebooks/:notebookId/sessions/:sessionId/messages', () => {
      if (!sendStarted) {
        return HttpResponse.json({ items: [], total: 0, offset: 0, limit: 200 });
      }
      return new Promise((resolve) => {
        releaseRefetch = () =>
          resolve(
            HttpResponse.json({
              items: [
                { id: 1, role: 'user', content: '完成不闪', citations: null },
                { id: 9005, role: 'assistant', content: 'Answer', citations: [] },
              ],
              total: 2,
              offset: 0,
              limit: 200,
            }),
          );
      });
    }),
  );

  streamRequestMock.mockImplementation(async function* () {
    yield {
      event: 'state_snapshot',
      data: {
        messageId: 9005,
        shared_state: { ui: { v: 1, components: {}, datasets: {} } },
        shared_state_revision: 0,
      },
    };
    yield { event: 'chunk', data: { text: 'Answer' } };
    yield { event: 'done', data: { messageId: 9005, citations: [] } };
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
    s.setDraft('完成不闪');
  });

  await waitFor(() => {
    expect(result.current.isLoadingMessages).toBe(false);
  });

  let sendSettled = false;
  let sendPromise!: Promise<void>;
  await act(async () => {
    sendStarted = true;
    sendPromise = result.current.sendMessage().then(() => {
      sendSettled = true;
    });
  });

  // done processed: the finished exchange is visible while the refetch is gated
  await waitFor(() => {
    expect(
      useWorkspaceStore
        .getState()
        .messages.some((message) => message.id === '9005' && message.content === 'Answer'),
    ).toBe(true);
  });

  // Regression (known-issues 2026-10-15): flags must hold until the refetch
  // resolves — clearing them early re-runs the mirror with stale SWR data,
  // swapping the finished exchange out for one round-trip (visible flicker).
  expect(sendSettled).toBe(false);
  expect(useWorkspaceStore.getState().loading.send).toBe(true);
  expect(useWorkspaceStore.getState().messages.some((message) => message.role === 'user')).toBe(
    true,
  );

  await act(async () => {
    releaseRefetch?.();
    await sendPromise;
  });

  expect(sendSettled).toBe(true);
  expect(useWorkspaceStore.getState().messages.map((message) => message.id)).toEqual(['1', '9005']);
});

test('sendMessage session-create failure leaves no dangling optimistic bubble', async () => {
  const ensureSession = rs.fn().mockResolvedValue(null);
  const { result } = renderHook(() => useChat({ ensureSession, enableStreaming: true }), {
    wrapper: wrapSWR,
  });

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setDraft('会话创建失败的一问');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(result.current.sendError).toBe('会话创建失败。');
  expect(useWorkspaceStore.getState().messages).toHaveLength(0);
});
