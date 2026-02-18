import { act, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import useSWR from 'swr';

import {
  assignTagToSourcesV1NotebooksNotebookIdSourcesTagsTagIdSourcesPost as assignTagToSources,
  batchDeleteSourcesV1NotebooksNotebookIdSourcesBatchDelete as batchDeleteSources,
  batchReembedSourcesV1NotebooksNotebookIdSourcesBatchReEmbedPost as batchReembedSources,
  searchSourcesV1NotebooksNotebookIdSourcesSearchPost as searchSources,
  uploadSourceV1NotebooksNotebookIdSourcesPost as uploadSource,
} from '../../../../api/generated';
import { renderHook } from '../../../../test-utils/renderHook';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import { useSources } from './useSources';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../api/generated', () => ({
  assignTagToSourcesV1NotebooksNotebookIdSourcesTagsTagIdSourcesPost: vi.fn(),
  batchDeleteSourcesV1NotebooksNotebookIdSourcesBatchDelete: vi.fn(),
  batchReembedSourcesV1NotebooksNotebookIdSourcesBatchReEmbedPost: vi.fn(),
  createSourceFromUrlV1NotebooksNotebookIdSourcesFromUrlPost: vi.fn(),
  convertOutputToSourceV1NotebooksNotebookIdOutputsOutputIdConvertToSourcePost: vi.fn(),
  convertSourceQaToSourceV1NotebooksNotebookIdSourcesSourceIdQaConvertToSourcePost: vi.fn(),
  createSourceTagV1NotebooksNotebookIdSourcesTagsPost: vi.fn(),
  deleteSourceV1NotebooksNotebookIdSourcesSourceIdDelete: vi.fn(),
  deleteSourceTagV1NotebooksNotebookIdSourcesTagsTagIdDelete: vi.fn(),
  listExtractorsV1NotebooksNotebookIdSourcesExtractorsGet: vi.fn(),
  listSourceTagsV1NotebooksNotebookIdSourcesTagsGet: vi.fn(),
  listSourcesV1NotebooksNotebookIdSourcesGet: vi.fn(),
  removeTagFromSourcesV1NotebooksNotebookIdSourcesTagsTagIdSourcesDelete: vi.fn(),
  searchSourcesV1NotebooksNotebookIdSourcesSearchPost: vi.fn(),
  updateSourceTagV1NotebooksNotebookIdSourcesTagsTagIdPatch: vi.fn(),
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

let mutateSourcesMock: ReturnType<typeof vi.fn>;
let mutateTagsMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mutateSourcesMock = vi.fn();
  mutateTagsMock = vi.fn();

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

  const stableSourcesData: any[] = [];
  const stableSourceTagsData: any[] = [];
  const sourcesSWRResult = {
    data: stableSourcesData,
    error: null,
    isLoading: false,
    mutate: mutateSourcesMock,
  } as any;
  const tagsSWRResult = {
    data: stableSourceTagsData,
    error: null,
    isLoading: false,
    mutate: mutateTagsMock,
  } as any;
  const defaultSWRResult = {
    data: undefined,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  } as any;

  swrMock.mockImplementation((key: any) => {
    if (Array.isArray(key) && key[0] === 'workspace/sources') {
      return sourcesSWRResult;
    }
    if (Array.isArray(key) && key[0] === 'workspace/source-tags') {
      return tagsSWRResult;
    }
    return defaultSWRResult;
  });
});

test('handleSearch updates queue status and notice on success', async () => {
  vi.mocked(searchSources).mockResolvedValue({
    data: {
      results: [{ url: 'https://example.com', title: 'Example' }],
    },
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

test('removeSources calls batch delete endpoint and refreshes list', async () => {
  vi.mocked(batchDeleteSources).mockResolvedValue({
    data: {
      deleted_count: 2,
      deleted_ids: [3, 4],
    },
  } as any);

  const { result } = renderHook(() => useSources());

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(7);
  });

  let success = false;
  await act(async () => {
    success = await result.current.removeSources([3, 4]);
  });

  expect(success).toBe(true);
  expect(batchDeleteSources).toHaveBeenCalledWith({
    path: { notebook_id: 7 },
    body: { source_ids: [3, 4] },
  });
  expect(mutateSourcesMock).toHaveBeenCalled();
});

test('handleUpload supports multiple files and exposes queue', async () => {
  vi.mocked(uploadSource).mockResolvedValue({ data: { id: 1 } } as any);

  const { result } = renderHook(() => useSources());

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(11);
  });

  const fileA = new File(['aaa'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['bbb'], 'b.md', { type: 'text/markdown' });

  await act(async () => {
    await result.current.handleUpload([fileA, fileB]);
  });

  expect(uploadSource).toHaveBeenCalledTimes(2);
  expect(uploadSource).toHaveBeenNthCalledWith(1, {
    path: { notebook_id: 11 },
    body: { file: fileA },
  });
  expect(uploadSource).toHaveBeenNthCalledWith(2, {
    path: { notebook_id: 11 },
    body: { file: fileB },
  });

  expect(result.current.uploadQueue.length).toBeGreaterThanOrEqual(2);
  expect(result.current.uploadQueue.every((item: any) => item.status === 'success')).toBe(true);
});

test('batchReembedSources calls dedicated batch endpoint', async () => {
  vi.mocked(batchReembedSources).mockResolvedValue({
    data: {
      reembedded_count: 2,
      failed_count: 0,
      reembedded_ids: [5, 6],
      failed_ids: [],
    },
  } as any);

  const { result } = renderHook(() => useSources());

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(9);
  });

  let success = false;
  await act(async () => {
    success = await result.current.batchReembedSources([5, 6]);
  });

  expect(success).toBe(true);
  expect(batchReembedSources).toHaveBeenCalledWith({
    path: { notebook_id: 9 },
    body: { source_ids: [5, 6] },
  });
});

test('assignTagToSources sends selected source ids', async () => {
  vi.mocked(assignTagToSources).mockResolvedValue({
    data: {
      tag_id: 3,
      source_ids: [1, 2],
      count: 2,
    },
  } as any);

  const { result } = renderHook(() => useSources());

  act(() => {
    useWorkspaceStore.getState().setConnectionState('live');
    useWorkspaceStore.getState().setActiveNotebook(12);
  });

  let success = false;
  await act(async () => {
    success = await result.current.assignTagToSources(3, [1, 2]);
  });

  expect(success).toBe(true);
  expect(assignTagToSources).toHaveBeenCalledWith({
    path: { notebook_id: 12, tag_id: 3 },
    body: { source_ids: [1, 2] },
  });
  expect(mutateTagsMock).toHaveBeenCalled();
  expect(mutateSourcesMock).toHaveBeenCalled();
});
