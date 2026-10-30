// covers: r113（deep-research-ui）——pruned 支路的触达边弱化描边但保留、来自 pruned 的 merge「汇入」边不移除，失败汇入时结论节点提示「部分汇入失败」。
import { describe, expect, it } from '@rstest/core';

import { layoutWithElk } from './labLayout';
import type { LabEdge, LabNode } from './types';

function mkNodes(pruned: boolean): LabNode[] {
  return [
    {
      id: 'node_root_1',
      title: '主问题',
      role: 'question',
      conclusionStatus: 'pending',
      citationIds: [],
    },
    {
      id: 'node_research_a',
      title: '支路A',
      role: 'research',
      conclusionStatus: 'clear',
      citationIds: [],
    },
    {
      id: 'node_research_b',
      title: '支路B',
      role: 'research',
      conclusionStatus: pruned ? 'pruned' : 'clear',
      citationIds: [],
    },
    {
      id: 'node_conclusion_1',
      title: '结论',
      role: 'conclusion',
      conclusionStatus: 'clear',
      citationIds: [],
    },
  ];
}

const mkEdges = (): LabEdge[] => [
  { id: 'e_root_a', source: 'node_root_1', target: 'node_research_a', kind: 'expand' },
  { id: 'e_root_b', source: 'node_root_1', target: 'node_research_b', kind: 'expand' },
  {
    id: 'e_merge_a',
    source: 'node_research_a',
    target: 'node_conclusion_1',
    kind: 'merge',
    labelNote: '汇入',
  },
  {
    id: 'e_merge_b',
    source: 'node_research_b',
    target: 'node_conclusion_1',
    kind: 'merge',
    labelNote: '汇入',
  },
];

const handlers = { onFork: () => {}, onPrune: () => {} };

type LaidOutEdge = Awaited<ReturnType<typeof layoutWithElk>>['edges'][number];

function edgeById(edges: LaidOutEdge[], id: string): LaidOutEdge {
  const edge = edges.find((e) => e.id === id);
  expect(edge).toBeDefined();
  return edge!;
}

function dataOf(edge: LaidOutEdge): NonNullable<LaidOutEdge['data']> {
  expect(edge.data).toBeDefined();
  return edge.data!;
}

function styleOf(edge: LaidOutEdge): NonNullable<LaidOutEdge['style']> {
  expect(edge.style).toBeDefined();
  return edge.style!;
}

describe('layoutWithElk pruned fade (r113)', () => {
  it('marks every edge touching a pruned node as faded with weakened stroke, still present', async () => {
    const { edges } = await layoutWithElk(mkNodes(true), mkEdges(), 'TB', handlers);

    // pruned 支路的 merge 边保留在画布上（不移除），且标 faded。
    const mergeFromPruned = edgeById(edges, 'e_merge_b');
    const data = dataOf(mergeFromPruned);
    expect(data.faded).toBe(true);
    expect(data.kind).toBe('merge');
    expect(data.labelNote).toBe('汇入');
    // 弱化描边但仍可见：降透明度 + 浅描边，边对象保留。
    const style = styleOf(mergeFromPruned);
    expect(style.opacity).toBe(0.55);
    expect(style.stroke).toBe('#cbd5e1');
    expect(style.strokeWidth).toBe(1.25);

    // 触达 pruned 节点的上游边同样 faded。
    expect(dataOf(edgeById(edges, 'e_root_b')).faded).toBe(true);
  });

  it('keeps edges away from the pruned branch crisp (control)', async () => {
    const { edges } = await layoutWithElk(mkNodes(true), mkEdges(), 'TB', handlers);

    expect(edgeById(edges, 'e_root_a').data?.faded).toBe(false);
    expect(edgeById(edges, 'e_merge_a').data?.faded).toBe(false);
    expect(edgeById(edges, 'e_merge_a').style?.opacity).toBe(1);
  });

  it('overrides the conclusion node status with 部分汇入失败 when a pruned merge exists', async () => {
    const { nodes } = await layoutWithElk(mkNodes(true), mkEdges(), 'TB', handlers);

    const conclusion = nodes.find((n) => n.id === 'node_conclusion_1');
    expect(conclusion?.data.statusOverride).toBe('部分汇入失败');
    // pruned 节点自身的剪枝语义原样传给渲染层（降透明度由 STATUS_STYLE 消费）。
    const pruned = nodes.find((n) => n.id === 'node_research_b');
    expect(pruned?.data.conclusionStatus).toBe('pruned');
  });

  it('no pruned nodes → no faded edges and no failure footnote (control)', async () => {
    const { nodes, edges } = await layoutWithElk(mkNodes(false), mkEdges(), 'TB', handlers);

    for (const e of edges) {
      expect(e.data?.faded).toBe(false);
    }
    const conclusion = nodes.find((n) => n.id === 'node_conclusion_1');
    expect(conclusion?.data.statusOverride).toBeUndefined();
  });
});
