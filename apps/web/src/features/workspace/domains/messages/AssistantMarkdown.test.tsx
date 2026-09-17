import { expect, test } from '@rstest/core';
import { act, render, screen } from '@testing-library/react';

import AssistantMarkdown from './AssistantMarkdown';

/** Flush async resolution of the code-block highlighter resource inside act()
 *  (streamdown 的 shiki 插件在代码块挂载时 suspend, 异步加载完成后若不在 act 内
 *  落地会触发 React act() 警告). */
async function flushAsyncResource() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('renders complete markdown structures (heading/list/code/table/quote)', async () => {
  const content = [
    '# 标题',
    '',
    '- 列表项 A',
    '- 列表项 B',
    '',
    '> 引用块',
    '',
    '| 列1 | 列2 |',
    '| --- | --- |',
    '| a | b |',
    '',
    '```ts',
    'const x = 1;',
    '```',
    '',
    '正文 **加粗** 结尾',
  ].join('\n');

  const { container } = render(<AssistantMarkdown content={content} />);

  expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeInTheDocument();
  expect(screen.getByRole('list')).toBeInTheDocument();
  expect(screen.getByText('列表项 A')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  // 代码块不再保留原始围栏字符
  expect(screen.queryByText('```ts')).not.toBeInTheDocument();
  // streamdown 将加粗渲染为 data-streamdown="strong" 的语义 span
  expect(container.querySelector('[data-streamdown="strong"]')?.textContent).toBe('加粗');
  await flushAsyncResource();
});

test('incomplete fence mid-stream does not throw or leak raw fences', async () => {
  const midStream = ['回答开头', '', '```ts', 'const x = 1;'].join('\n');

  expect(() => render(<AssistantMarkdown content={midStream} streaming />)).not.toThrow();
  expect(screen.getByText('回答开头')).toBeInTheDocument();
  expect(screen.queryByText('```ts')).not.toBeInTheDocument();
  await flushAsyncResource();
});

test('hides leaked tool_call xml in assistant markdown', () => {
  render(
    <AssistantMarkdown content="答案开头\n\n<tool_call> <function=retrieveSources> <parameter=query> q </tool_call>\n\n结论。" />,
  );
  expect(screen.getByText(/答案开头/)).toBeInTheDocument();
  expect(screen.getByText(/结论/)).toBeInTheDocument();
  expect(screen.queryByText(/retrieveSources/)).not.toBeInTheDocument();
  expect(screen.queryByText(/tool_call/)).not.toBeInTheDocument();
});

test('plain text input stays paragraph text (no fence artifacts)', () => {
  render(<AssistantMarkdown content="第一段。\n\n第二段：结论如下。" />);

  expect(screen.getByText(/第一段/)).toBeInTheDocument();
  expect(screen.getByText(/第二段：结论如下/)).toBeInTheDocument();
});
