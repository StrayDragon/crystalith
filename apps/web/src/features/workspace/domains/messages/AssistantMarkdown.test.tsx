import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import AssistantMarkdown from './AssistantMarkdown';

test('renders complete markdown structures (heading/list/code/table/quote)', () => {
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
});

test('incomplete fence mid-stream does not throw or leak raw fences', () => {
  const midStream = ['回答开头', '', '```ts', 'const x = 1;'].join('\n');

  expect(() => render(<AssistantMarkdown content={midStream} streaming />)).not.toThrow();
  expect(screen.getByText('回答开头')).toBeInTheDocument();
  expect(screen.queryByText('```ts')).not.toBeInTheDocument();
});

test('plain text input stays paragraph text (no fence artifacts)', () => {
  render(<AssistantMarkdown content="第一段。\n\n第二段：结论如下。" />);

  expect(screen.getByText(/第一段/)).toBeInTheDocument();
  expect(screen.getByText(/第二段：结论如下/)).toBeInTheDocument();
});
