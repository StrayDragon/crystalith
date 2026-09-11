import { describe, expect, it } from '@rstest/core';

import { deriveEdenLabPhase, fixturePlaybackToRunStatus } from './deriveEdenLabPhase';
import type { LabProgressLedgerItem } from './labProgressLedger';

function ev(
  partial: Partial<LabProgressLedgerItem> & Pick<LabProgressLedgerItem, 'seq' | 'kind'>,
): LabProgressLedgerItem {
  return {
    id: `e${partial.seq}`,
    at: '2026-07-24T00:00:00.000Z',
    ...partial,
  };
}

describe('deriveEdenLabPhase (c97)', () => {
  it('status awaiting_confirm wins (r437)', () => {
    expect(
      deriveEdenLabPhase({
        status: 'awaiting_confirm',
        progressEvents: [ev({ seq: 1, kind: 'unit_started' })],
      }),
    ).toBe('awaiting_confirm');
  });

  it('I4: graph_patched_summary → decompose', () => {
    expect(
      deriveEdenLabPhase({
        status: 'running',
        progressEvents: [
          ev({ seq: 1, kind: 'graph_patched_summary', headline: '已拆解 3 个研究支路' }),
        ],
      }),
    ).toBe('decompose');
  });

  it('maps unit_started → explore and unit_finished → evaluate', () => {
    expect(
      deriveEdenLabPhase({
        status: 'running',
        progressEvents: [
          ev({ seq: 1, kind: 'graph_patched_summary' }),
          ev({ seq: 2, kind: 'unit_started' }),
        ],
      }),
    ).toBe('explore');
    expect(
      deriveEdenLabPhase({
        status: 'running',
        progressEvents: [
          ev({ seq: 1, kind: 'unit_started' }),
          ev({ seq: 2, kind: 'unit_finished' }),
        ],
      }),
    ).toBe('evaluate');
  });

  it('maps report_* → integrate', () => {
    expect(
      deriveEdenLabPhase({
        status: 'running',
        progressEvents: [ev({ seq: 1, kind: 'report_canonical_updated' })],
      }),
    ).toBe('integrate');
  });

  it('I5=B: no progress while running → explore (no node guess)', () => {
    expect(deriveEdenLabPhase({ status: 'running', progressEvents: [] })).toBe('explore');
    expect(deriveEdenLabPhase({ status: 'queued', progressEvents: [] })).toBe('decompose');
  });

  it('fixturePlaybackToRunStatus covers fine phases as running', () => {
    expect(fixturePlaybackToRunStatus('evaluate')).toBe('running');
    expect(fixturePlaybackToRunStatus('awaiting_confirm')).toBe('awaiting_confirm');
  });
});
