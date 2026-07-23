import type { ResearchEdge, ResearchNode } from '@crystalith/shared';
import { describe, expect, it } from 'vitest';

import {
  collectFailedMergeConclusionIds,
  FAILED_MERGE_HINT,
  isResearchConclusionNode,
  loadResearchCanvasPrefs,
  saveResearchCanvasPrefs,
  RESEARCH_CANVAS_PREFS_KEY,
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
  it('detects conclusion by role, id prefix, or merge target', () => {
    const edges = [edge('m1', 'a', 'sink', 'merge')];
    expect(isResearchConclusionNode('node_conclusion_1', [])).toBe(true);
    expect(isResearchConclusionNode('sink', edges)).toBe(true);
    expect(isResearchConclusionNode('a', edges)).toBe(false);
    expect(isResearchConclusionNode({ id: 'custom_sink', role: 'conclusion' }, [])).toBe(true);
    expect(isResearchConclusionNode({ id: 'node_conclusion_1', role: 'research' }, [])).toBe(false);
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

  it('flags role=conclusion sinks with pruned merge sources', () => {
    const nodes: ResearchNode[] = [
      { id: 'libs', title: 'libs', conclusionStatus: 'pruned' },
      { id: 'sink', title: '结论', role: 'conclusion', conclusionStatus: 'partial' },
    ];
    const edges = [edge('m1', 'libs', 'sink', 'merge')];
    expect([...collectFailedMergeConclusionIds(nodes, edges)]).toEqual(['sink']);
  });
});

describe('ResearchGraph C3 canvas prefs', () => {
  it('persists direction/minimap to localStorage without graph API calls', () => {
    const store = new Map<string, string>();
    const memory: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    };
    // Prefs are pure localStorage — no prune/fork/PATCH side effects.
    saveResearchCanvasPrefs({ direction: 'LR', showMiniMap: false }, memory);
    expect(store.get(RESEARCH_CANVAS_PREFS_KEY)).toContain('"direction":"LR"');
    const loaded = loadResearchCanvasPrefs(memory);
    expect(loaded).toEqual({ direction: 'LR', showMiniMap: false });
  });
});
