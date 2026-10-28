import type { ResearchConclusionStatus, ResearchEdgeKind } from '@crystalith/shared';
import { describe, expect, it } from '@rstest/core';

import { collectPruneClosure } from './pruneClosure';
import type { LabEdge, LabNode, LabNodeRole } from './types';

// 直测产品剪枝闭包 SSOT（r316 / update-research-prune-cascade；与 server
// collectResearchPruneClosure 为 twin）。此前唯一覆盖在 demo fixture 的
// deriveLabState 用例下，属结构性错位——语义锁应直接钉在 model/ 上。

function n(id: string, role: LabNodeRole, status: ResearchConclusionStatus = 'pending'): LabNode {
  return { id, title: id, role, conclusionStatus: status, citationIds: [] };
}

function e(source: string, target: string, kind: ResearchEdgeKind = 'support'): LabEdge {
  return { id: `${source}->${target}`, source, target, kind };
}

describe('collectPruneClosure (product B, r316)', () => {
  it('returns an empty set when asked to prune the protected question root / conclusion', () => {
    const nodes = [n('root', 'question'), n('r1', 'research'), n('conclusion', 'conclusion')];
    const edges = [e('root', 'r1'), e('r1', 'conclusion')];
    expect(collectPruneClosure('root', nodes, edges).size).toBe(0);
    expect(collectPruneClosure('conclusion', nodes, edges).size).toBe(0);
  });

  it('prunes an unprotected research node with its exclusive cascade subtree, never the sink', () => {
    const nodes = [
      n('root', 'question'),
      n('r1', 'research'),
      n('r2', 'research'),
      n('conclusion', 'conclusion'),
    ];
    const edges = [e('root', 'r1'), e('r1', 'r2'), e('r2', 'conclusion')];
    expect(collectPruneClosure('r1', nodes, edges)).toEqual(new Set(['r1', 'r2']));
  });

  it('does not walk merge edges into the sink', () => {
    const nodes = [n('r1', 'research'), n('r2', 'research'), n('conclusion', 'conclusion')];
    const edges = [e('r1', 'r2'), e('r1', 'conclusion', 'merge')];
    // r2 cascades via the support edge; the conclusion stays out despite the merge edge.
    expect(collectPruneClosure('r1', nodes, edges)).toEqual(new Set(['r1', 'r2']));
  });

  it('keeps a shared child whose other non-protected parent is still live', () => {
    const nodes = [n('r1', 'research'), n('r2', 'research'), n('shared', 'research')];
    const edges = [e('r1', 'shared'), e('r2', 'shared')];
    expect(collectPruneClosure('r1', nodes, edges)).toEqual(new Set(['r1']));
  });

  it('cascades into the child once every non-protected parent is pruned or in the closure', () => {
    // r2 is NOT pruned via this closure call — it carries conclusionStatus 'pruned'
    // from an earlier prune, which must count as "already pruned" (B).
    const nodes = [n('r1', 'research'), n('r2', 'research', 'pruned'), n('shared', 'research')];
    const edges = [e('r1', 'shared'), e('r2', 'shared')];
    expect(collectPruneClosure('r1', nodes, edges)).toEqual(new Set(['r1', 'shared']));
  });

  it('protected parents never block the cascade', () => {
    // shared also descends from the question root; a protected parent must not
    // keep shared alive the way a live research parent does.
    const nodes = [n('root', 'question'), n('r1', 'research'), n('shared', 'research')];
    const edges = [e('root', 'shared'), e('r1', 'shared')];
    expect(collectPruneClosure('r1', nodes, edges)).toEqual(new Set(['r1', 'shared']));
  });
});
