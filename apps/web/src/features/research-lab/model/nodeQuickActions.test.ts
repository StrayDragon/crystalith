import { describe, expect, it } from 'vitest';

import { mockEnrichAfterStatus, mockForkSeed } from './mockNodeEnrichment';
import { buildNodeQuickActionGroups, buildNodeQuickActions } from './nodeQuickActions';
import type { LabNode } from './types';

function node(partial: Partial<LabNode> & Pick<LabNode, 'role' | 'conclusionStatus'>): LabNode {
  return {
    id: 'n',
    title: '支路',
    citationIds: [],
    conclusion: '原始发现',
    ...partial,
  };
}

describe('buildNodeQuickActionGroups', () => {
  it('research: 定态 then 结构 rows', () => {
    const groups = buildNodeQuickActionGroups({
      node: node({ role: 'research', conclusionStatus: 'partial', query: 'q' }),
      phase: 'completed',
    });
    expect(groups.map((g) => g.id)).toEqual(['status', 'structure']);
    expect(groups[0]!.actions.find((a) => a.id === 'status-partial')?.active).toBe(true);
    expect(groups[1]!.actions.map((a) => a.label)).toEqual(
      expect.arrayContaining(['改查询', '分叉对照', '剪枝']),
    );
  });

  it('awaiting_confirm question adds 收束 group', () => {
    const groups = buildNodeQuickActionGroups({
      node: node({ role: 'question', conclusionStatus: 'pending' }),
      phase: 'awaiting_confirm',
    });
    expect(groups.map((g) => g.id)).toEqual(['structure', 'close']);
  });

  it('flat helper still works', () => {
    expect(
      buildNodeQuickActions({
        node: node({ role: 'research', conclusionStatus: 'clear' }),
        phase: 'explore',
      }).length,
    ).toBeGreaterThan(3);
  });
});

describe('mockNodeEnrichment', () => {
  it('enriches conclusion text on clear', () => {
    const patch = mockEnrichAfterStatus(
      node({ role: 'research', conclusionStatus: 'partial' }),
      'clear',
    );
    expect(patch.conclusionStatus).toBe('clear');
    expect(patch.conclusion).toMatch(/明确结论/);
  });

  it('fork seed uses query', () => {
    const seed = mockForkSeed({ title: '对照', query: 'xlsx alt', siblingTitle: '主支路' });
    expect(seed.conclusion).toMatch(/xlsx alt/);
    expect(seed.summary).toMatch(/主支路/);
  });
});
