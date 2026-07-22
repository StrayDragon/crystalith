import { describe, expect, it } from 'bun:test';

import { proposalFromStructureToolCall } from '../../src/features/research/node-agent.ts';

describe('proposalFromStructureToolCall', () => {
  it('maps propose_prune to prune_node ActionProposal', () => {
    const p = proposalFromStructureToolCall({
      toolName: 'propose_prune',
      toolCallId: 'tc1',
      args: { rationale: '证据不足' },
    });
    expect(p).toEqual({
      id: 'tc1',
      kind: 'prune_node',
      label: '剪枝此节点',
      rationale: '证据不足',
      status: 'pending',
      params: undefined,
    });
  });

  it('maps rewrite query params', () => {
    const p = proposalFromStructureToolCall({
      toolName: 'propose_rewrite_query',
      toolCallId: 'tc2',
      args: { query: '新查询', title: 'T' },
    });
    expect(p?.kind).toBe('rewrite_query');
    expect(p?.params).toEqual({ query: '新查询', title: 'T' });
  });

  it('returns null for work tools', () => {
    expect(proposalFromStructureToolCall({ toolName: 'webSearch' })).toBeNull();
  });
});
