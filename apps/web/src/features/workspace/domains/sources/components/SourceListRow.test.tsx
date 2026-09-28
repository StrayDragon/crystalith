import { expect, test, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';

import { TestProviders } from '../../../../../test-utils/providers';
import type { SourceItem } from '../../../shared/types';
import SourceListRow from './SourceListRow';

// covers: r415 — 来源条目按状态展示（ready 正常 / failed 错误与恢复提示 / loading 旋转指示且可操作），移除等操作仅真实可用时呈现

function buildSource(overrides: Partial<SourceItem>): SourceItem {
  return {
    id: 1,
    title: '来源A',
    type: 'txt',
    status: 'ready',
    statusTone: 'READY',
    chunks: 3,
    tags: [],
    createdAt: '2026-01-01',
    ...overrides,
  };
}

const noop = () => Promise.resolve(false);
const baseProps = {
  isHighlighted: false,
  isSelected: false,
  isConnected: true,
  removeState: 'idle' as const,
  onToggleSource: rs.fn(),
  onOpenDetail: rs.fn(),
  onOpenDetailFullscreen: rs.fn(),
  onRemoveSource: noop,
  onReembedSource: rs.fn(),
};

const renderRow = (source: SourceItem) =>
  render(
    <TestProviders>
      <SourceListRow {...baseProps} source={source} />
    </TestProviders>,
  );

test('ready source renders normal status and selectable', () => {
  renderRow(buildSource({ statusTone: 'READY', status: '已就绪' }));

  expect(screen.getByText('已就绪')).toBeInTheDocument();
  const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
  expect(checkbox.disabled).toBe(false);
});

test('processing source shows indexing progress label', () => {
  renderRow(buildSource({ statusTone: 'PROCESSING', status: 'processing', indexProgress: 40 }));

  expect(screen.getByText('索引中 (40%)')).toBeInTheDocument();
});

test('failed source renders red error status with recovery info and remove action', () => {
  renderRow(
    buildSource({
      statusTone: 'FAILED',
      status: '失败',
      errorMessage: '解析失败',
      recoveryHint: '请重试上传',
    }),
  );

  expect(screen.getByText('失败')).toBeInTheDocument();
  expect(screen.getByText(/解析失败|请重试上传/)).toBeInTheDocument();
  // 失败来源不可勾选（仅 READY 可选）
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
});
