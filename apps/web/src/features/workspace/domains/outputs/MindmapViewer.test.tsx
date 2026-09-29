// Mock reason: renders real @xyflow/react in jsdom (no network, no rs.* mocks beyond fns).
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from '../../../../shared/layer';
import { MindmapViewer, type MindmapData } from './MindmapViewer';

// covers: r302
// mindmap 输出支持只读浏览与节点折叠/展开控制：折叠后显示子节点计数，
// 再次点击展开还原；视图不提供任何编辑入口。

const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalRO = window.ResizeObserver;
const originalDOMMatrix = window.DOMMatrixReadOnly;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 220,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 64,
  });
  if (window.DOMMatrixReadOnly === undefined) {
    class FakeDOMMatrix {
      m11 = 1;

      m12 = 0;

      m21 = 0;

      m22 = 1;

      m41 = 0;

      m42 = 0;

      a = 1;

      b = 0;

      c = 0;

      d = 1;

      e = 0;

      f = 0;

      constructor(public readonly init?: string | number[]) {}
    }
    window.DOMMatrixReadOnly = FakeDOMMatrix as unknown as typeof DOMMatrixReadOnly;
  }
  class MeasuringRO {
    observe() {}

    unobserve() {}

    disconnect() {}
  }
  window.ResizeObserver = MeasuringRO as unknown as typeof ResizeObserver;
});

afterAll(() => {
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  }
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  }
  window.ResizeObserver = originalRO;
  window.DOMMatrixReadOnly = originalDOMMatrix;
});

const DATA: MindmapData = {
  root: {
    label: '中心主题',
    children: [
      {
        label: '分支一',
        children: [{ label: '叶子甲' }, { label: '叶子乙' }],
      },
    ],
  },
};

describe('r302 mindmap read-only exploration with collapsible nodes', () => {
  it('renders the hierarchy and collapses a branch to its child count', () => {
    const { container } = render(
      <LayerProvider>
        <MindmapViewer data={DATA} autoCollapseDepth={99} />
      </LayerProvider>,
    );
    expect(screen.getByText('中心主题')).toBeTruthy();
    expect(screen.getByText('分支一')).toBeTruthy();
    expect(screen.getByText('叶子甲')).toBeTruthy();

    // toggle collapse on 分支一 → leaves hide, child count badge appears
    fireEvent.click(screen.getByText('分支一'));
    expect(screen.queryByText('叶子甲')).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();

    // expand again
    fireEvent.click(screen.getByText('分支一'));
    expect(screen.getByText('叶子甲')).toBeTruthy();
    expect(screen.getByText('叶子乙')).toBeTruthy();

    // read-only: no editable inputs anywhere in the viewer
    expect(container.querySelector('input, textarea, [contenteditable]')).toBeNull();
  });
});
