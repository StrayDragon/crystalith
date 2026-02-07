import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import type { SourceItem } from '../../shared/types';
import { LayerProvider } from '../../../../shared/layer';
import SourcesPanel from './SourcesPanel';

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div>
      {data.map((item: any, index: number) => (
        <div key={item.id}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

vi.mock('../research/useResearch', () => ({
  useResearch: () => ({
    sessions: [],
    activeSession: null,
    sseEvents: [],
    isLoading: false,
    fetchSessions: vi.fn(),
    subscribeToSSE: vi.fn(),
    unsubscribeFromSSE: vi.fn(),
    clearEvents: vi.fn(),
    fetchSession: vi.fn().mockResolvedValue(null),
    startResearch: vi.fn(),
    deleteSession: vi.fn(),
    approveSearchPlan: vi.fn(),
    skipIteration: vi.fn(),
    finishResearch: vi.fn(),
    cancelResearch: vi.fn(),
    resumeResearch: vi.fn().mockResolvedValue(true),
    createSession: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('./SearchResultsQueue', () => ({
  default: () => null,
}));

vi.mock('./AddSearchResultDialog', () => ({
  default: () => null,
}));

vi.mock('../research/ResearchCapsule', () => ({
  default: () => null,
}));

const baseSources: SourceItem[] = [
  {
    id: 1,
    title: 'Doc 1',
    type: 'TXT',
    status: '已索引',
    statusTone: 'READY',
    chunks: 2,
    tags: ['论文'],
    createdAt: '2026-02-07 10:00',
    createdAtRaw: '2026-02-07T10:00:00Z',
  },
  {
    id: 2,
    title: 'Doc 2',
    type: 'Markdown',
    status: '已索引',
    statusTone: 'READY',
    chunks: 1,
    tags: [],
    createdAt: '2026-02-07 10:01',
    createdAtRaw: '2026-02-07T10:01:00Z',
  },
  {
    id: 3,
    title: 'Doc 3',
    type: 'TXT',
    status: '已索引',
    statusTone: 'READY',
    chunks: 4,
    tags: ['学习'],
    createdAt: '2026-02-07 10:02',
    createdAtRaw: '2026-02-07T10:02:00Z',
  },
];

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    sources: baseSources,
    onUpload: vi.fn(),
    uploadState: 'idle' as const,
    uploadQueue: [],
    searchState: 'idle' as const,
    searchNotice: '',
    searchResults: [],
    onSearch: vi.fn(),
    onClearSearchResults: vi.fn(),
    onAddSourceFromUrl: vi.fn().mockResolvedValue(undefined),
    onRemoveSources: vi.fn().mockResolvedValue(true),
    onRemoveSource: vi.fn().mockResolvedValue(true),
    onBatchReembedSources: vi.fn().mockResolvedValue(true),
    sourceTags: [
      { id: 11, notebook_id: 1, name: '论文', created_at: '2026-02-07T00:00:00Z', updated_at: '2026-02-07T00:00:00Z' },
      { id: 12, notebook_id: 1, name: '学习', created_at: '2026-02-07T00:00:00Z', updated_at: '2026-02-07T00:00:00Z' },
    ],
    tagMutationState: 'idle' as const,
    onCreateSourceTag: vi.fn().mockResolvedValue(null),
    onAssignTagToSources: vi.fn().mockResolvedValue(true),
    onRemoveTagFromSources: vi.fn().mockResolvedValue(true),
    sortBy: 'date' as const,
    sortOrder: 'desc' as const,
    tagFilter: '',
    onSortByChange: vi.fn(),
    onSortOrderChange: vi.fn(),
    onTagFilterChange: vi.fn(),
    isConnected: true,
    isLoading: false,
    removeState: 'idle' as const,
    searchQueue: [],
    availableExtractors: [],
    defaultExtractor: null,
    notebookId: 1,
    ...overrides,
  };
}

test('supports ctrl/shift multi-select and batch re-embed', async () => {
  const selectedSpy = vi.fn();
  const batchReembedSpy = vi.fn().mockResolvedValue(true);
  const props = createProps({
    onSelectedSourceIdsChange: selectedSpy,
    onBatchReembedSources: batchReembedSpy,
  });

  render(
    <LayerProvider>
      <SourcesPanel {...props} />
    </LayerProvider>,
  );

  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);

  fireEvent.click(screen.getByRole('button', { name: '打开来源 Doc 1' }), { ctrlKey: true });
  fireEvent.click(screen.getByRole('button', { name: '打开来源 Doc 3' }), { shiftKey: true });

  await waitFor(() => {
    const last = selectedSpy.mock.calls.at(-1)?.[0] as Record<number, boolean>;
    expect(last[1]).toBe(true);
    expect(last[2]).toBe(true);
    expect(last[3]).toBe(true);
  });

  fireEvent.click(screen.getByRole('button', { name: '批量 re-embed' }));

  await waitFor(() => {
    expect(batchReembedSpy).toHaveBeenCalledWith([1, 2, 3]);
  });
});

test('supports sort/filter controls and multi-file upload', async () => {
  const uploadSpy = vi.fn();
  const sortBySpy = vi.fn();
  const sortOrderSpy = vi.fn();
  const tagFilterSpy = vi.fn();

  const props = createProps({
    onUpload: uploadSpy,
    onSortByChange: sortBySpy,
    onSortOrderChange: sortOrderSpy,
    onTagFilterChange: tagFilterSpy,
  });

  render(
    <LayerProvider>
      <SourcesPanel {...props} />
    </LayerProvider>,
  );

  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['b'], 'b.md', { type: 'text/markdown' });

  fireEvent.change(screen.getByLabelText('上传来源文件'), {
    target: { files: [fileA, fileB] },
  });

  expect(uploadSpy).toHaveBeenCalledTimes(1);
  expect(uploadSpy.mock.calls[0][0]).toHaveLength(2);

  fireEvent.change(screen.getByLabelText('来源排序字段'), { target: { value: 'name' } });
  fireEvent.change(screen.getByLabelText('来源排序方向'), { target: { value: 'asc' } });
  fireEvent.change(screen.getByLabelText('来源标签筛选'), { target: { value: '论文' } });

  expect(sortBySpy).toHaveBeenCalledWith('name');
  expect(sortOrderSpy).toHaveBeenCalledWith('asc');
  expect(tagFilterSpy).toHaveBeenCalledWith('论文');
});
