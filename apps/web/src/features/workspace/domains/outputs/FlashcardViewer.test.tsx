import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import FlashcardViewer, { type FlashcardItem } from './FlashcardViewer';

// covers: r301
// flashcard 输出 MUST 支持翻面交互与上一张/下一张的学习进度导航。

const ITEMS: FlashcardItem[] = [
  { question: '什么是 RAG？', answer: '检索增强生成' },
  { question: '什么是引用映射？', answer: '把 [1] 映射为 Citation 对象' },
];

/** ProgressIndicator renders `{current}/{total}` as adjacent text nodes —
 * assert on the containing span's textContent instead. */
function progressText(): string {
  const span = screen
    .getAllByText<HTMLElement>('/', { exact: false, selector: 'span' })
    .find((el) => el.className.includes('tabular-nums'));
  return span?.textContent ?? '';
}

function cardButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /查看(问题|答案)/u }) as HTMLButtonElement;
}

test('space/flip toggles between question and answer faces', () => {
  render(<FlashcardViewer items={ITEMS} />);

  // 初始为问题面：aria-pressed=false，label 提示可查看答案
  expect(cardButton().getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: '查看答案' })).toBeTruthy();

  // 按钮翻面 → 答案面，label 提示可回到问题
  fireEvent.click(cardButton());
  expect(cardButton().getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: '查看问题' })).toBeTruthy();

  // 空格键翻回问题面（keydown 目标为卡片内的 HTMLElement）
  fireEvent.keyDown(cardButton(), { key: ' ' });
  expect(cardButton().getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: '查看答案' })).toBeTruthy();
});

test('prev/next navigation moves the progress indicator and clamps at bounds', () => {
  render(<FlashcardViewer items={ITEMS} />);

  expect(screen.getByText('学习进度')).toBeTruthy();
  expect(progressText()).toBe('1/2');
  expect(screen.getByText('什么是 RAG？')).toBeTruthy();

  const prev = screen.getByRole('button', { name: '上一张' });
  const next = screen.getByRole('button', { name: '下一张' });
  expect((prev as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(next);
  expect(progressText()).toBe('2/2');
  expect(screen.getByText('什么是引用映射？')).toBeTruthy();
  expect((next as HTMLButtonElement).disabled).toBe(true);

  // 翻面状态在导航后重置
  expect(cardButton().getAttribute('aria-pressed')).toBe('false');

  fireEvent.click(prev);
  expect(progressText()).toBe('1/2');
  expect((prev as HTMLButtonElement).disabled).toBe(true);
});

test('arrow keys navigate cards', () => {
  render(<FlashcardViewer items={ITEMS} />);

  // 键盘事件 target 必须是 HTMLElement（真实场景为焦点元素/body）
  fireEvent.keyDown(cardButton(), { key: 'ArrowRight' });
  expect(progressText()).toBe('2/2');

  fireEvent.keyDown(cardButton(), { key: 'ArrowLeft' });
  expect(progressText()).toBe('1/2');
});
