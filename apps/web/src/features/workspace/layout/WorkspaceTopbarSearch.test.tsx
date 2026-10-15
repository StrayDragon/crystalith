import type { SearchResponse } from '@crystalith/shared';
import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { toast } from '../../../shared/toast';
import { TestProviders } from '../../../test-utils/providers';
import WorkspaceTopbarSearch, { FAST_SEARCH_MODE } from './WorkspaceTopbarSearch';

// Mock reason: isolate E1 panel tests from search result queue child rendering.
rs.mock('../../domains/sources/SearchResultsQueue', () => ({
  default: () => null,
}));

// Mock reason: isolate E1 panel tests from add-result dialog rendering.
rs.mock('../../domains/sources/AddSearchResultDialog', () => ({
  default: () => null,
}));

// c132: KB mode talks to POST /v2/search via the eden client — stub it.
const searchPostMock = rs.fn();
rs.mock('../../../api/eden', () => ({
  api: { v2: { search: { post: (...args: unknown[]) => searchPostMock(...args) } } },
}));

beforeEach(() => {
  searchPostMock.mockReset();
  rs.spyOn(toast, 'warning').mockImplementation(() => {});
  rs.spyOn(toast, 'error').mockImplementation(() => {});
  rs.spyOn(toast, 'success').mockImplementation(() => {});
  rs.spyOn(toast, 'info').mockImplementation(() => {});
});

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    open: false,
    onOpenChange: rs.fn(),
    searchState: 'idle' as const,
    searchQueue: [],
    onSearch: rs.fn(),
    onAddSourceFromUrl: rs.fn().mockResolvedValue(undefined),
    availableExtractors: [],
    defaultExtractor: null,
    activeNotebookId: 7,
    activeNotebookTitle: '笔记本甲',
    onJumpToSource: rs.fn(),
    onJumpToOutput: rs.fn(),
    ...overrides,
  };
}

const flushDebounce = () => new Promise((r) => setTimeout(r, 360));

function kbResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    results: [
      {
        chunkId: 11,
        text: '来源块命中内容',
        score: 0.9,
        originType: 'source',
        originId: 3,
        sourceId: 3,
        sourceTitle: '资料甲.md',
        notebookId: 7,
        notebookTitle: '笔记本甲',
        chunkIndex: 0,
        modality: 'text',
      },
      {
        chunkId: 22,
        text: '产出命中内容',
        score: 0.8,
        originType: 'output',
        originId: 9,
        sourceId: 4,
        sourceTitle: 'GUIDE-9',
        notebookId: 8,
        notebookTitle: '笔记本乙',
        chunkIndex: 0,
        modality: 'text',
      },
    ],
    facets: {
      notebooks: [
        { notebookId: 7, title: '笔记本甲', count: 1 },
        { notebookId: 8, title: '笔记本乙', count: 1 },
      ],
      originTypes: [
        { type: 'source', count: 1 },
        { type: 'output', count: 1 },
      ],
    },
    ...overrides,
  };
}

test('panel opens in kb mode by default; web mode keeps the E1 flow', async () => {
  const props = createProps({ open: true });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  const panel = screen.getByRole('dialog', { name: '搜索面板' });
  expect(panel).toBeInTheDocument();
  // KB mode is the default: kb input visible, web submit absent.
  expect(screen.getByTestId('kb-search-input')).toBeInTheDocument();
  expect(screen.queryByTestId('sources-search-submit')).not.toBeInTheDocument();

  // Switch to Fast web search — the E1 body returns.
  fireEvent.click(screen.getByTestId('topbar-search-mode-web'));
  const input = screen.getByLabelText('在网络中搜索新来源');
  const submit = screen.getByRole('button', { name: '开始搜索' });
  fireEvent.change(input, { target: { value: 'graphrag survey' } });
  fireEvent.click(submit);
  expect(props.onSearch).toHaveBeenCalledWith({
    query: 'graphrag survey',
    engine: 'Web',
    mode: FAST_SEARCH_MODE,
  });
});

test('topbar search panel closes via Esc and backdrop', () => {
  const props = createProps({ open: true });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  expect(screen.getByRole('dialog', { name: '搜索面板' })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(props.onOpenChange).toHaveBeenCalledWith(false);

  fireEvent.click(screen.getByRole('button', { name: '关闭搜索面板' }));
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

test('topbar web search submit is blocked while a search is running', () => {
  const props = createProps({ open: true, searchState: 'loading' });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  fireEvent.click(screen.getByTestId('topbar-search-mode-web'));
  const submit = screen.getByRole('button', { name: '开始搜索' });
  expect(submit).toBeDisabled();
  expect(props.onSearch).not.toHaveBeenCalled();
});

test('kb search: debounced query → grouped results → source jump closes panel', async () => {
  searchPostMock.mockResolvedValue({ data: kbResponse(), error: null });
  const props = createProps({ open: true });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  fireEvent.change(screen.getByTestId('kb-search-input'), {
    target: { value: '命中' },
  });

  // Debounce: no call before the window passes.
  expect(searchPostMock).not.toHaveBeenCalled();
  await flushDebounce();

  await waitFor(() => {
    expect(searchPostMock).toHaveBeenCalledTimes(1);
  });
  expect(searchPostMock).toHaveBeenCalledWith({ query: '命中' });

  // Grouped by notebook with both group titles visible.
  const results = screen.getByTestId('kb-search-results');
  expect(results).toHaveTextContent('笔记本甲');
  expect(results).toHaveTextContent('笔记本乙');

  // Jump: the source item fires onJumpToSource (with notebook context for the
  // cross-notebook fallback fetch) + closes the panel.
  fireEvent.click(screen.getAllByTestId('kb-search-result-item')[0]);
  expect(props.onJumpToSource).toHaveBeenCalledWith(3, 11, 7);
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

test('kb search: output item jumps to the output viewer', async () => {
  searchPostMock.mockResolvedValue({ data: kbResponse(), error: null });
  const props = createProps({ open: true });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  fireEvent.change(screen.getByTestId('kb-search-input'), {
    target: { value: '命中' },
  });
  await flushDebounce();
  await waitFor(() => {
    expect(screen.getAllByTestId('kb-search-result-item').length).toBe(2);
  });

  fireEvent.click(screen.getAllByTestId('kb-search-result-item')[1]);
  expect(props.onJumpToOutput).toHaveBeenCalledWith(9, 8);
  expect(props.onJumpToSource).not.toHaveBeenCalled();
});

test('kb search: notebook scope toggle reaches the request; degraded banner shows', async () => {
  searchPostMock.mockResolvedValue({
    data: kbResponse({ degraded: 'index_rebuilding' }),
    error: null,
  });
  const props = createProps({ open: true });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  fireEvent.click(screen.getByTestId('kb-search-scope-notebook'));
  fireEvent.change(screen.getByTestId('kb-search-input'), {
    target: { value: '命中' },
  });
  await flushDebounce();

  await waitFor(() => {
    expect(searchPostMock).toHaveBeenCalledWith({
      query: '命中',
      scope: { kind: 'notebook', notebookId: 7 },
    });
  });
  expect(screen.getByTestId('kb-search-degraded')).toHaveTextContent('索引重建中');
});
