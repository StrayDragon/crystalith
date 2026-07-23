import { describe, expect, it } from 'bun:test';

import type { ResearchNode } from '@crystalith/shared';

import {
  hasLiveResearchBranches,
  orderResearchNodesForWork,
  researchNodeNeedsWork,
} from '../../src/features/research/research-work-queue.ts';

function node(partial: Partial<ResearchNode> & Pick<ResearchNode, 'id' | 'title'>): ResearchNode {
  return {
    conclusionStatus: 'partial',
    phase: 'idle',
    evidenceIds: [],
    role: 'research',
    ...partial,
  };
}

describe('research-work-queue (c94)', () => {
  it('orderResearchNodesForWork preserves insertion order', () => {
    const nodes: ResearchNode[] = [
      node({ id: 'q', role: 'question', title: 'Q', conclusionStatus: 'pending' }),
      node({ id: 'r-b', title: 'B' }),
      node({ id: 'r-a', title: 'A' }),
      node({ id: 'c', role: 'conclusion', title: 'C', conclusionStatus: 'pending' }),
    ];
    const ordered = orderResearchNodesForWork(nodes).map((n) => n.id);
    expect(ordered).toEqual(['r-b', 'r-a']);
  });

  it('does not re-queue missing after empty writeBack', () => {
    expect(
      researchNodeNeedsWork(
        node({ id: 'r1', title: 'x', conclusionStatus: 'missing', evidenceIds: [] }),
      ),
    ).toBe(false);
  });

  it('hasLiveResearchBranches ignores pruned', () => {
    expect(
      hasLiveResearchBranches([
        node({ id: 'r1', title: 'x', conclusionStatus: 'pruned' }),
        node({ id: 'q', role: 'question', title: 'Q', conclusionStatus: 'pending' }),
      ]),
    ).toBe(false);
    expect(hasLiveResearchBranches([node({ id: 'r1', title: 'x' })])).toBe(true);
  });
});
