import type { ResearchEdge, ResearchNode } from '@crystalith/shared';
import { describe, expect, it } from 'vitest';

import {
  collectFailedMergeConclusionIds,
  FAILED_MERGE_HINT,
  isResearchConclusionNode,
} from './ResearchGraph';

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

describe('ResearchGraph r414 helpers', () => {
  it('detects conclusion by id prefix or merge target', () => {
    const edges = [edge('m1', 'a', 'sink', 'merge')];
    expect(isResearchConclusionNode('node_conclusion_1', [])).toBe(true);
    expect(isResearchConclusionNode('sink', edges)).toBe(true);
    expect(isResearchConclusionNode('a', edges)).toBe(false);
  });

  it('flags conclusion when pruned research still merges in', () => {
    const nodes = [
      node('node_root_1', 'clear'),
      node('libs', 'pruned'),
      node('node_conclusion_1', 'partial'),
    ];
    const edges = [
      edge('e1', 'node_root_1', 'libs', 'decompose'),
      edge('m1', 'libs', 'node_conclusion_1', 'merge'),
    ];
    const ids = collectFailedMergeConclusionIds(nodes, edges);
    expect([...ids]).toEqual(['node_conclusion_1']);
    expect(FAILED_MERGE_HINT).toBe('部分汇入失败');
  });

  it('does not flag when merge source is still live', () => {
    const nodes = [node('libs', 'clear'), node('node_conclusion_1', 'partial')];
    const edges = [edge('m1', 'libs', 'node_conclusion_1', 'merge')];
    expect(collectFailedMergeConclusionIds(nodes, edges).size).toBe(0);
  });
});
