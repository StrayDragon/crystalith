import { describe, expect, it } from '@rstest/core';

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
      phase: 'explore',
    });
    expect(groups.map((g) => g.id)).toEqual(['status', 'structure']);
    expect(groups[0]!.actions.find((a) => a.id === 'status-partial')?.active).toBe(true);
    expect(groups[1]!.actions.map((a) => a.label)).toEqual(
      expect.arrayContaining(['改查询', '分叉对照', '剪枝']),
    );
  });

  it('terminal phases drop status/structure; conclusion keeps only open-report (r105)', () => {
    const research = buildNodeQuickActionGroups({
      node: node({ role: 'research', conclusionStatus: 'clear', query: 'q' }),
      phase: 'completed',
    });
    expect(research).toEqual([]);

    const failedResearch = buildNodeQuickActionGroups({
      node: node({ role: 'research', conclusionStatus: 'missing' }),
      phase: 'failed',
    });
    expect(failedResearch).toEqual([]);

    const conclusion = buildNodeQuickActionGroups({
      node: node({ role: 'conclusion', conclusionStatus: 'clear' }),
      phase: 'completed',
      reportAvailable: true,
    });
    expect(conclusion.map((g) => g.id)).toEqual(['close']);
    expect(conclusion[0]!.actions.map((a) => a.id)).toEqual(['open-report']);
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

  it('proposal payloads never carry fixture vocabulary (leaks into real eden forks)', () => {
    const actions = buildNodeQuickActions({
      node: node({ role: 'research', conclusionStatus: 'partial', query: 'q' }),
      phase: 'explore',
    });
    for (const action of actions) {
      for (const value of Object.values(action.proposal.params ?? {})) {
        if (typeof value === 'string') expect(value).not.toMatch(/Fake|mock/);
      }
      expect(action.proposal.rationale).not.toMatch(/Fake|mock/);
    }
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
