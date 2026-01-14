import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.reject(new Error('network')));
});

afterAll(() => {
  global.fetch = originalFetch;
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
