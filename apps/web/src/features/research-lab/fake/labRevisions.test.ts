import { describe, expect, it } from 'vitest';

import { buildSuggestedReportFromNodes } from './buildSuggestedReport';
import { deriveLabState } from './deriveLabState';
import {
  ensureDefaultRevision,
  getActiveRevision,
  saveNewRevision,
  setActiveRevision,
} from './labRevisions';
import { getLabScenario } from './scenarios';

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

  it('ensures default then saves user revision and switches active', () => {
    sessionStorage.removeItem(`crystalith.research-lab.revisions.${notebookId}.${scenarioId}`);
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
    const v0 = ensureDefaultRevision({
      notebookId,
      scenarioId,
      reportMarkdown: '# v0\n',
      graph,
    });
    expect(v0.kind).toBe('default_export');
    expect(getActiveRevision(notebookId, scenarioId)?.id).toBe(v0.id);

    const v1 = saveNewRevision({
      notebookId,
      scenarioId,
      reportMarkdown: '# v1\n',
      graph: { ...graph, forkSeq: 1 },
      parentId: v0.id,
    });
    expect(v1.kind).toBe('user_save');
    expect(getActiveRevision(notebookId, scenarioId)?.id).toBe(v1.id);
    expect(getActiveRevision(notebookId, scenarioId)?.reportMarkdown).toContain('v1');

    setActiveRevision(notebookId, scenarioId, v0.id);
    expect(getActiveRevision(notebookId, scenarioId)?.id).toBe(v0.id);
  });
});
