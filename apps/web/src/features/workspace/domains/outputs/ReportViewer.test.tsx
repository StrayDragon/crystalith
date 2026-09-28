import { afterEach, expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import ReportViewer, { type ReportSection } from './ReportViewer';

// covers: r299
// briefing 输出 MUST 支持章节目录导航与章节折叠/展开。

const SECTIONS: ReportSection[] = [
  { heading: '背景', points: [{ text: '背景要点一' }, { text: '背景要点二' }] },
  { heading: '方法', points: [{ text: '方法要点一' }] },
];

afterEach(() => {
  // jsdom does not implement scrollIntoView.
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

test('renders a section toc; clicking a toc entry scrolls to the section', () => {
  const calls: Array<{ block?: string; behavior?: string }> = [];
  (HTMLElement.prototype as unknown as Record<string, unknown>).scrollIntoView = (opts?: {
    block?: string;
    behavior?: string;
  }) => {
    calls.push(opts ?? {});
  };

  render(<ReportViewer sections={SECTIONS} />);

  expect(screen.getByText('目录')).toBeTruthy();
  // TOC button carries the bare heading as its accessible name (exact match),
  // while the collapsible header button name is prefixed by the −/+ glyph.
  fireEvent.click(screen.getByRole('button', { name: '方法' }));
  expect(calls).toEqual([{ behavior: 'smooth', block: 'start' }]);
});

test('sections collapse and expand; first section open by default', () => {
  render(<ReportViewer sections={SECTIONS} />);

  // First section defaultOpen → its points are visible.
  expect(screen.getByText('背景要点一')).toBeTruthy();
  // Second section defaultOpen=false → content hidden until expanded.
  expect(screen.queryByText('方法要点一')).toBeNull();

  const header = screen
    .getAllByRole('button', { name: /方法/u })
    .find((button) => button.getAttribute('aria-expanded') !== null);
  expect(header).toBeTruthy();

  fireEvent.click(header!);
  expect(screen.getByText('方法要点一')).toBeTruthy();

  fireEvent.click(header!);
  expect(screen.queryByText('方法要点一')).toBeNull();
});
