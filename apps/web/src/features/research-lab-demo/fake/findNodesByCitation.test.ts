import { describe, expect, it } from '@rstest/core';

import type { LabNode } from '../../research-lab/model/types';
import { findNodesByCitation, pickPreferredCiteNode } from './findNodesByCitation';

function node(partial: Pick<LabNode, 'id' | 'title' | 'citationIds'> & Partial<LabNode>): LabNode {
  return {
    conclusionStatus: 'clear',
    role: 'research',
    ...partial,
  };
}

describe('findNodesByCitation', () => {
  it('returns research nodes before conclusion for the same cite', () => {
    const nodes = [
      node({ id: 'conclusion', title: '结', role: 'conclusion', citationIds: ['c2'] }),
      node({ id: 'n-perf', title: '性能', citationIds: ['c2', 'c3'] }),
      node({ id: 'n-libs', title: '库', citationIds: ['c1'] }),
    ];
    const hit = findNodesByCitation(nodes, 'c2');
    expect(hit.map((n) => n.id)).toEqual(['n-perf', 'conclusion']);
    expect(pickPreferredCiteNode(hit)?.id).toBe('n-perf');
  });

  it('returns empty when no node uses the cite', () => {
    expect(findNodesByCitation([node({ id: 'a', title: 'a', citationIds: ['c1'] })], 'c9')).toEqual(
      [],
    );
  });
});
