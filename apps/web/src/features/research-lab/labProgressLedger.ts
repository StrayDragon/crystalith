/**
 * Lab progress ledger helpers (c95 / r448).
 * Eden: HTTP progress + SSE seq merge. Fixture: synthetic ledger, same UI shape.
 */

export type LabProgressLedgerItem = {
  id: string;
  seq: number;
  at: string;
  kind: string;
  nodeId?: string | null;
  headline?: string | null;
};

export type LabProgressBudget = {
  searchesUsed: number;
  maxSearches: number;
  researchDone: number;
  researchTotal: number;
  /** Terminal run → force 100%. */
  terminal?: boolean;
};

/** Merge by seq (dedupe); keep ascending order. */
export function mergeProgressBySeq(
  prev: readonly LabProgressLedgerItem[],
  incoming: readonly LabProgressLedgerItem[],
): LabProgressLedgerItem[] {
  const bySeq = new Map<number, LabProgressLedgerItem>();
  for (const item of prev) bySeq.set(item.seq, item);
  for (const item of incoming) bySeq.set(item.seq, item);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Real progress bar (G2=B): blend search budget + research-node completion.
 * Never uses LabPhase timer percentages.
 */
export function computeLabProgressPct(budget: LabProgressBudget): number {
  if (budget.terminal) return 100;
  const searchRatio =
    budget.maxSearches > 0 ? Math.min(1, Math.max(0, budget.searchesUsed / budget.maxSearches)) : 0;
  const nodeRatio =
    budget.researchTotal > 0
      ? Math.min(1, Math.max(0, budget.researchDone / budget.researchTotal))
      : 0;
  const blended = 0.55 * searchRatio + 0.45 * nodeRatio;
  const pct = Math.round(100 * blended);
  return Math.min(99, Math.max(0, pct));
}

export function countResearchNodeProgress(
  nodes: readonly {
    role?: string | null;
    conclusionStatus?: string | null;
    evidenceIds?: readonly string[] | null;
    citationIds?: readonly string[] | null;
  }[],
): { researchDone: number; researchTotal: number } {
  const live = nodes.filter((n) => n.role === 'research' && n.conclusionStatus !== 'pruned');
  const done = live.filter((n) => {
    if ((n.evidenceIds?.length ?? 0) > 0) return true;
    if ((n.citationIds?.length ?? 0) > 0) return true;
    // After work-unit writeBack: missing/clear. Bare `partial` + empty evidence = not done yet.
    return n.conclusionStatus === 'clear' || n.conclusionStatus === 'missing';
  });
  return { researchDone: done.length, researchTotal: live.length };
}

/** Fixture demo budget: sourcesRetrieved proxies searches; soft cap 24. */
export function fixtureBudgetFromSources(
  sourcesRetrieved: number,
  opts?: { maxSearches?: number },
): Pick<LabProgressBudget, 'searchesUsed' | 'maxSearches'> {
  const maxSearches = opts?.maxSearches ?? 24;
  return {
    maxSearches,
    searchesUsed: Math.min(maxSearches, Math.max(0, sourcesRetrieved)),
  };
}

const FIXTURE_PHASE_KIND: Record<string, string> = {
  idle: 'run_queued',
  decompose: 'graph_patched_summary',
  explore: 'unit_started',
  evaluate: 'unit_finished',
  integrate: 'graph_patched_summary',
  awaiting_confirm: 'run_awaiting_confirm',
  completed: 'run_completed',
  failed: 'run_failed',
};

/** Append one fixture ledger row when phase advances (isomorphic with Eden UI). */
export function appendFixturePhaseEvent(
  prev: readonly LabProgressLedgerItem[],
  phase: string,
  headline: string,
  nodeId?: string | null,
): LabProgressLedgerItem[] {
  const seq = (prev.at(-1)?.seq ?? 0) + 1;
  const item: LabProgressLedgerItem = {
    id: `fixture_${seq}`,
    seq,
    at: new Date().toISOString(),
    kind: FIXTURE_PHASE_KIND[phase] ?? 'unit_finished',
    nodeId: nodeId ?? null,
    headline,
  };
  return mergeProgressBySeq(prev, [item]);
}

export function lastProgressSeq(items: readonly LabProgressLedgerItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.seq), 0);
}

export function formatProgressTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
