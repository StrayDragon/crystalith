import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import App from './App';

const originalFetch = globalThis.fetch;

function mockJson(data: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

beforeEach(() => {
  globalThis.fetch = vi
    .fn(() => Promise.reject(new Error('network')))
    .mockName('fetch') as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('renders three-column workspace panels', async () => {
  render(<App />);
  await screen.findByText('演示模式');
  expect(screen.getByRole('heading', { name: '来源与引用' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '聊天' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '输出中心' })).toBeInTheDocument();
});

test('sending a message updates chat and refine output', async () => {
  render(<App />);

  const input = await screen.findByPlaceholderText(/在这里输入问题或指令/);
  await userEvent.type(input, '你好，帮我总结一下。');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));

  expect(screen.getByText('你好，帮我总结一下。')).toBeInTheDocument();
  expect(screen.getByText(/（演示）已收到：你好/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '立即提炼' }));
  expect(await screen.findByText(/已生成提炼结果（演示）/)).toBeInTheDocument();
});

test('maps lowercase source status to label and badge styles', async () => {
  const now = new Date().toISOString();
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/v1/notebooks') {
      return mockJson([{ id: 1, name: 'Notes', updated_at: now }]);
    }
    if (url === '/v1/notebooks/1/sources') {
      return mockJson([
        {
          id: 10,
          notebook_id: 1,
          filename: 'note.md',
          mime_type: 'text/markdown',
          status: 'ready',
          chunk_count: 2,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;

  render(<App />);
  expect(await screen.findByText('已连接')).toBeInTheDocument();
  expect(await screen.findByText(/已索引/)).toBeInTheDocument();
  const badge = screen.getByText('2 段');
  expect(badge).toHaveClass('WorkspaceBadge', 'READY');
});

test('clears citations when QA returns empty results', async () => {
  const now = new Date().toISOString();
  let qaCallCount = 0;
  const emptyNotice =
    '暂无引用。发送一次消息后这里会展示引用片段（可勾选作为提炼输入）。';

  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/v1/notebooks') {
      return mockJson([{ id: 1, name: 'Notes', updated_at: now }]);
    }
    if (url === '/v1/notebooks/1/sources') {
      return mockJson([]);
    }
    if (url === '/v1/notebooks/1/qa') {
      qaCallCount += 1;
      if (qaCallCount === 1) {
        return mockJson({
          answer: 'first',
          citations: [
            {
              source_id: 1,
              source_name: 'source.md',
              chunk_id: 42,
              chunk_index: 0,
              snippet: 'citation-1',
              score: 0.9,
            },
          ],
          evidence: true,
          created_at: now,
        });
      }
      return mockJson({
        answer: 'second',
        citations: [],
        evidence: false,
        created_at: now,
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;

  render(<App />);

  const input = await screen.findByPlaceholderText(/在这里输入问题或指令/);
  await userEvent.type(input, '问题一');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));

  expect(await screen.findByText('citation-1')).toBeInTheDocument();
  expect(screen.queryByText(emptyNotice)).not.toBeInTheDocument();

  await userEvent.type(input, '问题二');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));

  expect(await screen.findByText(emptyNotice)).toBeInTheDocument();
  expect(screen.queryByText('citation-1')).not.toBeInTheDocument();
});
