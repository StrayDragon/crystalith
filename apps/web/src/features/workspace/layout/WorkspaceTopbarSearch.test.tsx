import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

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

beforeEach(() => {
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
    ...overrides,
  };
}

test('topbar trigger opens the E1 search panel with input and submit entry', () => {
  const props = createProps();

  const view = render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  const trigger = screen.getByTestId('topbar-search-trigger');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(trigger);
  expect(props.onOpenChange).toHaveBeenCalledWith(true);

  view.rerender(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} open={true} />
    </TestProviders>,
  );

  const panel = screen.getByRole('dialog', { name: '网络搜索' });
  expect(panel).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  // 面板包含来源搜索输入与提交动作
  const input = screen.getByLabelText('在网络中搜索新来源');
  const submit = screen.getByRole('button', { name: '开始搜索' });
  expect(input).toBeInTheDocument();
  expect(submit).toBeInTheDocument();

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

  expect(screen.getByRole('dialog', { name: '网络搜索' })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(props.onOpenChange).toHaveBeenCalledWith(false);

  fireEvent.click(screen.getByRole('button', { name: '关闭搜索面板' }));
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
});

test('topbar search submit is blocked while a search is running', () => {
  const props = createProps({ open: true, searchState: 'loading' });

  render(
    <TestProviders>
      <WorkspaceTopbarSearch {...props} />
    </TestProviders>,
  );

  const submit = screen.getByRole('button', { name: '开始搜索' });
  expect(submit).toBeDisabled();
  expect(props.onSearch).not.toHaveBeenCalled();
});
