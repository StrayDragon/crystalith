import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { REFINE_TEMPLATES } from './data/refineTemplates';
import { useRefine } from './useRefine';
import { refineBatchV1NotebooksNotebookIdRefineBatchPost as refineBatch } from '../../../../api/generated';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../shared/hooks/useOutputQueue', () => ({
  useOutputQueue: () => ({
    outputQueueJobs: [],
    enqueueOutputJob: vi.fn(),
    enqueueSlidesJob: vi.fn(),
    hasPendingJobs: () => false,
    outputsLoading: false,
    outputsError: '',
    retryOutputs: vi.fn(),
    retryOutputJob: vi.fn(),
    cancelOutputJob: vi.fn(),
    deleteOutput: vi.fn(),
    clearOutputs: vi.fn(),
    fetchOutput: vi.fn(),
  }),
}));

vi.mock('../../../../api/generated', () => ({
  listWorkspaceToolsV1WorkspaceToolsGet: vi.fn(),
  refineBatchV1NotebooksNotebookIdRefineBatchPost: vi.fn(),
}));

const swrMock = vi.mocked(useSWR);

beforeEach(() => {
  // Reset Zustand store
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

  swrMock.mockReturnValue({
    data: { tools: [] },
    error: null,
    isLoading: false,
  });
});

test('sets default refine prompt when empty', async () => {
  const { result } = renderHook(() => useRefine());

  await waitFor(() => {
    expect(result.current.refinePrompt).toBe(REFINE_TEMPLATES[0].prompt);
  });
});

test('onGenerateRefine enqueues job with selected source ids', async () => {
  vi.mocked(refineBatch).mockResolvedValue({
    outputs: { paragraph: { paragraph: 'Answer', bullets: [], structured: null } },
    citations: [{ chunk_id: 9, chunk_index: 1, source_name: 'Doc', snippet: 'S' }],
  } as any);

  const { result } = renderHook(() => useRefine());

  act(() => {
    const s = useWorkspaceStore.getState();
    s.setConnectionState('live');
    s.setActiveNotebook(1);
    s.setRefinePrompt('提炼核心结论');
    s.setSelectedSources({ 101: true, 102: true });
  });

  await act(async () => {
    await result.current.onGenerateRefine();
  });

  await waitFor(() => {
    expect(result.current.refineJobs).toHaveLength(1);
  });

  expect(result.current.refineJobs[0].sourceIds).toEqual([101, 102]);
  expect(useWorkspaceStore.getState().activePanel).toBe('refine');
  await waitFor(() => {
    expect(refineBatch).toHaveBeenCalledWith({
      path: { notebook_id: 1 },
      body: {
        prompt: '提炼核心结论',
        formats: expect.any(Array),
        source_ids: [101, 102],
      },
    });
  });
});
