import { expect, test } from '@rstest/core';

import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from './widgetRegistry';

// covers: r398
test('default canvas assembles the stable Sources/Chat/Studio panel set', () => {
  // 面板集合稳定：三个核心模块固定存在
  expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual(['chat', 'sources', 'studio']);

  // 每个面板有可发现的基本区域划分（label + 网格区域）
  for (const widgetId of ['sources', 'chat', 'studio'] as const) {
    const meta = WIDGET_REGISTRY[widgetId];
    expect(meta.label.length).toBeGreaterThan(0);
    expect(meta.defaultW).toBeGreaterThan(0);
    expect(meta.defaultH).toBeGreaterThan(0);
  }

  // 默认布局为三个面板各分配互不重叠的水平区域
  const layoutIds = DEFAULT_LAYOUT.map((widget) => widget.id).sort();
  expect(layoutIds).toEqual(['chat', 'sources', 'studio']);

  const columns = new Set<number>();
  for (const widget of DEFAULT_LAYOUT) {
    for (let x = widget.x; x < widget.x + widget.w; x += 1) {
      expect(columns.has(x)).toBe(false);
      columns.add(x);
    }
  }
});
