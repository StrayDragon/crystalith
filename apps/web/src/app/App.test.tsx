import { afterAll, beforeEach, expect, test, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';

import { TestProviders } from '../test-utils/providers';
import App from './App';

const originalFetch = globalThis.fetch;

function renderWorkspace() {
  return render(
    <TestProviders>
      <SWRConfig value={{ provider: () => new Map() }}>
        <App />
      </SWRConfig>
    </TestProviders>,
  );
}

beforeEach(() => {
  globalThis.fetch = rs
    .fn(() => Promise.reject(new Error('network')))
    .mockName('fetch') as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('renders workspace panels and offline state', async () => {
  renderWorkspace();

  expect(await screen.findByText('来源')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '解锁布局' })).toBeInTheDocument();

  expect(await screen.findByText('未连接到后端服务，请检查服务状态后重试。')).toBeInTheDocument();
  const input = screen.getByLabelText('对话输入');
  expect(input).toBeDisabled();
  expect(input).toHaveAttribute('placeholder', '请先创建笔记本');
  expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();

  expect(screen.getByRole('button', { name: '添加笔记' })).toBeInTheDocument();
});
