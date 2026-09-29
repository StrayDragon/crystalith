import { describe, expect, it } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from '../../shared/layer';
import LabNodeDrawer from './LabNodeDrawer';
import type { LabNode } from './model/types';

// covers: r102
// Run 详情层（LabNodeDrawer）以 overlay 叠加层渲染（高于图区），宿主区保持
// 挂载不被替换；点击关闭仅收起详情；同一时刻最多一个详情（由单值
// selectedNodeId 派生，切换卡片替换当前详情）。

const NODE: LabNode = {
  id: 'node_research_1',
  title: '研究节点甲',
  role: 'research',
  conclusionStatus: 'clear',
  citationIds: [],
};

function renderDrawer(overlay = true) {
  const calls = { close: 0 };
  render(
    <LayerProvider>
      <div data-testid="lab-desk">工作区保持挂载</div>
      <LabNodeDrawer
        node={NODE}
        phase="explore"
        citations={{}}
        overlay={overlay}
        onClose={() => {
          calls.close += 1;
        }}
      />
    </LayerProvider>,
  );
  return calls;
}

describe('r102 run detail layer keeps the desk mounted', () => {
  it('renders as an overlay detail while the desk stays mounted; close only hides the detail', () => {
    const calls = renderDrawer(true);
    expect(screen.getByTestId('lab-desk')).toBeTruthy();
    expect(screen.getByTestId('research-lab-node-drawer')).toBeTruthy();
    expect(screen.getByText('研究节点甲')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(calls.close).toBe(1);
    // the desk was never unmounted by opening/closing the detail
    expect(screen.getByTestId('lab-desk')).toBeTruthy();
  });

  it('inline (non-overlay) mode keeps the same single-instance close semantics', () => {
    const calls = renderDrawer(false);
    expect(screen.getByTestId('research-lab-node-drawer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(calls.close).toBe(1);
  });
});
