import { describe, expect, it } from 'vitest';

import { applyGraphPatch } from './applyGraphPatch';

describe('applyGraphPatch', () => {
  it('upserts nodes/edges and applies removes', () => {
    const next = applyGraphPatch(
      {
        nodes: [
          { id: 'a', title: 'A', conclusionStatus: 'pending' },
          { id: 'b', title: 'B', conclusionStatus: 'partial' },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b', kind: 'decompose' }],
      },
      {
        nodes: [{ id: 'b', title: 'B2', conclusionStatus: 'clear' }],
        edges: [{ id: 'e2', source: 'a', target: 'c', kind: 'expand' }],
        removeNodeIds: ['a'],
        removeEdgeIds: ['e1'],
      },
    );
    expect(next.nodes.map((n) => n.id).sort()).toEqual(['b']);
    expect(next.nodes[0]?.title).toBe('B2');
    expect(next.edges.map((e) => e.id)).toEqual(['e2']);
  });
});
