import { describe, expect, it } from '@rstest/core';

import { advanceLabPlayback, deriveLabState } from './deriveLabState';
import { getLabScenario } from './scenarios';

describe('deriveLabState', () => {
  it('shows root only in idle and single conclusion when completed', () => {
    const scenario = getLabScenario('xlsx-lib');
    const idle = deriveLabState(scenario, 'idle');
    expect(idle.nodes.map((n) => n.id)).toEqual(['root']);
    expect(idle.reportVisible).toBe(false);
    expect(idle.conclusionNodeId).toBeNull();

    const done = deriveLabState(scenario, 'completed');
    expect(done.nodes.filter((n) => n.role === 'conclusion')).toHaveLength(1);
    expect(done.conclusionNodeId).toBe('conclusion');
    expect(done.nodes.find((n) => n.id === 'root')?.role).toBe('question');
    expect(done.nodes.find((n) => n.id === 'n-perf')?.conclusionStatus).toBe('partial');
    expect(done.reportVisible).toBe(true);
  });

  it('applies forceStatus only to research nodes', () => {
    const scenario = getLabScenario('cloud-db');
    const forced = deriveLabState(scenario, 'completed', { forceStatus: 'clear' });
    expect(forced.nodes.find((n) => n.role === 'research')?.conclusionStatus).toBe('clear');
    expect(forced.nodes.find((n) => n.role === 'conclusion')?.conclusionStatus).not.toBe('clear');
  });

  // 剪枝闭包语义（fade exclusive subtree / cascade / merge 保留）已迁至产品直测
  // model/pruneClosure.test.ts；此处仅保留一条 deriveLabState 接线用例（下方
  // 'prune fades exclusive subtree …'）。

  it('forks research into same conclusion sink', () => {
    const scenario = getLabScenario('xlsx-lib');
    const forked = deriveLabState(scenario, 'completed', {
      mutations: {
        prunedNodeIds: [],
        extraNodes: [
          {
            id: 'fork-1',
            role: 'research',
            title: '分叉节点',
            conclusionStatus: 'pending',
            citationIds: [],
          },
        ],
        extraEdges: [
          { id: 'e-fork-1', source: 'root', target: 'fork-1', kind: 'fork', labelNote: '分叉' },
          {
            id: 'e-fork-1-merge',
            source: 'fork-1',
            target: 'conclusion',
            kind: 'merge',
            labelNote: '汇入',
          },
        ],
        nodeEdits: {},
        activityNotes: [],
      },
    });
    expect(forked.nodes.filter((n) => n.role === 'conclusion')).toHaveLength(1);
    expect(forked.edges.some((e) => e.source === 'fork-1' && e.target === 'conclusion')).toBe(true);
  });

  it('applies node edits', () => {
    const scenario = getLabScenario('xlsx-lib');
    const edited = deriveLabState(scenario, 'completed', {
      mutations: {
        prunedNodeIds: [],
        extraNodes: [],
        extraEdges: [],
        nodeEdits: { conclusion: { title: '改写后的结论', conclusion: '新答案' } },
        activityNotes: [],
      },
    });
    expect(edited.nodes.find((n) => n.id === 'conclusion')?.title).toBe('改写后的结论');
    expect(edited.nodes.find((n) => n.id === 'conclusion')?.conclusion).toBe('新答案');
  });

  it('preserves askOnInterrupt on question edits', () => {
    const scenario = getLabScenario('xlsx-lib');
    expect(scenario.nodes.find((n) => n.id === 'root')?.askOnInterrupt).toBe(true);
    const edited = deriveLabState(scenario, 'idle', {
      mutations: {
        prunedNodeIds: [],
        extraNodes: [],
        extraEdges: [],
        nodeEdits: { root: { askOnInterrupt: false } },
        activityNotes: [],
      },
    });
    expect(edited.nodes.find((n) => n.id === 'root')?.askOnInterrupt).toBe(false);
  });

  it('adds fork branch edges into conclusion (topology for backend fork)', () => {
    const scenario = getLabScenario('xlsx-lib');
    const forked = deriveLabState(scenario, 'completed', {
      mutations: {
        prunedNodeIds: [],
        extraNodes: [
          {
            id: 'fork-1',
            title: '分叉支路',
            role: 'research',
            query: 'alt query',
            conclusion: '待探索的替代发现。',
            conclusionStatus: 'pending',
            citationIds: [],
          },
        ],
        extraEdges: [
          { id: 'e-fork-1', source: 'root', target: 'fork-1', kind: 'fork', labelNote: '分叉' },
          {
            id: 'e-fork-1-merge',
            source: 'fork-1',
            target: 'conclusion',
            kind: 'merge',
            labelNote: '汇入',
          },
        ],
        nodeEdits: {},
        activityNotes: [],
      },
    });
    expect(forked.nodes.some((n) => n.id === 'fork-1')).toBe(true);
    expect(forked.edges.some((e) => e.id === 'e-fork-1' && e.kind === 'fork')).toBe(true);
    expect(
      forked.edges.some(
        (e) => e.source === 'fork-1' && e.target === 'conclusion' && e.kind === 'merge',
      ),
    ).toBe(true);
    const fork = forked.nodes.find((n) => n.id === 'fork-1')!;
    expect(fork.conclusionStatus).toBe('partial');
    expect(fork.conclusion).not.toBe('待探索的替代发现。');
    expect(fork.citationIds.length).toBeGreaterThan(0);
  });

  it('fork stays pending/retrieving during explore, settles after evaluate', () => {
    const scenario = getLabScenario('xlsx-lib');
    const mutations = {
      prunedNodeIds: [] as string[],
      extraNodes: [
        {
          id: 'fork-1',
          title: '分叉支路',
          role: 'research' as const,
          conclusion: '待探索的替代发现。',
          conclusionStatus: 'pending' as const,
          citationIds: [] as string[],
        },
      ],
      extraEdges: [{ id: 'e-fork-1', source: 'root', target: 'fork-1', kind: 'fork' as const }],
      nodeEdits: {},
      activityNotes: [] as string[],
    };
    const exploring = deriveLabState(scenario, 'explore', { mutations });
    expect(exploring.nodes.find((n) => n.id === 'fork-1')?.phase).toBe('retrieving');
    expect(exploring.nodes.find((n) => n.id === 'fork-1')?.conclusionStatus).toBe('pending');
    const evaluated = deriveLabState(scenario, 'evaluate', { mutations });
    expect(evaluated.nodes.find((n) => n.id === 'fork-1')?.conclusionStatus).toBe('partial');
  });

  it('wiring: prune marks the node, keeps shared child live, and keeps merge into conclusion', () => {
    const scenario = getLabScenario('xlsx-lib');
    const pruned = deriveLabState(scenario, 'completed', {
      mutations: {
        prunedNodeIds: ['n-libs'],
        extraNodes: [],
        extraEdges: [],
        nodeEdits: {},
        activityNotes: [],
      },
    });
    expect(pruned.nodes.find((n) => n.id === 'n-stream')?.conclusionStatus).not.toBe('pruned');
    expect(pruned.nodes.find((n) => n.id === 'n-libs')?.conclusionStatus).toBe('pruned');
    expect(pruned.edges.some((e) => e.source === 'n-libs' && e.target === 'n-stream')).toBe(true);
    expect(pruned.edges.some((e) => e.source === 'n-libs' && e.target === 'conclusion')).toBe(true);
  });

  // cascade 场景（compliance）已随剪枝语义迁至 model/pruneClosure.test.ts 直测。
});

describe('advanceLabPlayback', () => {
  it('pauses at awaiting_confirm when askOnInterrupt', () => {
    expect(advanceLabPlayback('integrate', true)).toEqual({
      phase: 'awaiting_confirm',
      playing: false,
    });
  });

  it('skips confirm and completes when askOnInterrupt is false', () => {
    expect(advanceLabPlayback('integrate', false)).toEqual({
      phase: 'completed',
      playing: false,
    });
  });
});
