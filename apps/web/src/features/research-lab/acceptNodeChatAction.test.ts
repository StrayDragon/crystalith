// covers: r116/r134（deep-research-ui）——接受节点对话提案映射到对应命令口或纯前端导航。
import { describe, expect, it, rs } from '@rstest/core';

import { acceptNodeChatAction } from './acceptNodeChatAction';
import type { LabNodeActionProposal } from './model/nodeChatTypes';
import type { LabEdge, LabNode } from './model/types';

function node(partial: Partial<LabNode> & Pick<LabNode, 'id' | 'title'>): LabNode {
  return {
    role: 'research',
    conclusionStatus: 'pending',
    phase: 'idle',
    citationIds: [],
    ...partial,
  };
}

describe('acceptNodeChatAction (r439)', () => {
  const edges: LabEdge[] = [{ id: 'e1', source: 'root', target: 'branch_a', kind: 'expand' }];
  const nodes: LabNode[] = [
    node({ id: 'root', title: '根', role: 'question' }),
    node({ id: 'branch_a', title: '支路A' }),
  ];

  it('accept prune calls pruneAlongEdge (Eden command port seam)', () => {
    const pruneAlongEdge = rs.fn();
    const proposal: LabNodeActionProposal = {
      id: 'p1',
      kind: 'prune_node',
      label: '剪枝',
      rationale: 'r',
      status: 'pending',
    };
    const ok = acceptNodeChatAction({
      proposal,
      node: nodes[1]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge,
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(true);
    expect(pruneAlongEdge).toHaveBeenCalledWith('e1');
  });

  it('terminal run rejects prune without hitting the command port (r105)', () => {
    const pruneAlongEdge = rs.fn();
    const proposal: LabNodeActionProposal = {
      id: 'p-term',
      kind: 'prune_node',
      label: '剪枝',
      rationale: 'r',
      status: 'pending',
    };
    const ok = acceptNodeChatAction({
      proposal,
      node: nodes[1]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge,
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
        runStatus: 'completed',
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(false);
    expect(pruneAlongEdge).not.toHaveBeenCalled();
  });

  it('accept rewrite_query calls editNode with query (PATCH seam)', () => {
    const editNode = rs.fn();
    const proposal: LabNodeActionProposal = {
      id: 'p2',
      kind: 'rewrite_query',
      label: '改查询',
      rationale: 'r',
      status: 'pending',
      params: { query: '新查询' },
    };
    const ok = acceptNodeChatAction({
      proposal,
      node: nodes[1]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode,
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(true);
    expect(editNode).toHaveBeenCalledWith('branch_a', { query: '新查询' });
  });

  it('eden set_status patches conclusionStatus only (no fake enrich)', () => {
    const editNode = rs.fn();
    const proposal: LabNodeActionProposal = {
      id: 'p3',
      kind: 'set_status',
      label: '定为明确',
      rationale: 'r',
      status: 'pending',
      params: { conclusionStatus: 'clear' },
    };
    acceptNodeChatAction({
      proposal,
      node: nodes[1]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode,
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
      },
      openReport: rs.fn(),
    });
    expect(editNode).toHaveBeenCalledWith('branch_a', { conclusionStatus: 'clear' });
  });

  it('open_report navigates via openReport', () => {
    const openReport = rs.fn();
    const proposal: LabNodeActionProposal = {
      id: 'p4',
      kind: 'open_report',
      label: '打开报告',
      rationale: 'r',
      status: 'pending',
    };
    const ok = acceptNodeChatAction({
      proposal,
      node: node({ id: 'c', title: '结论', role: 'conclusion' }),
      edges: [],
      nodes: [],
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
      },
      openReport,
    });
    expect(ok).toBe(true);
    expect(openReport).toHaveBeenCalled();
  });

  it('confirm_continue while running calls addBudget (c108)', () => {
    const addBudget = rs.fn();
    const continueDig = rs.fn();
    const ok = acceptNodeChatAction({
      proposal: {
        id: 'p5',
        kind: 'confirm_continue',
        label: '加购',
        rationale: 'r',
        status: 'pending',
      },
      node: nodes[0]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport: rs.fn(),
        continueDig,
        addBudget,
        setConfirmChoice: rs.fn(),
        runStatus: 'running',
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(true);
    expect(addBudget).toHaveBeenCalled();
    expect(continueDig).not.toHaveBeenCalled();
  });

  // r105 终态只读矩阵：三终态 × 四结构/意图提案全部闸掉，不得触达命令口。
  it.each([
    ['failed', 'prune_node'],
    ['failed', 'fork_sibling'],
    ['failed', 'rewrite_query'],
    ['failed', 'set_status'],
    ['cancelled', 'prune_node'],
    ['cancelled', 'fork_sibling'],
    ['cancelled', 'rewrite_query'],
    ['cancelled', 'set_status'],
    ['completed', 'fork_sibling'],
    ['completed', 'rewrite_query'],
    ['completed', 'set_status'],
  ] as const)('terminal %s rejects %s without hitting ports', (runStatus, kind) => {
    const ports = {
      pruneAlongEdge: rs.fn(),
      forkAlongEdge: rs.fn(),
      editNode: rs.fn(),
      setTopicDraft: rs.fn(),
    };
    const ok = acceptNodeChatAction({
      proposal: {
        id: `p-${kind}`,
        kind,
        label: kind,
        rationale: 'r',
        status: 'pending',
        params: kind === 'rewrite_query' ? { query: '新查询' } : undefined,
      },
      node: nodes[1]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        ...ports,
        finishReport: rs.fn(),
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
        runStatus,
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(false);
    expect(ports.pruneAlongEdge).not.toHaveBeenCalled();
    expect(ports.forkAlongEdge).not.toHaveBeenCalled();
    expect(ports.editNode).not.toHaveBeenCalled();
    expect(ports.setTopicDraft).not.toHaveBeenCalled();
  });

  // r105：confirm 类提案在终态同样闸掉（服务端必然 RESEARCH_INVALID_STATE）。
  it.each([
    ['completed', 'confirm_finish'],
    ['failed', 'confirm_finish'],
    ['cancelled', 'confirm_finish'],
    ['completed', 'confirm_continue'],
    ['failed', 'confirm_continue'],
    ['cancelled', 'confirm_continue'],
  ] as const)('terminal %s rejects %s before finishReport/continueDig', (runStatus, kind) => {
    const finishReport = rs.fn();
    const continueDig = rs.fn();
    const addBudget = rs.fn();
    const ok = acceptNodeChatAction({
      proposal: { id: `p-${kind}`, kind, label: kind, rationale: 'r', status: 'pending' },
      node: nodes[0]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport,
        continueDig,
        addBudget,
        setConfirmChoice: rs.fn(),
        runStatus,
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(false);
    expect(finishReport).not.toHaveBeenCalled();
    expect(continueDig).not.toHaveBeenCalled();
    expect(addBudget).not.toHaveBeenCalled();
  });

  // awaiting_confirm 非终态：confirm_finish 仍然可用（收束确认路径）。
  it('awaiting_confirm still allows confirm_finish (not a terminal status)', () => {
    const finishReport = rs.fn();
    const ok = acceptNodeChatAction({
      proposal: {
        id: 'p-finish',
        kind: 'confirm_finish',
        label: '收束',
        rationale: 'r',
        status: 'pending',
      },
      node: nodes[0]!,
      edges,
      nodes,
      mode: 'eden',
      lab: {
        pruneAlongEdge: rs.fn(),
        forkAlongEdge: rs.fn(),
        editNode: rs.fn(),
        setTopicDraft: rs.fn(),
        finishReport,
        continueDig: rs.fn(),
        addBudget: rs.fn(),
        setConfirmChoice: rs.fn(),
        runStatus: 'awaiting_confirm',
      },
      openReport: rs.fn(),
    });
    expect(ok).toBe(true);
    expect(finishReport).toHaveBeenCalled();
  });
});
