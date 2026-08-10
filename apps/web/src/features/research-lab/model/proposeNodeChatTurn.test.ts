import { describe, expect, it } from 'vitest';

import { deriveLabState } from '../../research-lab-demo/fake/deriveLabState';
import { getLabScenario } from '../../research-lab-demo/fake/scenarios';
import { findInboundEdgeForNode, proposeNodeChatTurn } from './proposeNodeChatTurn';

describe('proposeNodeChatTurn', () => {
  it('research reject → prune + fork proposals (pending)', () => {
    const turn = proposeNodeChatTurn({
      nodeId: 'n-libs',
      role: 'research',
      title: '候选库',
      query: 'openpyxl',
      userText: '这条没用，否定掉',
      phase: 'explore',
    });
    expect(turn.proposals.map((p) => p.kind).sort()).toEqual(['fork_sibling', 'prune_node']);
    expect(turn.proposals.every((p) => p.status === 'pending')).toBe(true);
    expect(turn.assistantText).toMatch(/否定|确认/);
  });

  it('does not propose prune on question node', () => {
    const turn = proposeNodeChatTurn({
      nodeId: 'root',
      role: 'question',
      title: '主题',
      userText: '删掉这条',
      phase: 'explore',
    });
    expect(turn.proposals.some((p) => p.kind === 'prune_node')).toBe(false);
  });

  it('awaiting_confirm + 结束 → confirm_finish', () => {
    const turn = proposeNodeChatTurn({
      nodeId: 'conclusion',
      role: 'conclusion',
      title: '结论',
      userText: '结束并出报告吧',
      phase: 'awaiting_confirm',
      reportAvailable: true,
    });
    expect(turn.proposals.some((p) => p.kind === 'confirm_finish')).toBe(true);
  });

  it('rewrite_query carries suggested query param', () => {
    const turn = proposeNodeChatTurn({
      nodeId: 'n-libs',
      role: 'research',
      title: '候选库',
      query: 'openpyxl xlsx',
      userText: '改查询 polars excel',
      phase: 'explore',
    });
    const p = turn.proposals.find((x) => x.kind === 'rewrite_query');
    expect(p?.params?.query).toMatch(/polars/i);
  });

  it('set_status clear from 定为明确', () => {
    const turn = proposeNodeChatTurn({
      nodeId: 'n-libs',
      role: 'research',
      title: '候选库',
      userText: '细节够了，定为明确',
      phase: 'completed',
      conclusionStatus: 'partial',
    });
    const p = turn.proposals.find((x) => x.kind === 'set_status');
    expect(p?.params?.conclusionStatus).toBe('clear');
  });
});

describe('findInboundEdgeForNode', () => {
  it('finds inbound edge for research node', () => {
    const scenario = getLabScenario('xlsx-lib');
    const derived = deriveLabState(scenario, 'completed');
    const edge = findInboundEdgeForNode('n-libs', derived.edges, derived.nodes);
    expect(edge).not.toBeNull();
    expect(edge!.target).toBe('n-libs');
  });
});
