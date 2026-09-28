import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';

import type { OutputQueueJob } from '../../shared/hooks/useOutputQueue';
import type { OutputTypeId } from '../../shared/types';
import StudioOutputsList from './StudioOutputsList';

// Mock reason: react-virtuoso depends on layout/observer behaviors that are unstable in jsdom.
rs.mock('react-virtuoso', () => ({
  Virtuoso: forwardRef(function VirtuosoMock(
    { data, itemContent }: { data: any[]; itemContent: (index: number, item: any) => any },
    _ref: unknown,
  ) {
    return (
      <div>
        {data.map((item: any, index: number) => (
          <div key={item.key}>{itemContent(index, item)}</div>
        ))}
      </div>
    );
  }),
}));

// Mock reason: isolate queue row rendering from export hook side effects.
rs.mock('../../domains/outputs/useExport', () => ({
  useExport: () => ({
    isExporting: false,
    activeFormat: null,
    getSupportedFormats: () => ['markdown'],
    exportOutput: rs.fn(),
  }),
}));

function buildJob(overrides: Partial<OutputQueueJob> = {}): OutputQueueJob {
  return {
    id: 'job-1',
    type: 'FAQ',
    prompt: '常见问题',
    sourceIds: [1, 2],
    status: 'queued',
    createdAt: '2026-03-01T00:00:00Z',
    createdAtLabel: '2026-03-01 08:00',
    notebookId: 1,
    ...overrides,
  };
}

const typeLabelMap = new Map<OutputTypeId, string>([['FAQ', 'FAQ']]);

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    outputs: [],
    outputQueueJobs: [],
    outputsLoading: false,
    outputsError: '',
    onRetryOutputs: rs.fn(),
    onRetryOutputJob: rs.fn(),
    onCancelOutputJob: rs.fn(),
    onDeleteOutput: rs.fn(),
    onSelectOutput: rs.fn(),
    onOpenSlides: rs.fn(),
    typeLabelMap,
    ...overrides,
  };
}

beforeEach(() => {
  rs.clearAllMocks();
});

// covers: r409
test('studio queue shows in-flight job status and supports cancel', () => {
  const onCancelOutputJob = rs.fn();

  render(
    <StudioOutputsList
      {...baseProps({
        outputQueueJobs: [buildJob({ status: 'running' })],
        onCancelOutputJob,
      })}
    />,
  );

  expect(screen.getByText('生成FAQ...')).toBeInTheDocument();
  expect(screen.getByText(/生成中/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(onCancelOutputJob).toHaveBeenCalledWith('job-1');
});

// covers: r409
test('studio queue exposes retry entry for failed jobs and shows cancelled state', () => {
  const onRetryOutputJob = rs.fn();
  const failedJob = buildJob({ id: 'job-err', status: 'error' });
  const cancelledJob = buildJob({ id: 'job-cancel', status: 'cancelled' });

  render(
    <StudioOutputsList
      {...baseProps({
        outputQueueJobs: [failedJob, cancelledJob],
        onRetryOutputJob,
      })}
    />,
  );

  expect(screen.getByText('FAQ 生成失败')).toBeInTheDocument();
  expect(screen.getByText('FAQ 已取消')).toBeInTheDocument();
  expect(screen.getByText('基于 2 个来源 · 已取消')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(onRetryOutputJob).toHaveBeenCalledWith('job-err');

  // 已取消项不再提供取消入口
  expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
});
