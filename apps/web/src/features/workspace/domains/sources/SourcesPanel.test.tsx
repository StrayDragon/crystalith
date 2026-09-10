import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef } from 'react';

import { toast } from '../../../../shared/toast';
import { TestProviders } from '../../../../test-utils/providers';
import type { SourceItem } from '../../shared/types';
import SourcesPanel from './SourcesPanel';

// Mock reason: react-virtuoso depends on layout/observer behaviors that are unstable in jsdom.
rs.mock('react-virtuoso', () => {
  return {
    Virtuoso: forwardRef(function VirtuosoMock(
      { data, itemContent }: { data: any[]; itemContent: (index: number, item: any) => any },
      _ref: unknown,
    ) {
      return (
        <div>
          {data.map((item: any, index: number) => (
            <div key={item.id}>{itemContent(index, item)}</div>
          ))}
        </div>
      );
    }),
  };
});

// Mock reason: isolate panel interaction tests from child component rendering details.
rs.mock('./SearchResultsQueue', () => ({
  default: () => null,
}));

// Mock reason: isolate panel interaction tests from child component rendering details.
rs.mock('./AddSearchResultDialog', () => ({
  default: () => null,
}));

let toastWarningSpy: ReturnType<typeof rs.spyOn>;

beforeEach(() => {
  // Mock reason: suppress visual toast side effects while asserting notification calls.
  toastWarningSpy = rs.spyOn(toast, 'warning').mockImplementation(() => {});
  rs.spyOn(toast, 'error').mockImplementation(() => {});
  rs.spyOn(toast, 'success').mockImplementation(() => {});
  rs.spyOn(toast, 'info').mockImplementation(() => {});

  rs.clearAllMocks();
  window.localStorage.removeItem('crystalith_search_mode');
});

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
    onUpload: rs.fn(),
    uploadState: 'idle' as const,
    uploadQueue: [],
    searchState: 'idle' as const,
    onSearch: rs.fn(),
    onAddSourceFromUrl: rs.fn().mockResolvedValue(undefined),
    onRemoveSources: rs.fn().mockResolvedValue(true),
    onRemoveSource: rs.fn().mockResolvedValue(true),
    onBatchReembedSources: rs.fn().mockResolvedValue(true),
    sourceTags: [
      {
        id: 11,
        notebookId: 1,
        name: '论文',
        createdAt: '2026-02-07T00:00:00Z',
        updatedAt: '2026-02-07T00:00:00Z',
      },
      {
        id: 12,
        notebookId: 1,
        name: '学习',
        createdAt: '2026-02-07T00:00:00Z',
        updatedAt: '2026-02-07T00:00:00Z',
      },
    ],
    tagMutationState: 'idle' as const,
    onCreateSourceTag: rs.fn().mockResolvedValue(null),
    onAssignTagToSources: rs.fn().mockResolvedValue(true),
    onRemoveTagFromSources: rs.fn().mockResolvedValue(true),
    sortBy: 'date' as const,
    sortOrder: 'desc' as const,
    tagFilter: '',
    onSortByChange: rs.fn(),
    onSortOrderChange: rs.fn(),
    onTagFilterChange: rs.fn(),
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
  const selectedSpy = rs.fn();
  const batchReembedSpy = rs.fn().mockResolvedValue(true);
  const props = createProps({
    onSelectedSourceIdsChange: selectedSpy,
    onBatchReembedSources: batchReembedSpy,
  });

  render(
    <TestProviders>
      <SourcesPanel {...props} />
    </TestProviders>,
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

  fireEvent.click(screen.getByRole('button', { name: '已选来源操作' }));
  fireEvent.click(screen.getByText(/重新嵌入/));

  await waitFor(() => {
    expect(batchReembedSpy).toHaveBeenCalledWith([1, 2, 3]);
  });
});

test('supports sort/filter controls and multi-file upload', async () => {
  const uploadSpy = rs.fn();
  const sortBySpy = rs.fn();
  const sortOrderSpy = rs.fn();
  const tagFilterSpy = rs.fn();

  const props = createProps({
    onUpload: uploadSpy,
    onSortByChange: sortBySpy,
    onSortOrderChange: sortOrderSpy,
    onTagFilterChange: tagFilterSpy,
  });

  render(
    <TestProviders>
      <SourcesPanel {...props} />
    </TestProviders>,
  );

  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['b'], 'b.md', { type: 'text/markdown' });

  fireEvent.change(screen.getByLabelText('上传来源文件'), {
    target: { files: [fileA, fileB] },
  });

  expect(uploadSpy).toHaveBeenCalledTimes(1);
  expect(uploadSpy.mock.calls[0][0]).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: '来源排序与筛选' }));
  fireEvent.click(screen.getByText('名称'));
  fireEvent.click(screen.getByText('升序'));
  fireEvent.click(screen.getByText('论文'));

  expect(sortBySpy).toHaveBeenCalledWith('name');
  expect(sortOrderSpy).toHaveBeenCalledWith('asc');
  expect(tagFilterSpy).toHaveBeenCalledWith('论文');
});

test('sources panel no longer hosts primary web search', () => {
  const props = createProps();

  render(
    <TestProviders>
      <SourcesPanel {...props} />
    </TestProviders>,
  );

  expect(screen.queryByPlaceholderText('在网络中搜索新来源')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '切换到深度研究' })).not.toBeInTheDocument();
});

test('filters unsupported upload files and shows warning', () => {
  const uploadSpy = rs.fn();
  const props = createProps({ onUpload: uploadSpy });

  render(
    <TestProviders>
      <SourcesPanel {...props} />
    </TestProviders>,
  );

  const supported = new File(['ok'], 'doc.md', { type: 'text/markdown' });
  const unsupported = new File(['bin'], 'archive.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  fireEvent.change(screen.getByLabelText('上传来源文件'), {
    target: { files: [supported, unsupported] },
  });

  expect(uploadSpy).toHaveBeenCalledTimes(1);
  expect(uploadSpy).toHaveBeenCalledWith([supported]);
  expect(toastWarningSpy).toHaveBeenCalledTimes(1);
});

test('accepts PDF upload via drag-and-drop', () => {
  const uploadSpy = rs.fn();
  const props = createProps({ onUpload: uploadSpy });

  render(
    <TestProviders>
      <SourcesPanel {...props} />
    </TestProviders>,
  );

  const pdf = new File(['pdf'], 'paper.pdf', { type: 'application/pdf' });

  fireEvent.drop(screen.getByRole('button', { name: '添加来源' }), {
    dataTransfer: { files: [pdf] },
  });

  expect(toastWarningSpy).not.toHaveBeenCalled();
  expect(uploadSpy).toHaveBeenCalledWith([pdf]);
});
