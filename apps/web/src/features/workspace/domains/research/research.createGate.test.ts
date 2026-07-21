import { describe, expect, it } from 'vitest';

import { applyGraphPatch } from './applyGraphPatch';
import { resolvePrimarySurface } from './DeepResearchRunDetail';
import { researchCitationToUi, researchCitationMapToCitations } from './researchCitationAdapter';
import {
  canStartResearch,
  DEFAULT_RESEARCH_CREATE_FORM,
  isProcessResearchStatus,
  isTerminalResearchStatus,
} from './researchCreateGate';

describe('canStartResearch', () => {
  it('disables when topic empty', () => {
    expect(canStartResearch({ ...DEFAULT_RESEARCH_CREATE_FORM, topic: '  ' })).toBe(false);
  });

  it('disables when both switches off', () => {
    expect(
      canStartResearch({
        ...DEFAULT_RESEARCH_CREATE_FORM,
        topic: '量子',
        useNotebookSources: false,
        allowWeb: false,
      }),
    ).toBe(false);
  });

  it('disables when useNotebookSources and no sourceIds', () => {
    expect(
      canStartResearch({
        ...DEFAULT_RESEARCH_CREATE_FORM,
        topic: '量子',
        useNotebookSources: true,
        sourceIds: [],
      }),
    ).toBe(false);
  });

  it('enables with web-only', () => {
    expect(
      canStartResearch({
        ...DEFAULT_RESEARCH_CREATE_FORM,
        topic: '量子',
        useNotebookSources: false,
        allowWeb: true,
        sourceIds: [],
      }),
    ).toBe(true);
  });

  it('enables with sources selected', () => {
    expect(
      canStartResearch({
        ...DEFAULT_RESEARCH_CREATE_FORM,
        topic: '量子',
        useNotebookSources: true,
        allowWeb: true,
        sourceIds: [1],
      }),
    ).toBe(true);
  });
});

describe('primary surface', () => {
  it('uses graph for process statuses', () => {
    expect(resolvePrimarySurface('queued')).toBe('graph');
    expect(resolvePrimarySurface('running')).toBe('graph');
    expect(resolvePrimarySurface('awaiting_confirm')).toBe('graph');
  });

  it('uses report for completed', () => {
    expect(resolvePrimarySurface('completed')).toBe('report');
  });

  it('uses status for failed/cancelled', () => {
    expect(resolvePrimarySurface('failed')).toBe('status');
    expect(resolvePrimarySurface('cancelled')).toBe('status');
  });
});

describe('status helpers', () => {
  it('classifies terminal/process', () => {
    expect(isTerminalResearchStatus('completed')).toBe(true);
    expect(isProcessResearchStatus('running')).toBe(true);
    expect(isProcessResearchStatus('completed')).toBe(false);
  });
});

describe('applyGraphPatch', () => {
  it('upserts and removes nodes/edges', () => {
    const next = applyGraphPatch(
      {
        nodes: [{ id: 'a', title: 'A', conclusionStatus: 'pending' }],
        edges: [{ id: 'e1', source: 'a', target: 'b', kind: 'expand' }],
      },
      {
        nodes: [
          { id: 'a', title: 'A2', conclusionStatus: 'clear' },
          { id: 'b', title: 'B', conclusionStatus: 'partial' },
        ],
        edges: [{ id: 'e2', source: 'a', target: 'b', kind: 'support' }],
        removeEdgeIds: ['e1'],
      },
    );
    expect(next.nodes).toHaveLength(2);
    expect(next.nodes.find((n) => n.id === 'a')?.title).toBe('A2');
    expect(next.edges.map((e) => e.id)).toEqual(['e2']);
  });
});

describe('researchCitationAdapter', () => {
  it('maps citation map keys to Citation.id', () => {
    const ui = researchCitationToUi('c1', {
      sourceName: 'paper',
      snippet: 'hello',
      chunkId: '12',
      sourceId: 3,
      chunkIndex: 1,
    });
    expect(ui.id).toBe('c1');
    expect(ui.chunkId).toBe(12);
    expect(ui.sourceId).toBe(3);
  });

  it('handles web-only citations without chunk', () => {
    const list = researchCitationMapToCitations({
      w1: { sourceName: 'web', snippet: 'x', url: 'https://example.com' },
    });
    expect(list).toHaveLength(1);
    expect(list[0].chunkId).toBeNull();
    expect(list[0].id).toBe('w1');
  });
});
