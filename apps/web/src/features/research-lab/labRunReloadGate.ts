import { isRecord, parseJsonValue } from '../../shared/json';

/**
 * Cross-route signal: report restore → graph Lab must force GET loadRun (c98 / J2=B).
 */
const KEY = 'crystalith.lab.runNeedsReload';

export function markLabRunNeedsReload(notebookId: number, runId: number): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify({ notebookId, runId, at: Date.now() }));
}

function readReloadMarker(raw: string): { notebookId?: number; runId?: number } | null {
  const parsed = parseJsonValue(raw);
  if (!isRecord(parsed)) return null;
  const notebookId = parsed.notebookId;
  const runId = parsed.runId;
  if (typeof notebookId !== 'number' || typeof runId !== 'number') return null;
  return { notebookId, runId };
}

export function consumeLabRunNeedsReload(notebookId: number, runId: number): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = readReloadMarker(raw);
    if (parsed?.notebookId === notebookId && parsed.runId === runId) {
      sessionStorage.removeItem(KEY);
      return true;
    }
  } catch {
    sessionStorage.removeItem(KEY);
  }
  return false;
}

export function peekLabRunNeedsReload(notebookId: number, runId: number): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = readReloadMarker(raw);
    return parsed?.notebookId === notebookId && parsed.runId === runId;
  } catch {
    return false;
  }
}
