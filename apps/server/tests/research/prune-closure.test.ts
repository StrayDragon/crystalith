import { describe, expect, it } from 'bun:test';

import type { ResearchEdge, ResearchNode } from '@crystalith/shared';

import { collectResearchPruneClosure } from '../../src/features/research/service.ts';

function node(id: string, status: ResearchNode['conclusionStatus'] = 'partial'): ResearchNode {
  return { id, title: id, conclusionStatus: status };
}

function edge(
  id: string,
  source: string,
  target: string,
  kind: ResearchEdge['kind'],
): ResearchEdge {
  return { id, source, target, kind };
}

describe('collectResearchPruneClosure', () => {
  it('does not cascade into root/conclusion or along merge edges', () => {
    const nodes = [node('node_root_1'), node('a'), node('b'), node('node_conclusion_1')];
    const edges = [
      edge('e1', 'node_root_1', 'a', 'decompose'),
      edge('e2', 'a', 'b', 'refine'),
      edge('e3', 'b', 'node_conclusion_1', 'merge'),
    ];
    const closure = collectResearchPruneClosure('a', nodes, edges);
    expect([...closure].sort()).toEqual(['a', 'b']);
    expect(closure.has('node_conclusion_1')).toBe(false);
    expect(closure.has('node_root_1')).toBe(false);
  });

  it('keeps shared child live when another parent is still live (B)', () => {
    const nodes = [node('node_root_1'), node('libs'), node('perf'), node('stream')];
    const edges = [
      edge('e1', 'node_root_1', 'libs', 'decompose'),
      edge('e2', 'node_root_1', 'perf', 'decompose'),
      edge('e3', 'libs', 'stream', 'refine'),
      edge('e4', 'perf', 'stream', 'support'),
      edge('e5', 'libs', 'node_x', 'merge'),
    ];
    // merge target missing from nodes on purpose — closure must not require it
    const closure = collectResearchPruneClosure('libs', nodes, edges);
    expect(closure.has('libs')).toBe(true);
    expect(closure.has('stream')).toBe(false);
    expect(closure.has('perf')).toBe(false);
  });

  it('cascades when the only research parent is in the closure', () => {
    const nodes = [node('node_root_1'), node('data'), node('minimize')];
    const edges = [
      edge('e1', 'node_root_1', 'data', 'decompose'),
      edge('e2', 'data', 'minimize', 'refine'),
    ];
    const closure = collectResearchPruneClosure('data', nodes, edges);
    expect([...closure].sort()).toEqual(['data', 'minimize']);
  });

  it('returns empty for protected root prune', () => {
    const nodes = [node('node_root_1'), node('a')];
    const edges = [edge('e1', 'node_root_1', 'a', 'decompose')];
    expect(collectResearchPruneClosure('node_root_1', nodes, edges).size).toBe(0);
  });
});
