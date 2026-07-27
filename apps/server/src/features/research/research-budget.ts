/** Research budget helpers — page (c107) + search add-on / soft cap (c108). */

export function computeMaxPageFetches(maxSearches: number, pageRatio: number): number {
  return Math.max(1, Math.ceil(maxSearches * pageRatio));
}

export function computePageSoftCap(remainingPages: number, remainingLiveNodes: number): number {
  return Math.max(1, Math.ceil(Math.max(0, remainingPages) / Math.max(1, remainingLiveNodes)));
}

/** K = clamp(ceil(maxSearches * ratio), minK, maxK). */
export function computeSearchAddOnK(
  maxSearches: number,
  ratio: number,
  minK: number,
  maxK: number,
): number {
  const base = Math.max(0, Math.trunc(maxSearches));
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
  const lo = Math.max(0, Math.trunc(minK));
  const hi = Math.max(lo, Math.trunc(maxK));
  const raw = Math.ceil(base * r);
  return Math.min(hi, Math.max(lo, raw));
}

/** Per-node search soft cap at work-unit start. */
export function computeSearchSoftCap(
  remainingSearches: number,
  remainingLiveNodes: number,
): number {
  return Math.max(1, Math.ceil(Math.max(0, remainingSearches) / Math.max(1, remainingLiveNodes)));
}
