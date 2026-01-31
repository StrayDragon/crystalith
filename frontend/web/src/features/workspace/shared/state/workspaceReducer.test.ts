import { expect, test } from 'vitest';

import { initialWorkspaceState, workspaceReducer } from './workspaceReducer';

test('SET_ACTIVE_NOTEBOOK resets notebook-scoped state and clears errors', () => {
  const state = {
    ...initialWorkspaceState,
    activeSessionId: 22,
    sources: [{ id: 1 } as any],
    sessions: [{ id: 2 } as any],
    messages: [{ id: 'm1', role: 'user', content: 'hi' } as any],
    outputs: [{ id: 9 } as any],
    citations: [{ id: 'c1' } as any],
    hoveredCitationChunkId: 3,
    hoveredMessageChunkIds: [1, 2],
    jumpToCitationChunkId: 4,
    refineJobs: [{ id: 'r1' } as any],
    hasNewOutput: true,
    recentCompletedJobId: 'job-1',
    errors: {
      ...initialWorkspaceState.errors,
      sources: 'bad',
      sessions: 'bad',
      messages: 'bad',
      outputs: 'bad',
      send: 'bad',
      create: 'keep',
    },
  };

  const next = workspaceReducer(state, { type: 'SET_ACTIVE_NOTEBOOK', payload: 100 });

  expect(next.activeNotebookId).toBe(100);
  expect(next.activeSessionId).toBeNull();
  expect(next.sources).toEqual([]);
  expect(next.sessions).toEqual([]);
  expect(next.messages).toEqual([]);
  expect(next.outputs).toEqual([]);
  expect(next.citations).toEqual([]);
  expect(next.hoveredCitationChunkId).toBeNull();
  expect(next.hoveredMessageChunkIds).toEqual([]);
  expect(next.jumpToCitationChunkId).toBeNull();
  expect(next.refineJobs).toEqual([]);
  expect(next.hasNewOutput).toBe(false);
  expect(next.recentCompletedJobId).toBeNull();
  expect(next.errors.create).toBe('keep');
  expect(next.errors.sources).toBe('');
  expect(next.errors.sessions).toBe('');
  expect(next.errors.messages).toBe('');
  expect(next.errors.outputs).toBe('');
  expect(next.errors.send).toBe('');
});

test('SET_ACTIVE_SESSION clears session-scoped state', () => {
  const state = {
    ...initialWorkspaceState,
    activeSessionId: 2,
    messages: [{ id: 'm1', role: 'user', content: 'hi' } as any],
    citations: [{ id: 'c1' } as any],
    hoveredCitationChunkId: 3,
    hoveredMessageChunkIds: [1, 2],
    jumpToCitationChunkId: 4,
    errors: { ...initialWorkspaceState.errors, messages: 'bad', send: 'bad' },
  };

  const next = workspaceReducer(state, { type: 'SET_ACTIVE_SESSION', payload: 55 });

  expect(next.activeSessionId).toBe(55);
  expect(next.messages).toEqual([]);
  expect(next.citations).toEqual([]);
  expect(next.hoveredCitationChunkId).toBeNull();
  expect(next.hoveredMessageChunkIds).toEqual([]);
  expect(next.jumpToCitationChunkId).toBeNull();
  expect(next.errors.messages).toBe('');
  expect(next.errors.send).toBe('');
});

test('APPEND_MESSAGE_CONTENT updates only the target message', () => {
  const state = {
    ...initialWorkspaceState,
    messages: [
      { id: 'a', role: 'assistant', content: 'Hello' } as any,
      { id: 'b', role: 'assistant', content: 'World' } as any,
    ],
  };

  const next = workspaceReducer(state, {
    type: 'APPEND_MESSAGE_CONTENT',
    payload: { messageId: 'a', text: '!' },
  });

  expect(next.messages[0].content).toBe('Hello!');
  expect(next.messages[1].content).toBe('World');
});

test('UPDATE_MESSAGE merges updates onto the matching message', () => {
  const state = {
    ...initialWorkspaceState,
    messages: [
      { id: 'a', role: 'assistant', content: 'Hello' } as any,
      { id: 'b', role: 'assistant', content: 'World' } as any,
    ],
  };

  const next = workspaceReducer(state, {
    type: 'UPDATE_MESSAGE',
    payload: { messageId: 'b', updates: { content: 'Updated', citations: [] } },
  });

  expect(next.messages[0].content).toBe('Hello');
  expect(next.messages[1].content).toBe('Updated');
  expect(next.messages[1].citations).toEqual([]);
});

test('SET_LOADING and SET_ERROR merge into nested state', () => {
  const state = { ...initialWorkspaceState };
  const withLoading = workspaceReducer(state, {
    type: 'SET_LOADING',
    payload: { key: 'sources', value: true },
  });
  expect(withLoading.loading.sources).toBe(true);

  const withError = workspaceReducer(withLoading, {
    type: 'SET_ERROR',
    payload: { key: 'sources', value: 'oops' },
  });
  expect(withError.errors.sources).toBe('oops');
});
