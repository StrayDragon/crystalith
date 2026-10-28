import { afterEach, describe, expect, it } from '@rstest/core';
// demo 报告面合并测试：CoW 工作副本 / 修订存储 / 会话快照 / 建议报告组装。
// （原 reportCow / labRevisions / labSession 三个碎片文件收敛于此。）

import {
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  type LabSessionSnapshot,
} from '../labSession';
import { buildSuggestedReportFromNodes } from './buildSuggestedReport';
import { deriveLabState } from './deriveLabState';
import {
  ensureDefaultRevision,
  getActiveRevision,
  saveNewRevision,
  setActiveRevision,
} from './labRevisions';
import {
  activeReportMarkdown,
  applyReportEdit,
  buildCanonical,
  clearWorkingCopy,
  orphanCitationIds,
  persistWorkingCopy,
  readWorkingCopy,
  workingCopyStorageKey,
} from './reportCow';
import { getLabScenario } from './scenarios';

describe('reportCow', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('activeReportMarkdown prefers working when viewing working', () => {
    const canonical = buildCanonical({
      scenarioId: 'xlsx-lib',
      notebookId: 1,
      markdown: '# Canon\nA [^c1]',
      producedAt: '2026-01-01T00:00:00.000Z',
    });
    const working = {
      ...canonical,
      markdown: '# Edit\nB [^c1]',
      forkedFromProducedAt: canonical.producedAt,
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(activeReportMarkdown(canonical, working, 'canonical')).toBe(canonical.markdown);
    expect(activeReportMarkdown(canonical, working, 'working')).toBe(working.markdown);
    expect(activeReportMarkdown(canonical, null, 'working')).toBe(canonical.markdown);
  });

  it('applyReportEdit forks on first change then updates copy', () => {
    const canonical = buildCanonical({
      scenarioId: 'xlsx-lib',
      notebookId: 7,
      markdown: 'Hello [^a]',
      producedAt: '2026-01-01T00:00:00.000Z',
    });
    const first = applyReportEdit({
      canonical,
      working: null,
      nextMarkdown: 'Hello edited [^a]',
      now: '2026-01-02T00:00:00.000Z',
    });
    expect(first.forked).toBe(true);
    expect(first.working.markdown).toBe('Hello edited [^a]');
    expect(first.working.forkedFromProducedAt).toBe(canonical.producedAt);
    expect(canonical.markdown).toBe('Hello [^a]');

    const second = applyReportEdit({
      canonical,
      working: first.working,
      nextMarkdown: 'Hello again',
      now: '2026-01-03T00:00:00.000Z',
    });
    expect(second.forked).toBe(false);
    expect(second.working.markdown).toBe('Hello again');
    expect(second.working.updatedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('orphanCitationIds lists cites removed from active body', () => {
    expect(orphanCitationIds('A [^c1] B [^c2]', 'A [^c1]')).toEqual(['c2']);
    expect(orphanCitationIds('A [^c1]', 'A [^c1] B [^c2]')).toEqual([]);
  });

  it('persists and clears working copy in sessionStorage', () => {
    const key = workingCopyStorageKey(3, 'xlsx-lib');
    expect(readWorkingCopy(3, 'xlsx-lib')).toBeNull();

    const copy = {
      scenarioId: 'xlsx-lib',
      notebookId: 3,
      markdown: 'fork',
      forkedFromProducedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    persistWorkingCopy(copy);
    expect(sessionStorage.getItem(key)).toBeTruthy();
    expect(readWorkingCopy(3, 'xlsx-lib')).toEqual(copy);

    clearWorkingCopy(3, 'xlsx-lib');
    expect(readWorkingCopy(3, 'xlsx-lib')).toBeNull();
  });
});

describe('buildSuggestedReportFromNodes', () => {
  it('includes research branches and conclusion', () => {
    const scenario = getLabScenario('xlsx-lib');
    const derived = deriveLabState(scenario, 'completed');
    const md = buildSuggestedReportFromNodes({
      topic: scenario.topic,
      nodes: derived.nodes,
      citations: scenario.citations,
      edges: derived.edges,
    });
    expect(md).toMatch(/^# /);
    expect(md).toContain('## 支路发现');
    expect(md).toContain('## 综合结论');
    expect(md).toMatch(/\[\^[a-z0-9]+\]/);
  });

  it('lists failed merge branches after prune', () => {
    const scenario = getLabScenario('xlsx-lib');
    const derived = deriveLabState(scenario, 'completed', {
      mutations: {
        prunedNodeIds: ['n-libs'],
        extraNodes: [],
        extraEdges: [],
        nodeEdits: {},
        activityNotes: [],
      },
    });
    const md = buildSuggestedReportFromNodes({
      topic: scenario.topic,
      nodes: derived.nodes,
      citations: scenario.citations,
      edges: derived.edges,
    });
    expect(md).toContain('## 汇入失败支路');
    expect(md).toContain('候选库');
    expect(md).not.toContain('〔部分汇入失败〕');
  });

  it('embeds [^@nodeId] anchors for research and conclusion blocks', () => {
    const scenario = getLabScenario('xlsx-lib');
    const derived = deriveLabState(scenario, 'completed');
    const md = buildSuggestedReportFromNodes({
      topic: scenario.topic,
      nodes: derived.nodes,
      citations: scenario.citations,
      edges: derived.edges,
    });
    expect(md).toContain('[^@n-libs]');
    expect(md).toContain('[^@conclusion]');
  });
});

describe('labRevisions store', () => {
  const notebookId = 9001;
  const scenarioId = 'xlsx-lib-rev-test';
  const graph = {
    phase: 'completed' as const,
    mutations: {
      prunedNodeIds: [],
      extraNodes: [],
      extraEdges: [],
      nodeEdits: {},
      activityNotes: [],
    },
    topicDraft: 't',
    forkSeq: 0,
    forceStatus: null,
  };

  it('ensures default then saves user revision and switches active', () => {
    sessionStorage.removeItem(`crystalith.research-lab.revisions.${notebookId}.${scenarioId}`);
    const v0 = ensureDefaultRevision({
      notebookId,
      scenarioId,
      reportMarkdown: '# v0\n',
      graph,
    });
    expect(v0.kind).toBe('default_export');
    expect(getActiveRevision(notebookId, scenarioId)!.id).toBe(v0.id);

    const v1 = saveNewRevision({
      notebookId,
      scenarioId,
      reportMarkdown: '# v1\n',
      graph: { ...graph, forkSeq: 1 },
      parentId: v0.id,
    });
    expect(v1.kind).toBe('user_save');
    expect(getActiveRevision(notebookId, scenarioId)!.id).toBe(v1.id);
    expect(getActiveRevision(notebookId, scenarioId)!.reportMarkdown).toContain('v1');

    setActiveRevision(notebookId, scenarioId, v0.id);
    expect(getActiveRevision(notebookId, scenarioId)!.id).toBe(v0.id);
  });
});

const SESSION_SNAP: LabSessionSnapshot = {
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
    prunedNodeIds: ['n-libs'],
    extraNodes: [],
    extraEdges: [],
    nodeEdits: {},
    activityNotes: ['剪枝测试'],
  },
  topicDraft: 'hello',
  forkSeq: 3,
  useNotebookSources: true,
  allowWeb: true,
  selectedSourceIds: [1, 2],
};

describe('labSession', () => {
  it('round-trips graph snapshot so report return can restore', () => {
    persistLabSessionSnapshot(SESSION_SNAP);
    const loaded = readLabSessionSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded!.phase).toBe('completed');
    expect(loaded!.mutations.prunedNodeIds).toEqual(['n-libs']);
    expect(loaded!.selectedNodeId).toBe('conclusion');
    expect(loaded!.forkSeq).toBe(3);
    expect(loaded!.selectedSourceIds).toEqual([1, 2]);
  });

  it('restores layout prefs and never auto-resumes playback', () => {
    persistLabSessionSnapshot(SESSION_SNAP);
    const loaded = readLabSessionSnapshot();
    expect(loaded!.playing).toBe(false); // never auto-resume
    expect(loaded!.layoutDirection).toBe('LR');
    expect(loaded!.layoutAlgorithm).toBe('mrtree');
    expect(loaded!.edgePathPreset).toBe('bezier');
    expect(loaded!.useNotebookSources).toBe(true);
  });
});
