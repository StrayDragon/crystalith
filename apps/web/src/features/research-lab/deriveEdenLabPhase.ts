/**
 * Shared Lab phase derivation (c97 / r450).
 * Eden + Fixture both call this — never fixture timer as Eden SSOT.
 */
import type { ResearchRunStatus } from '@crystalith/shared';

import type { LabProgressLedgerItem } from './labProgressLedger';
import type { LabPhase } from './model/types';

export type DeriveEdenLabPhaseInput = {
  status: ResearchRunStatus | null | undefined;
  progressEvents: readonly LabProgressLedgerItem[];
};

/** Map fixture playback phase → coarse Run status for shared derive. */
export function fixturePlaybackToRunStatus(phase: LabPhase): ResearchRunStatus | null {
  switch (phase) {
    case 'idle':
      return null;
    case 'decompose':
      return 'queued';
    case 'explore':
    case 'evaluate':
    case 'integrate':
      return 'running';
    case 'awaiting_confirm':
      return 'awaiting_confirm';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

function phaseFromProgressKind(ev: LabProgressLedgerItem): LabPhase | null {
  const kind = ev.kind;
  const payloadPhase =
    ev.payload && typeof ev.payload === 'object' && 'phase' in ev.payload
      ? String((ev.payload as { phase?: unknown }).phase)
      : null;
  const headline = (ev.headline ?? '').toLowerCase();

  if (kind === 'run_awaiting_confirm' || kind === 'confirm_entered') return 'awaiting_confirm';
  if (kind === 'run_completed') return 'completed';
  if (kind === 'run_failed' || kind === 'run_cancelled') return 'failed';

  // I4=A: decompose from graph patch / seed
  if (kind === 'graph_patched_summary' || kind === 'graph_seeded') {
    if (headline.includes('整合') || headline.includes('汇入')) return 'integrate';
    return 'decompose';
  }

  if (kind === 'unit_started') return 'explore';
  if (kind === 'node_phase') {
    if (payloadPhase === 'retrieving') return 'explore';
    if (payloadPhase === 'synthesizing') return 'integrate';
    if (headline.includes('retrieving')) return 'explore';
    if (headline.includes('synthesizing')) return 'integrate';
    return 'explore';
  }

  if (
    kind === 'unit_finished' ||
    kind === 'unit_skipped_pruned' ||
    kind === 'unit_aborted' ||
    kind === 'evidence_added' ||
    kind === 'budget_tick'
  ) {
    return 'evaluate';
  }

  if (kind.startsWith('report_') || kind.startsWith('revision_') || kind === 'confirm_resolved') {
    return 'integrate';
  }

  return null;
}

/**
 * I1=A status first; then latest mappable progress; I5=B no node-majority fallback.
 */
export function deriveEdenLabPhase(input: DeriveEdenLabPhaseInput): LabPhase {
  const status = input.status ?? null;

  if (status === null) return 'idle';
  if (status === 'awaiting_confirm') return 'awaiting_confirm';
  if (status === 'completed') return 'completed';
  if (status === 'failed' || status === 'cancelled') return 'failed';

  // Fine phase from progress (newest first)
  const events = input.progressEvents;
  if (events.length > 0) {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const mapped = phaseFromProgressKind(events[i]);
      if (mapped === 'awaiting_confirm' || mapped === 'completed' || mapped === 'failed') {
        // Prefer run.status for terminals; skip ledger terminal noise while running/queued
        continue;
      }
      if (mapped) return mapped;
    }
  }

  // I5=B: no progress → fixed coarse running labels
  if (status === 'queued') return 'decompose';
  if (status === 'running') return 'explore';
  return 'idle';
}
