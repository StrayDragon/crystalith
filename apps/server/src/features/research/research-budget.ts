/** Page-fetch budget helpers (c107). Independent of search budget / confirmKind=budget. */

export function computeMaxPageFetches(maxSearches: number, pageRatio: number): number {
  return Math.max(1, Math.ceil(maxSearches * pageRatio));
}

export function computePageSoftCap(remainingPages: number, remainingLiveNodes: number): number {
  return Math.max(1, Math.ceil(Math.max(0, remainingPages) / Math.max(1, remainingLiveNodes)));
}
