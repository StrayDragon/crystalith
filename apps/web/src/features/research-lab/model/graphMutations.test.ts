import { describe, expect, it } from '@rstest/core';

import { deriveLabState } from '../../research-lab-demo/fake/deriveLabState';
import { getLabScenario } from '../../research-lab-demo/fake/scenarios';
import { defaultForkDraft, previewPruneAlongEdge } from './graphMutations';
import { extractCitationIds } from './reportDocument';

describe('reportDocument', () => {
  it('extracts inline citation ids', () => {
    const scenario = getLabScenario('xlsx-lib');
    expect(extractCitationIds(scenario.reportMarkdown)).toContain('c2');
  });
});

describe('graphMutations preview', () => {
  it('previews prune impact: fades exclusive closure and keeps failed merge', () => {
    const scenario = getLabScenario('xlsx-lib');
    const derived = deriveLabState(scenario, 'completed');
    const edge = derived.edges.find((e) => e.target === 'n-libs');
    expect(edge).toBeTruthy();
    const preview = previewPruneAlongEdge(edge!.id, derived);
    expect(preview).not.toBeNull();
    expect(preview!.fadedNodeIds).toContain('n-libs');
    // Shared n-stream stays out of exclusive closure while n-perf is live.
    expect(preview!.fadedNodeIds).not.toContain('n-stream');
    expect(preview!.keepsFailedMerge).toBe(true);
  });

  it('builds default fork draft from sibling', () => {
    const scenario = getLabScenario('xlsx-lib');
    const sibling = scenario.nodes.find((n) => n.id === 'n-libs');
    const parent = scenario.nodes.find((n) => n.id === 'root');
    const draft = defaultForkDraft(parent, sibling);
    expect(draft.title).toContain('候选库');
    expect(draft.query).toContain('openpyxl');
  });
});
