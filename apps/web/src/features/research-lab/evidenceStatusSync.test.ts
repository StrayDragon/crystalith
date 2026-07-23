import { describe, expect, it } from 'vitest';

import {
  buildEdenCitationsMap,
  evidenceToLabCitation,
  resolveNodeCitations,
  unknownEvidenceCitation,
} from './evidenceAdapter';
import { nodeProgress } from './fake/labLayout';
import { resolveLabPrimaryAction } from './fake/resolveLabPrimaryAction';
import type { LabNode } from './fake/types';
import {
  labPausedBannerText,
  shouldShowLabPausedBanner,
  shouldShowLabPlayingTip,
} from './labBannerState';
import {
  deriveLabStateFromRun,
  isEdenLabPlaying,
  researchNodeToLabNode,
  researchRunStatusToLabPhase,
} from './researchGraphAdapter';

describe('evidenceToLabCitation (r434)', () => {
  it('maps web evidence title + snippet', () => {
    const c = evidenceToLabCitation({
      id: 'ev1',
      kind: 'web',
      title: '量子纠错综述',
      snippet: '表面码进展…',
      url: 'https://example.com/a',
    });
    expect(c.id).toBe('ev1');
    expect(c.title).toBe('量子纠错综述');
    expect(c.snippet).toContain('表面码');
    expect(c.kind).toBe('web');
    expect(c.origin).toBe('research');
  });

  it('buildEdenCitationsMap prefers evidences over empty scenario', () => {
    const map = buildEdenCitationsMap({
      evidences: [
        { id: 'ev_a', kind: 'web', title: 'A', snippet: 'sa' },
        { id: 'ev_b', kind: 'chunk', title: 'B', snippet: 'sb', sourceId: 3 },
      ],
      evidenceIds: ['ev_a', 'ev_b', 'ev_missing'],
    });
    expect(map.ev_a?.title).toBe('A');
    expect(map.ev_b?.origin).toBe('notebook');
    expect(map.ev_missing?.snippet).toBe('加载中/未知证据');
  });

  it('resolveNodeCitations never drops ids when map incomplete', () => {
    const cites = resolveNodeCitations(['ev1', 'ev2'], {
      ev1: evidenceToLabCitation({ id: 'ev1', kind: 'web', title: 'T', snippet: 's' }),
    });
    expect(cites).toHaveLength(2);
    expect(cites[1]).toEqual(unknownEvidenceCitation('ev2'));
  });
});

describe('terminal node labels (r435)', () => {
  const pendingConclusion = {
    id: 'node_conclusion_1',
    role: 'conclusion' as const,
    title: '结论',
    conclusionStatus: 'pending' as const,
    phase: 'idle' as const,
    evidenceIds: [] as string[],
  };

  it('completed conclusion is not 排队…', () => {
    const lab = researchNodeToLabNode(pendingConclusion, 'completed');
    expect(lab.conclusionStatus).toBe('clear');
    expect(lab.statusOverride).toBe('综述就绪');
    const prog = nodeProgress(lab);
    expect(prog.hint).not.toBe('排队…');
    expect(prog.show).toBe(false);
  });

  it('failed run settles pending research away from 排队…', () => {
    const lab = researchNodeToLabNode(
      {
        id: 'node_x',
        role: 'research',
        title: '分支',
        conclusionStatus: 'pending',
        phase: 'retrieving',
        evidenceIds: [],
      },
      'failed',
    );
    expect(lab.phase).toBe('idle');
    expect(lab.conclusionStatus).toBe('missing');
    expect(nodeProgress(lab).hint).not.toBe('排队…');
  });

  it('deriveLabStateFromRun maps evidenceIds → citationIds', () => {
    const derived = deriveLabStateFromRun({
      id: 1,
      notebookId: 1,
      topic: 't',
      status: 'completed',
      useNotebookSources: false,
      allowWeb: true,
      depth: 'medium',
      maxSearches: 20,
      maxNodes: 30,
      searchesUsed: 2,
      nodes: [
        {
          id: 'node_r',
          role: 'research',
          title: 'R',
          conclusionStatus: 'partial',
          evidenceIds: ['ev1'],
        },
        pendingConclusion,
      ],
      edges: [],
      evidences: [{ id: 'ev1', kind: 'web', title: 'E', snippet: 's' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(derived.nodes.find((n) => n.id === 'node_r')?.citationIds).toEqual(['ev1']);
    const conclusion = derived.nodes.find((n) => n.role === 'conclusion')!;
    expect(nodeProgress(conclusion).hint).not.toBe('排队…');
  });
});

describe('awaiting_confirm banner / playing (r437)', () => {
  it('playing only for queued|running', () => {
    expect(isEdenLabPlaying('queued')).toBe(true);
    expect(isEdenLabPlaying('running')).toBe(true);
    expect(isEdenLabPlaying('awaiting_confirm')).toBe(false);
    expect(isEdenLabPlaying('completed')).toBe(false);
  });

  it('awaiting_confirm shows wait banner, not 已暂停 / playing tip', () => {
    const phase = researchRunStatusToLabPhase('awaiting_confirm');
    expect(phase).toBe('awaiting_confirm');
    const playing = isEdenLabPlaying('awaiting_confirm');
    expect(
      shouldShowLabPausedBanner({
        showCompose: false,
        reshaping: false,
        playing,
        phase,
      }),
    ).toBe(true);
    expect(labPausedBannerText(phase)).toContain('等待确认');
    expect(labPausedBannerText(phase)).not.toContain('已暂停');
    expect(shouldShowLabPlayingTip({ showCompose: false, playing })).toBe(false);

    const primary = resolveLabPrimaryAction({
      phase,
      playing,
      reshaping: false,
      hasTopic: true,
      conclusionNodeId: 'c',
      selectedNodeId: null,
      selectedRole: null,
    });
    expect(primary.kind).toBe('finish_report');
    expect(primary.label).not.toBe('暂停');
  });

  it('running shows playing tip and no 已暂停 banner', () => {
    const phase = researchRunStatusToLabPhase('running');
    const playing = isEdenLabPlaying('running');
    expect(phase).toBe('explore');
    expect(playing).toBe(true);
    expect(
      shouldShowLabPausedBanner({
        showCompose: false,
        reshaping: false,
        playing,
        phase,
      }),
    ).toBe(false);
    expect(shouldShowLabPlayingTip({ showCompose: false, playing })).toBe(true);
  });
});

describe('nodeProgress pending still 排队 when live', () => {
  it('pending research while running shows 排队…', () => {
    const n: LabNode = {
      id: 'n',
      title: 't',
      role: 'research',
      conclusionStatus: 'pending',
      citationIds: [],
    };
    expect(nodeProgress(n).hint).toBe('排队…');
  });
});
