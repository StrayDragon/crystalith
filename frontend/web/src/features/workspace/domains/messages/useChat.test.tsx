import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';

import { renderHook } from '../../../../test-utils/renderHook';
import { server } from '../../../../test-utils/msw/server';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useChat } from './useChat';
import { client } from '../../../../api/generated/client.gen';

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
    loading: { notebooks: false, sources: false, sessions: false, messages: false, outputs: false, send: false },
    errors: { notebooks: '', sources: '', sessions: '', messages: '', outputs: '', send: '', create: '' },
  });

  server.use(
    http.get('*/v1/notebooks/:notebook_id/sessions/:session_id/messages', () => HttpResponse.json([])),
  );
});

test('sendMessage returns error when no notebook is active', async () => {
  const ensureSession = vi.fn().mockResolvedValue(1);
  const { result } = renderHook(() =>
    useChat({ ensureSession, enableStreaming: false }), { wrapper: wrapSWR },
  );

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

test('sendMessage non-streaming path stores assistant message and citations', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v1/notebooks/:notebook_id/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [
          { chunk_id: 5, chunk_index: 1, source_name: 'Doc', snippet: 'S' },
        ],
      });
    }),
  );

  const ensureSession = vi.fn().mockResolvedValue(123);
  const { result } = renderHook(() =>
    useChat({ ensureSession, enableStreaming: false }), { wrapper: wrapSWR },
  );

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setDraft('Hello');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2);
  });

  const assistant = result.current.messages[1];
  expect(assistant.content).toBe('Answer');
  expect(result.current.citations).toHaveLength(1);
  expect(capturedBody).toEqual({
    question: 'Hello',
    session_id: 123,
  });
});

test('sendMessage passes selected source ids', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v1/notebooks/:notebook_id/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [
          { chunk_id: 5, chunk_index: 1, source_name: 'Doc', snippet: 'S' },
        ],
      });
    }),
  );

  const ensureSession = vi.fn().mockResolvedValue(456);
  const { result } = renderHook(() =>
    useChat({ ensureSession, enableStreaming: false }), { wrapper: wrapSWR },
  );

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setSelectedSources({ 101: true, 102: true });
    s.setDraft('Hello');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(capturedBody).toEqual({
    question: 'Hello',
    session_id: 456,
    source_ids: [101, 102],
  });
});

test('sendMessage uses selected source ids when provided', async () => {
  let capturedBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/v1/notebooks/:notebook_id/qa', async ({ request }) => {
      capturedBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        answer: 'Answer',
        citations: [],
      });
    }),
  );

  const ensureSession = vi.fn().mockResolvedValue(789);
  const { result } = renderHook(() =>
    useChat({ ensureSession, enableStreaming: false }), { wrapper: wrapSWR },
  );

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setSources([{
      id: 101,
      title: 'Doc',
      type: 'md',
      status: 'READY',
      statusTone: 'READY',
      chunks: 2,
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
    }]);
    s.setSelectedSources({ 101: true });
    s.setDraft('Hello');
  });

  await act(async () => {
    await result.current.sendMessage();
  });

  expect(capturedBody).toEqual({
    question: 'Hello',
    session_id: 789,
    source_ids: [101],
  });
});

test('stopStreaming aborts active stream generation', async () => {
  // Mock reason: streaming abort/flush lifecycle is hard to deterministically emulate with fetch SSE in jsdom.
  const ssePostMock = vi.spyOn(client.sse, 'post');
  let capturedSignal: AbortSignal | undefined;

  ssePostMock.mockImplementation(async ({ signal }: any) => {
    capturedSignal = signal;
    return {
      stream: (async function* streamEvents() {
        while (!signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })(),
    } as any;
  });

  const ensureSession = vi.fn().mockResolvedValue(1001);
  const { result } = renderHook(() =>
    useChat({ ensureSession, enableStreaming: true }), { wrapper: wrapSWR },
  );

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setDraft('Hello streaming');
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
    expect(capturedSignal?.aborted).toBe(true);
  });

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(false);
  });

  ssePostMock.mockRestore();
});
