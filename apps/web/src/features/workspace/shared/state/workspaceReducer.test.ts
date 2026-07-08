import { beforeEach, expect, test } from 'vitest';

import { useWorkspaceStore } from './workspaceStore';

beforeEach(() => {
  // Reset store to initial state before each test
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
});

test('setActiveNotebook resets notebook-scoped state and clears errors', () => {
  // Set up initial state with some data
  useWorkspaceStore.setState({
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
      notebooks: '',
      sources: 'bad',
      sessions: 'bad',
      messages: 'bad',
      outputs: 'bad',
      send: 'bad',
      create: 'keep',
    },
  });

  useWorkspaceStore.getState().setActiveNotebook(100);

  const next = useWorkspaceStore.getState();
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

test('setActiveSession clears session-scoped state', () => {
  useWorkspaceStore.setState({
    activeSessionId: 2,
    messages: [{ id: 'm1', role: 'user', content: 'hi' } as any],
    citations: [{ id: 'c1' } as any],
    hoveredCitationChunkId: 3,
    hoveredMessageChunkIds: [1, 2],
    jumpToCitationChunkId: 4,
    errors: {
      notebooks: '',
      sources: '',
      sessions: '',
      messages: 'bad',
      outputs: '',
      send: 'bad',
      create: '',
    },
  });

  useWorkspaceStore.getState().setActiveSession(55);

  const next = useWorkspaceStore.getState();
  expect(next.activeSessionId).toBe(55);
  expect(next.messages).toEqual([]);
  expect(next.citations).toEqual([]);
  expect(next.hoveredCitationChunkId).toBeNull();
  expect(next.hoveredMessageChunkIds).toEqual([]);
  expect(next.jumpToCitationChunkId).toBeNull();
  expect(next.errors.messages).toBe('');
  expect(next.errors.send).toBe('');
});

test('appendMessageContent updates only the target message', () => {
  useWorkspaceStore.setState({
    messages: [
      { id: 'a', role: 'assistant', content: 'Hello' } as any,
      { id: 'b', role: 'assistant', content: 'World' } as any,
    ],
  });

  useWorkspaceStore.getState().appendMessageContent('a', '!');

  const next = useWorkspaceStore.getState();
  expect(next.messages[0].content).toBe('Hello!');
  expect(next.messages[1].content).toBe('World');
});

test('updateMessage merges updates onto the matching message', () => {
  useWorkspaceStore.setState({
    messages: [
      { id: 'a', role: 'assistant', content: 'Hello' } as any,
      { id: 'b', role: 'assistant', content: 'World' } as any,
    ],
  });

  useWorkspaceStore.getState().updateMessage('b', { content: 'Updated', citations: [] });

  const next = useWorkspaceStore.getState();
  expect(next.messages[0].content).toBe('Hello');
  expect(next.messages[1].content).toBe('Updated');
  expect(next.messages[1].citations).toEqual([]);
});

test('setLoading and setError merge into nested state', () => {
  useWorkspaceStore.getState().setLoading('sources', true);
  expect(useWorkspaceStore.getState().loading.sources).toBe(true);

  useWorkspaceStore.getState().setError('sources', 'oops');
  expect(useWorkspaceStore.getState().errors.sources).toBe('oops');
});
