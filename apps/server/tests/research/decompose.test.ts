/**
 * c93 / r326 pure decompose helpers.
 *
 * Fixture parity checklist (design §6 / xlsx-lib shape — not literal titles):
 * - [x] 1 question + 1 conclusion retained
 * - [x] ≥2 research nodes from question via decompose (when plan has ≥2)
 * - [x] each live research node has merge→conclusion
 * - [x] refine edges allowed when plan says so
 * - [x] clamp respects maxNodes / depth soft caps
 */
import { describe, expect, it } from 'bun:test';

import {
  applyDecomposePlanToGraph,
  clampDecomposePlan,
  suggestedMaxResearchLeaves,
  type ResearchGraphJson,
} from '../../src/features/research/decompose.ts';

function seedGraph(): ResearchGraphJson {
  return {
    nodes: [
      {
        id: 'node_root_q',
        role: 'question',
        title: '主题',
        query: '主题',
        conclusionStatus: 'pending',
        phase: 'idle',
        evidenceIds: [],
      },
      {
        id: 'node_conclusion_c',
        role: 'conclusion',
        title: '结论',
        conclusionStatus: 'pending',
        phase: 'idle',
        evidenceIds: [],
      },
    ],
    edges: [],
  };
}

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

describe('research decompose (c93)', () => {
  it('suggestedMaxResearchLeaves follows depth soft caps', () => {
    expect(suggestedMaxResearchLeaves('shallow')).toBe(4);
    expect(suggestedMaxResearchLeaves('medium')).toBe(8);
    expect(suggestedMaxResearchLeaves('deep')).toBe(16);
  });

  it('clampDecomposePlan prefers decompose and respects room', () => {
    const clamped = clampDecomposePlan(
      {
        branches: [
          { title: 'B', query: 'qb', edgeKind: 'refine' },
          { title: 'A', query: 'qa', edgeKind: 'decompose' },
          { title: 'C', query: 'qc', edgeKind: 'decompose' },
        ],
      },
      { maxNodes: 4, occupiedNodes: 2, depth: 'shallow' },
    );
    // room=2, soft=4 → limit 2; decompose first (A,C)
    expect(clamped.branches).toHaveLength(2);
    expect(clamped.branches.every((b) => b.edgeKind === 'decompose')).toBe(true);
  });

  it('applyDecomposePlanToGraph adds research nodes with decompose+merge', () => {
    seq = 0;
    const plan = {
      branches: [
        { title: '库盘点', query: 'libs', edgeKind: 'decompose' as const },
        { title: '性能', query: 'perf', edgeKind: 'decompose' as const },
      ],
    };
    const { graph, addedNodes, addedEdges } = applyDecomposePlanToGraph(seedGraph(), plan, newId);
    expect(addedNodes).toHaveLength(2);
    expect(addedNodes.every((n) => n.role === 'research')).toBe(true);
    expect(graph.nodes).toHaveLength(4);
    const kinds = addedEdges.map((e) => e.kind).sort();
    expect(kinds).toEqual(['decompose', 'decompose', 'merge', 'merge']);
    for (const n of addedNodes) {
      expect(addedEdges.some((e) => e.source === n.id && e.kind === 'merge')).toBe(true);
      expect(addedEdges.some((e) => e.target === n.id && e.kind === 'decompose')).toBe(true);
    }
  });

  it('empty plan does not mutate topology', () => {
    seq = 0;
    const seed = seedGraph();
    const { graph, addedNodes, addedEdges } = applyDecomposePlanToGraph(
      seed,
      { branches: [] },
      newId,
    );
    expect(addedNodes).toHaveLength(0);
    expect(addedEdges).toHaveLength(0);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });
});
