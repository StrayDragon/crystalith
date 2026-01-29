import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceDispatch, useWorkspaceState, WorkspaceProvider } from '../../app/WorkspaceContext';
import { useChat } from './useChat';
import { askQuestionV1NotebooksNotebookIdQaPost as askQuestion } from '../../../../api/generated';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../api/generated', () => ({
  askQuestionV1NotebooksNotebookIdQaPost: vi.fn(),
  convertSessionToOutputV1NotebooksNotebookIdSessionsSessionIdConvertToOutputPost: vi.fn(),
  convertSessionToSourceV1NotebooksNotebookIdSessionsSessionIdConvertToSourcePost: vi.fn(),
  listMessagesV1NotebooksNotebookIdSessionsSessionIdMessagesGet: vi.fn(),
}));

const swrMock = vi.mocked(useSWR);

beforeEach(() => {
  swrMock.mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

function useChatHarness(options: Parameters<typeof useChat>[0]) {
  const chat = useChat(options);
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  return { chat, state, dispatch };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

test('sendMessage returns error when no notebook is active', async () => {
  const ensureSession = vi.fn().mockResolvedValue(1);
  const { result } = renderHook(
    () =>
      useChatHarness({
        ensureSession,
        enableStreaming: false,
      }),
    { wrapper },
  );

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_DRAFT', payload: 'Hello' });
  });

  await act(async () => {
    await result.current.chat.sendMessage();
  });

  expect(result.current.chat.sendError).toBe('请先创建笔记本。');
  expect(askQuestion).not.toHaveBeenCalled();
});

test('sendMessage non-streaming path stores assistant message and citations', async () => {
  vi.mocked(askQuestion).mockResolvedValue({
    answer: 'Answer',
    citations: [
      { chunk_id: 5, chunk_index: 1, source_name: 'Doc', snippet: 'S' },
    ],
  } as any);

  const ensureSession = vi.fn().mockResolvedValue(123);
  const { result } = renderHook(
    () =>
      useChatHarness({
        ensureSession,
        enableStreaming: false,
      }),
    { wrapper },
  );

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: 1 });
    result.current.dispatch({ type: 'SET_DRAFT', payload: 'Hello' });
  });

  await act(async () => {
    await result.current.chat.sendMessage();
  });

  await waitFor(() => {
    expect(result.current.chat.messages).toHaveLength(2);
  });

  const assistant = result.current.chat.messages[1];
  expect(assistant.content).toBe('Answer');
  expect(result.current.chat.citations).toHaveLength(1);
  expect(askQuestion).toHaveBeenCalledWith({
    path: { notebook_id: 1 },
    body: {
      question: 'Hello',
      session_id: 123,
      chunk_ids: undefined,
      source_ids: undefined,
    },
  });
});

test('sendMessage passes selected source ids', async () => {
  vi.mocked(askQuestion).mockResolvedValue({
    answer: 'Answer',
    citations: [
      { chunk_id: 5, chunk_index: 1, source_name: 'Doc', snippet: 'S' },
    ],
  } as any);

  const ensureSession = vi.fn().mockResolvedValue(456);
  const { result } = renderHook(
    () =>
      useChatHarness({
        ensureSession,
        enableStreaming: false,
      }),
    { wrapper },
  );

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: 1 });
    result.current.dispatch({
      type: 'SET_SELECTED_SOURCES',
      payload: { 101: true, 102: true },
    });
    result.current.dispatch({ type: 'SET_DRAFT', payload: 'Hello' });
  });

  await act(async () => {
    await result.current.chat.sendMessage();
  });

  expect(askQuestion).toHaveBeenCalledWith({
    path: { notebook_id: 1 },
    body: {
      question: 'Hello',
      session_id: 456,
      chunk_ids: undefined,
      source_ids: [101, 102],
    },
  });
});

test('sendMessage uses selected source ids when provided', async () => {
  vi.mocked(askQuestion).mockResolvedValue({
    answer: 'Answer',
    citations: [],
  } as any);

  const ensureSession = vi.fn().mockResolvedValue(789);
  const { result } = renderHook(
    () =>
      useChatHarness({
        ensureSession,
        enableStreaming: false,
      }),
    { wrapper },
  );

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: 1 });
    result.current.dispatch({
      type: 'SET_SOURCES',
      payload: [{ id: 101, title: 'Doc', type: 'md', status: 'READY', statusTone: 'READY', chunks: 2 }],
    });
    result.current.dispatch({
      type: 'SET_SELECTED_SOURCES',
      payload: { 101: true },
    });
    result.current.dispatch({ type: 'SET_DRAFT', payload: 'Hello' });
  });

  await act(async () => {
    await result.current.chat.sendMessage();
  });

  expect(askQuestion).toHaveBeenCalledWith({
    path: { notebook_id: 1 },
    body: {
      question: 'Hello',
      session_id: 789,
      chunk_ids: undefined,
      source_ids: [101],
    },
  });
});
