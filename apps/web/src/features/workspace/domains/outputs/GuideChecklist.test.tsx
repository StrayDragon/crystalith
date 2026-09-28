import { expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import GuideChecklist, { type GuideModule } from './GuideChecklist';

// covers: r300
// guide 输出 MUST 支持可勾选学习路径与进度提示（勾选后更新进度且保持交互可用）。

const MODULES: GuideModule[] = [
  { title: '模块一', objective: { text: '理解基础' }, keyPoints: [{ text: '要点 a' }] },
  { title: '模块二', objective: { text: '深入实践' }, keyPoints: [{ text: '要点 b' }] },
];

test('checklist starts unchecked with 0/2 progress and toggling updates the progress cue', () => {
  render(<GuideChecklist modules={MODULES} />);

  expect(screen.getByText('学习进度')).toBeTruthy();
  expect(screen.getByText('已完成 0 / 2')).toBeTruthy();
  expect(screen.getByText('0%')).toBeTruthy();

  const firstBox = screen.getByRole('checkbox', { name: '模块一 完成状态' });
  expect((firstBox as HTMLInputElement).checked).toBe(false);

  fireEvent.click(firstBox);
  expect((firstBox as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText('已完成 1 / 2')).toBeTruthy();
  expect(screen.getByText('50%')).toBeTruthy();
  expect(screen.getByText('已完成')).toBeTruthy();

  // 交互保持可用：再次点击可取消勾选并回到 0 进度。
  fireEvent.click(firstBox);
  expect((firstBox as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText('已完成 0 / 2')).toBeTruthy();
  expect(screen.getByText('0%')).toBeTruthy();
});

test('checking each module independently drives the aggregate progress', () => {
  render(<GuideChecklist modules={MODULES} />);

  fireEvent.click(screen.getByRole('checkbox', { name: '模块二 完成状态' }));
  expect(screen.getByText('已完成 1 / 2')).toBeTruthy();

  fireEvent.click(screen.getByRole('checkbox', { name: '模块一 完成状态' }));
  expect(screen.getByText('已完成 2 / 2')).toBeTruthy();
  expect(screen.getByText('100%')).toBeTruthy();
});
