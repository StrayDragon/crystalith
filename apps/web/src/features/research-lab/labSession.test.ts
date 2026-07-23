import { describe, expect, it } from 'vitest';

import { EMPTY_MUTATIONS } from './fake/deriveLabState';
import {
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  type LabSessionSnapshot,
} from './labSession';

describe('labSession', () => {
  it('round-trips graph snapshot so report return can restore', () => {
    const snap: LabSessionSnapshot = {
      scenarioId: 'xlsx-lib',
      phase: 'completed',
      playing: true,
      playbackMs: 1000,
      layoutDirection: 'LR',
      layoutAlgorithm: 'mrtree',
      edgePathPreset: 'bezier',
      selectedNodeId: 'conclusion',
      highlightedNodeIds: [],
      consoleOpen: false,
      consoleVisible: true,
      forceStatus: null,
      metricsOverride: null,
      confirmChoice: 'finish_report',
      mutations: {
        ...EMPTY_MUTATIONS,
        prunedNodeIds: ['n-libs'],
        activityNotes: ['剪枝测试'],
      },
      topicDraft: 'hello',
      forkSeq: 3,
      useNotebookSources: true,
      allowWeb: true,
      selectedSourceIds: [1, 2],
    };
    persistLabSessionSnapshot(snap);
    const loaded = readLabSessionSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded!.phase).toBe('completed');
    expect(loaded!.playing).toBe(false); // never auto-resume
    expect(loaded!.mutations.prunedNodeIds).toEqual(['n-libs']);
    expect(loaded!.layoutDirection).toBe('LR');
    expect(loaded!.layoutAlgorithm).toBe('mrtree');
    expect(loaded!.edgePathPreset).toBe('bezier');
    expect(loaded!.selectedNodeId).toBe('conclusion');
    expect(loaded!.forkSeq).toBe(3);
    expect(loaded!.useNotebookSources).toBe(true);
    expect(loaded!.selectedSourceIds).toEqual([1, 2]);
  });
});
