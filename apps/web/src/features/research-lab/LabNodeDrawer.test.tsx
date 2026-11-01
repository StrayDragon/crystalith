// covers: r102（deep-research-ui）——Run 详情以 overlay 叠加层渲染且 Desk 保持挂载，关闭仅收起。
import { describe, expect, it } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from '../../shared/layer';
import LabNodeDrawer from './LabNodeDrawer';
import type { LabNode } from './model/types';

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

function renderDrawer() {
  const calls = { close: 0 };
  render(
    <LayerProvider>
      <div data-testid="lab-desk">工作区保持挂载</div>
      <LabNodeDrawer
        node={NODE}
        phase="explore"
        citations={{}}
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
    const calls = renderDrawer();
    expect(screen.getByTestId('lab-desk')).toBeTruthy();
    expect(screen.getByTestId('research-lab-node-drawer')).toBeTruthy();
    expect(screen.getByText('研究节点甲')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(calls.close).toBe(1);
    // the desk was never unmounted by opening/closing the detail
    expect(screen.getByTestId('lab-desk')).toBeTruthy();
  });
});

// r105：completed/failed/cancelled 时 inspector MUST 只读——meta 页编辑入口收口
// （快速改查询隐藏、askOnInterrupt 开关禁用）；执行侧闸在 acceptNodeChatAction，
// 图交互闸在 GRAPH_READ_ONLY_STATUSES。
describe('r105 terminal run renders a read-only inspector', () => {
  const pendingResearch: LabNode = {
    ...NODE,
    id: 'node_research_pending',
    title: '研究节点乙',
    conclusionStatus: 'pending',
  };
  const pendingQuestion: LabNode = {
    ...pendingResearch,
    id: 'node_question_pending',
    title: '提问节点',
    role: 'question',
  };

  function renderAt(phase: 'explore' | 'completed' | 'failed', n: LabNode) {
    const view = render(
      <LayerProvider>
        <LabNodeDrawer node={n} phase={phase} citations={{}} onClose={() => {}} onEdit={() => {}} />
      </LayerProvider>,
    );
    return view.unmount;
  }

  it('hides the quick edit-query entry in terminal phases, shows it while exploring', () => {
    let unmount = renderAt('explore', pendingResearch);
    expect(screen.getByRole('button', { name: '快速改查询…' })).toBeTruthy();
    unmount();

    unmount = renderAt('completed', pendingResearch);
    expect(screen.queryByRole('button', { name: '快速改查询…' })).toBeNull();
    unmount();

    unmount = renderAt('failed', pendingResearch);
    expect(screen.queryByRole('button', { name: '快速改查询…' })).toBeNull();
    unmount();
  });

  it('disables the askOnInterrupt switch in terminal phases', () => {
    renderAt('completed', pendingQuestion);
    const switchEl = screen.getByRole('switch');
    expect((switchEl as HTMLButtonElement).disabled).toBe(true);
  });
});
