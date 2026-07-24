import { describe, expect, it } from 'vitest';

import {
  appendFixturePhaseEvent,
  computeLabProgressPct,
  countResearchNodeProgress,
  mergeProgressBySeq,
} from './labProgressLedger';

describe('labProgressLedger (c95)', () => {
  it('mergeProgressBySeq dedupes and sorts by seq', () => {
    const merged = mergeProgressBySeq(
      [
        { id: 'a', seq: 1, at: 't1', kind: 'run_running' },
        { id: 'b', seq: 2, at: 't2', kind: 'unit_started' },
      ],
      [
        { id: 'b2', seq: 2, at: 't2b', kind: 'unit_started', headline: '更新' },
        { id: 'c', seq: 3, at: 't3', kind: 'unit_finished' },
      ],
    );
    expect(merged.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(merged[1]?.headline).toBe('更新');
  });

  it('computeLabProgressPct blends budget and never uses phase timer', () => {
    expect(
      computeLabProgressPct({
        searchesUsed: 10,
        maxSearches: 20,
        researchDone: 1,
        researchTotal: 2,
      }),
    ).toBe(50);
    expect(
      computeLabProgressPct({
        searchesUsed: 0,
        maxSearches: 20,
        researchDone: 0,
        researchTotal: 0,
        terminal: true,
      }),
    ).toBe(100);
  });

  it('countResearchNodeProgress ignores pruned', () => {
    expect(
      countResearchNodeProgress([
        { role: 'question', conclusionStatus: 'pending' },
        { role: 'research', conclusionStatus: 'partial', evidenceIds: ['e1'] },
        { role: 'research', conclusionStatus: 'pruned', evidenceIds: [] },
        { role: 'research', conclusionStatus: 'partial', evidenceIds: [] },
      ]),
    ).toEqual({ researchDone: 1, researchTotal: 2 });
  });

  it('appendFixturePhaseEvent grows ledger', () => {
    const a = appendFixturePhaseEvent([], 'decompose', '意图拆解');
    const b = appendFixturePhaseEvent(a, 'explore', '多源探索', 'n1');
    expect(b).toHaveLength(2);
    expect(b[1]?.nodeId).toBe('n1');
    expect(b[1]?.kind).toBe('unit_started');
  });
});
