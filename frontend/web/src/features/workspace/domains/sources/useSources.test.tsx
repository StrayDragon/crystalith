import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useSources } from './useSources';
import { searchSourcesV1NotebooksNotebookIdSourcesSearchPost as searchSources } from '../../../../api/generated';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../api/generated', () => ({
  createSourceFromUrlV1NotebooksNotebookIdSourcesFromUrlPost: vi.fn(),
  convertOutputToSourceV1NotebooksNotebookIdOutputsOutputIdConvertToSourcePost: vi.fn(),
  convertSourceQaToSourceV1NotebooksNotebookIdSourcesSourceIdQaConvertToSourcePost: vi.fn(),
  deleteSourceV1NotebooksNotebookIdSourcesSourceIdDelete: vi.fn(),
  batchDeleteSourcesV1NotebooksNotebookIdSourcesDelete: vi.fn(),
  listExtractorsV1NotebooksNotebookIdSourcesExtractorsGet: vi.fn(),
  listSourcesV1NotebooksNotebookIdSourcesGet: vi.fn(),
  searchSourcesV1NotebooksNotebookIdSourcesSearchPost: vi.fn(),
  uploadSourceV1NotebooksNotebookIdSourcesPost: vi.fn(),
  reembedSourceV1NotebooksNotebookIdSourcesSourceIdReEmbedPost: vi.fn(),
}));

vi.mock('../../../../shared/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const swrMock = vi.mocked(useSWR);

beforeEach(() => {
  // Reset Zustand store to initial state
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
    data: undefined,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

test('handleSearch updates queue status and notice on success', async () => {
  vi.mocked(searchSources).mockResolvedValue({
    results: [{ url: 'https://example.com', title: 'Example' }],
  } as any);

  const { result } = renderHook(() => useSources());

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(1);
  });

  await act(async () => {
    await result.current.handleSearch({
      query: 'hello',
      engine: 'bing',
      mode: 'web',
    });
  });

  expect(searchSources).toHaveBeenCalledWith({
    path: { notebook_id: 1 },
    body: {
      query: 'hello',
      engine: 'bing',
      mode: 'web',
    },
  });

  await waitFor(() => {
    expect(result.current.searchQueue).toHaveLength(1);
    expect(result.current.searchQueue[0].status).toBe('success');
  });

  expect(result.current.searchNotice).toBe('已找到 1 条结果。');
});
