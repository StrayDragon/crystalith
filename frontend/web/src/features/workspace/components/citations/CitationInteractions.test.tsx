import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import type { Citation } from '../../types';
import CitationActions from './CitationActions';
import CitationList from './CitationList';
import CitationMark from './CitationMark';

const sampleCitations: Citation[] = [
  {
    id: '1',
    chunkId: 11,
    sourceTitle: '需求说明.md',
    snippet: '短引用片段。',
    chunkIndex: 1,
    pageNumber: 2,
  },
  {
    id: '2',
    chunkId: 12,
    sourceTitle: '需求说明.md',
    snippet: '长引用片段'.repeat(40),
    chunkIndex: 2,
    pageNumber: 4,
  },
  {
    id: '3',
    chunkId: 21,
    sourceTitle: '访谈纪要.md',
    snippet: '第二来源的引用内容。',
    chunkIndex: 1,
    pageNumber: null,
  },
];

test('citation mark shows tooltip preview on hover', async () => {
  render(
    <CitationMark
      index={1}
      citation={sampleCitations[0]}
      onHover={vi.fn()}
      onJump={vi.fn()}
    />,
  );

  await userEvent.hover(screen.getByText('[1]'));

  expect(screen.getByRole('tooltip')).toHaveTextContent('需求说明.md');
  expect(screen.getByRole('tooltip')).toHaveTextContent('第 2 页');
  expect(screen.getByRole('tooltip')).toHaveTextContent('短引用片段');
});

test('groups citations by source and toggles snippet expansion', async () => {
  render(
    <CitationList
      citations={sampleCitations}
      selectedCitationIds={new Set()}
      highlightedChunkIds={new Set()}
      jumpToCitationChunkId={null}
      onToggleCitation={vi.fn()}
      onCitationHover={vi.fn()}
    />,
  );

  expect(screen.getByText('需求说明.md')).toBeInTheDocument();
  expect(screen.getByText('访谈纪要.md')).toBeInTheDocument();
  expect(screen.getAllByText('2 条引用')[0]).toBeInTheDocument();

  const expandButton = screen.getByRole('button', { name: '展开' });
  expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(expandButton);
  expect(expandButton).toHaveAttribute('aria-expanded', 'true');
  expect(expandButton).toHaveTextContent('收起');
});

test('citation list scrolls to highlighted chunk on jump', async () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy;

  render(
    <CitationList
      citations={sampleCitations}
      selectedCitationIds={new Set()}
      highlightedChunkIds={new Set([12])}
      jumpToCitationChunkId={12}
      onToggleCitation={vi.fn()}
      onCitationHover={vi.fn()}
    />,
  );

  await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
  const highlighted = document.querySelector('[data-chunk-id="12"]');
  expect(highlighted).toHaveClass('isHighlighted');

  Element.prototype.scrollIntoView = originalScrollIntoView;
});

test('citation actions trigger callbacks', async () => {
  const onSendSelected = vi.fn();
  const onCompareSelected = vi.fn();
  const onCopySelected = vi.fn();
  const onSelectAll = vi.fn();
  const onClearSelection = vi.fn();

  render(
    <CitationActions
      selectedCount={2}
      totalCount={3}
      onSendSelected={onSendSelected}
      onCompareSelected={onCompareSelected}
      onCopySelected={onCopySelected}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: '发送至提炼' }));
  await userEvent.click(screen.getByRole('button', { name: '对比分析' }));
  await userEvent.click(screen.getByRole('button', { name: '复制引用' }));
  await userEvent.click(screen.getByRole('button', { name: '全选' }));
  await userEvent.click(screen.getByRole('button', { name: '清空' }));

  expect(onSendSelected).toHaveBeenCalledTimes(1);
  expect(onCompareSelected).toHaveBeenCalledTimes(1);
  expect(onCopySelected).toHaveBeenCalledTimes(1);
  expect(onSelectAll).toHaveBeenCalledTimes(1);
  expect(onClearSelection).toHaveBeenCalledTimes(1);
});
