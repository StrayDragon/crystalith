import { describe, expect, it, vi } from 'vitest';

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
    const pruneAlongEdge = vi.fn();
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
        forkAlongEdge: vi.fn(),
        editNode: vi.fn(),
        setTopicDraft: vi.fn(),
        finishReport: vi.fn(),
        continueDig: vi.fn(),
        addBudget: vi.fn(),
        setConfirmChoice: vi.fn(),
      },
      openReport: vi.fn(),
    });
    expect(ok).toBe(true);
    expect(pruneAlongEdge).toHaveBeenCalledWith('e1');
  });

  it('accept rewrite_query calls editNode with query (PATCH seam)', () => {
    const editNode = vi.fn();
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
        pruneAlongEdge: vi.fn(),
        forkAlongEdge: vi.fn(),
        editNode,
        setTopicDraft: vi.fn(),
        finishReport: vi.fn(),
        continueDig: vi.fn(),
        addBudget: vi.fn(),
        setConfirmChoice: vi.fn(),
      },
      openReport: vi.fn(),
    });
    expect(ok).toBe(true);
    expect(editNode).toHaveBeenCalledWith('branch_a', { query: '新查询' });
  });

  it('eden set_status patches conclusionStatus only (no fake enrich)', () => {
    const editNode = vi.fn();
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
        pruneAlongEdge: vi.fn(),
        forkAlongEdge: vi.fn(),
        editNode,
        setTopicDraft: vi.fn(),
        finishReport: vi.fn(),
        continueDig: vi.fn(),
        addBudget: vi.fn(),
        setConfirmChoice: vi.fn(),
      },
      openReport: vi.fn(),
    });
    expect(editNode).toHaveBeenCalledWith('branch_a', { conclusionStatus: 'clear' });
  });

  it('open_report navigates via openReport', () => {
    const openReport = vi.fn();
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
        pruneAlongEdge: vi.fn(),
        forkAlongEdge: vi.fn(),
        editNode: vi.fn(),
        setTopicDraft: vi.fn(),
        finishReport: vi.fn(),
        continueDig: vi.fn(),
        addBudget: vi.fn(),
        setConfirmChoice: vi.fn(),
      },
      openReport,
    });
    expect(ok).toBe(true);
    expect(openReport).toHaveBeenCalled();
  });

  it('confirm_continue while running calls addBudget (c108)', () => {
    const addBudget = vi.fn();
    const continueDig = vi.fn();
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
        pruneAlongEdge: vi.fn(),
        forkAlongEdge: vi.fn(),
        editNode: vi.fn(),
        setTopicDraft: vi.fn(),
        finishReport: vi.fn(),
        continueDig,
        addBudget,
        setConfirmChoice: vi.fn(),
        runStatus: 'running',
      },
      openReport: vi.fn(),
    });
    expect(ok).toBe(true);
    expect(addBudget).toHaveBeenCalled();
    expect(continueDig).not.toHaveBeenCalled();
  });
});
