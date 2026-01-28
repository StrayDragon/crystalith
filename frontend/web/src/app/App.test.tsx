import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { SWRConfig } from 'swr';
import App from './App';

const originalFetch = globalThis.fetch;

function renderWorkspace() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <App />
    </SWRConfig>,
  );
}

beforeEach(() => {
  globalThis.fetch = vi
    .fn(() => Promise.reject(new Error('network')))
    .mockName('fetch') as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('renders NotebookLM-style panels', async () => {
  renderWorkspace();
  expect(await screen.findByText('来源')).toBeInTheDocument();
  expect(screen.getByText('对话')).toBeInTheDocument();
  expect(screen.getByText('Studio')).toBeInTheDocument();
});

test('chat is disabled when backend is unavailable', async () => {
  renderWorkspace();
  expect(
    await screen.findByText('未连接到后端服务，请检查服务状态后重试。'),
  ).toBeInTheDocument();
  const input = screen.getByLabelText('对话输入');
  expect(input).toBeDisabled();
  expect(input).toHaveAttribute('placeholder', '请先创建笔记本');
  expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
});

test('renders studio connection error and add-note action', async () => {
  renderWorkspace();
  expect(await screen.findByText('未连接到后端服务。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '添加笔记' })).toBeInTheDocument();
});
