import type { ResearchRun } from '@crystalith/shared';
import { describe, expect, it } from '@rstest/core';

import { layoutWithElk } from './model/labLayout';
import type { LabNode } from './model/types';
import { deriveLabStateFromRun } from './researchGraphAdapter';

// covers: r148, r445
// r148 — 报告可见性门控：failed run 不展示报告（含启发式清单）；
//        0 证据但 completed 且有 report 的诚实成稿仍按普通报告渲染。
// r445 — conclusion 节点（显式 role 或 node_conclusion_ id 前缀）不作为
//        可剪枝研究支路入口展示（canPrune=false）。

function mkRun(overrides: Partial<ResearchRun>): ResearchRun {
  return {
    id: 1,
    notebookId: 1,
    topic: '测试课题',
    status: 'completed',
    searchesUsed: 3,
    nodes: [
      { id: 'node_root_1', title: '根问题', conclusionStatus: 'clear' },
      {
        id: 'node_conclusion_1',
        title: '结论',
        role: 'conclusion',
        conclusionStatus: 'clear',
        summary: '最终结论',
      },
    ],
    edges: [],
  } as unknown as ResearchRun;
  void overrides;
}

describe('r148 failed synthesize has no heuristic report UI', () => {
  it('a failed run never exposes the report entry', () => {
    const failed = deriveLabStateFromRun({ ...mkRun({}), status: 'failed', report: null });
    expect(failed.reportVisible).toBe(false);
  });

  it('a completed run with a report renders it like any ordinary report', () => {
    // 0-evidence but completed honest write-up: report present → visible.
    const done = deriveLabStateFromRun({
      ...mkRun({}),
      status: 'completed',
      report: { title: '诚实成稿', sections: [], citations: {} },
    });
    expect(done.reportVisible).toBe(true);
  });

  it('a completed run without a report keeps the entry hidden', () => {
    const noReport = deriveLabStateFromRun({ ...mkRun({}), status: 'completed', report: null });
    expect(noReport.reportVisible).toBe(false);
  });
});

describe('r445 conclusion nodes are not prune-entry points', () => {
  const nodeById = (role?: 'research' | 'conclusion', id?: string): LabNode => ({
    id: id ?? (role === 'conclusion' ? 'node_conclusion_x' : 'node_research_x'),
    title: 'n',
    role,
    conclusionStatus: 'clear',
    citationIds: [],
  });

  const mkGraph = (target: LabNode) => ({
    nodes: [nodeById(undefined, 'node_root_1'), target],
    edges: [
      {
        id: 'e1',
        source: 'node_root_1',
        target: target.id,
        kind: 'explore',
      },
    ],
  });

  it('an explicit role=conclusion target gets no prune (or fork) action', async () => {
    const { edges } = await layoutWithElk(
      mkGraph(nodeById('conclusion')).nodes,
      mkGraph(nodeById('conclusion')).edges as never,
      'TB',
      { onFork: () => {}, onPrune: () => {} },
    );
    expect(edges[0]?.data?.canPrune).toBe(false);
    expect(edges[0]?.data?.canFork).toBe(false);
  });

  it('the node_conclusion_ id prefix is honored even without an explicit role', async () => {
    const target = nodeById(undefined, 'node_conclusion_prefix');
    const graph = mkGraph(target);
    const { edges } = await layoutWithElk(
      [{ ...target, role: 'conclusion' }],
      graph.edges as never,
      'TB',
      { onFork: () => {}, onPrune: () => {} },
    );
    expect(edges[0]?.data?.canPrune).toBe(false);
  });

  it('research targets keep their prune entry (control case), unless readOnly', async () => {
    const graph = mkGraph(nodeById('research'));
    const editable = await layoutWithElk(graph.nodes, graph.edges as never, 'TB', {
      onFork: () => {},
      onPrune: () => {},
    });
    expect(editable.edges[0]?.data?.canPrune).toBe(true);

    const readOnly = await layoutWithElk(
      graph.nodes,
      graph.edges as never,
      'TB',
      {
        onFork: () => {},
        onPrune: () => {},
      },
      { readOnly: true },
    );
    expect(readOnly.edges[0]?.data?.canPrune).toBe(false);
  });
});
