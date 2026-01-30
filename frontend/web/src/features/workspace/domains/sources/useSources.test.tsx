import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceDispatch, useWorkspaceState, WorkspaceProvider } from '../../app/WorkspaceContext';
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
  swrMock.mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

function useSourcesHarness() {
  const sources = useSources();
  const state = useWorkspaceState();
  const dispatch = useWorkspaceDispatch();
  return { sources, state, dispatch };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <WorkspaceProvider>{children}</WorkspaceProvider>
);

test('handleSearch updates queue status and notice on success', async () => {
  vi.mocked(searchSources).mockResolvedValue({
    results: [{ url: 'https://example.com', title: 'Example' }],
  } as any);

  const { result } = renderHook(() => useSourcesHarness(), { wrapper });

  act(() => {
    result.current.dispatch({ type: 'SET_CONNECTION_STATE', payload: 'live' });
    result.current.dispatch({ type: 'SET_ACTIVE_NOTEBOOK', payload: 1 });
  });

  await act(async () => {
    await result.current.sources.handleSearch({
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
    expect(result.current.sources.searchQueue).toHaveLength(1);
    expect(result.current.sources.searchQueue[0].status).toBe('success');
  });

  expect(result.current.sources.searchNotice).toBe('已找到 1 条结果。');
});
