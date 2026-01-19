import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

async function actUser(action: () => Promise<unknown> | unknown) {
  await act(async () => {
    await action();
  });
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

test('sending a message updates chat', async () => {
  renderWorkspace();
  const input = await screen.findByPlaceholderText(/开始输入/);
  await actUser(() => userEvent.type(input, '你好，帮我总结一下。'));
  await actUser(() => userEvent.click(screen.getByRole('button', { name: '发送' })));

  expect(await screen.findByText('你好，帮我总结一下。')).toBeInTheDocument();
  expect(await screen.findByText(/（演示）已收到：你好/)).toBeInTheDocument();
});

test('renders studio tools and add-note action', async () => {
  renderWorkspace();
  expect(await screen.findByRole('button', { name: '思维导图' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '添加笔记' })).toBeInTheDocument();
});
