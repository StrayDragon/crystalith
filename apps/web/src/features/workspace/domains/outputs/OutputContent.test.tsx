import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { TestProviders } from '../../../../test-utils/providers';
import type { OutputItem } from '../../shared/types';
import OutputContent from './OutputContent';
import { useExport } from './useExport';

// Mock reason: isolate OutputContent menu/dispatch behavior from export implementation side effects.
rs.mock('./useExport', () => ({
  useExport: rs.fn(),
}));

const useExportMock = rs.mocked(useExport);

function createOutput(type: OutputItem['type'], content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

beforeEach(() => {
  useExportMock.mockReturnValue({
    isExporting: false,
    activeFormat: null,
    getSupportedFormats: (type) => (type === 'QUIZ' ? ['markdown', 'json'] : ['markdown']),
    exportOutput: rs.fn(),
  });
});

test('shows export menu and triggers selected format export', async () => {
  const exportOutput = rs.fn();
  useExportMock.mockReturnValue({
    isExporting: false,
    activeFormat: null,
    getSupportedFormats: () => ['markdown', 'json'],
    exportOutput,
  });

  const output = createOutput('QUIZ', {
    questions: [{ question: '2+2?', options: ['3', '4'], answer: '4' }],
  });

  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  fireEvent.click(screen.getByRole('button', { name: '导出输出' }));

  const markdownItem = await screen.findByRole('menuitem', { name: '导出为 Markdown' });
  const jsonItem = await screen.findByRole('menuitem', { name: '导出为 JSON' });

  expect(markdownItem).toBeInTheDocument();
  expect(jsonItem).toBeInTheDocument();

  fireEvent.click(jsonItem);
  expect(exportOutput).toHaveBeenCalledWith(output, 'json');
});

test('only shows markdown for timeline export', async () => {
  const output = createOutput('TIMELINE', {
    events: [{ date: '2024', event: '上线', description: '产品发布' }],
  });

  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  fireEvent.click(screen.getByRole('button', { name: '导出输出' }));

  expect(await screen.findByRole('menuitem', { name: '导出为 Markdown' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '导出为 JSON' })).not.toBeInTheDocument();
});

test('renders timeline when Eden coerces event dates to Date', () => {
  const output = createOutput('TIMELINE', {
    events: [{ date: new Date(2017, 5, 12), event: 'Paper published', description: 'On arXiv' }],
  });

  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  expect(screen.getByText('2017-06-12')).toBeInTheDocument();
  expect(screen.getByText('Paper published')).toBeInTheDocument();
});

test('falls back to raw JSON renderer when payload shape is invalid', () => {
  const output = createOutput('QUIZ', {
    wrong: true,
  });

  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  expect(screen.getByText(/"wrong": true/)).toBeInTheDocument();
});
