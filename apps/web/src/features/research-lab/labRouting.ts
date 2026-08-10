/** Lightweight path routing for Research Lab (no react-router). */

const LAB_PREFIX = '/research-lab';

export type ResearchLabRoute =
  | { notebookId: number; view: 'graph' }
  | { notebookId: number; view: 'report' };

export function parseResearchLabPath(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
): ResearchLabRoute | null {
  const reportMatch = pathname.match(/^\/research-lab\/(\d+)\/report\/?$/u);
  if (reportMatch) {
    const notebookId = Number(reportMatch[1]);
    if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
    return { notebookId, view: 'report' };
  }
  const match = pathname.match(/^\/research-lab\/(\d+)\/?$/u);
  if (!match) return null;
  const notebookId = Number(match[1]);
  if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
  return { notebookId, view: 'graph' };
}

export function researchLabPath(notebookId: number): string {
  return `${LAB_PREFIX}/${notebookId}`;
}

export function researchLabReportPath(notebookId: number, runId?: number | null): string {
  const base = `${LAB_PREFIX}/${notebookId}/report`;
  if (runId === null || runId === undefined || !Number.isFinite(runId) || runId <= 0) return base;
  return `${base}?rid=${runId}`;
}

export function navigateToResearchLab(
  notebookId: number,
  runId?: number | null,
  opts?: { topic?: string },
): void {
  const path = researchLabPath(notebookId);
  const url = new URL(path, window.location.origin);
  if (runId !== null && runId !== undefined && Number.isFinite(runId) && runId > 0) {
    url.searchParams.set('rid', String(runId));
  } else if (opts?.topic?.trim()) {
    url.searchParams.set('topic', opts.topic.trim());
  }
  const next = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.pushState(
    {
      researchLab: true,
      notebookId,
      view: 'graph',
      rid: runId ?? null,
      // intentionally || — empty trim becomes null
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      topic: opts?.topic?.trim() || null,
    },
    '',
    next,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Read one-shot Compose topic from `?topic=` (cleared after read). */
export function consumeComposeTopicFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const topic = url.searchParams.get('topic')?.trim() ?? '';
  if (!topic) return null;
  url.searchParams.delete('topic');
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(window.history.state, '', next);
  return topic;
}

/** Navigate to Lab report page; optional runId writes `?rid=` (same query as graph). */
export function navigateToLabReport(notebookId: number, runId?: number | null): void {
  const next = researchLabReportPath(notebookId, runId);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.pushState(
    { researchLab: true, notebookId, view: 'report', rid: runId ?? null },
    '',
    next,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToWorkspace(): void {
  if (window.location.pathname === '/') {
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  window.history.pushState({ researchLab: false }, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function isResearchLabPath(pathname: string): boolean {
  return parseResearchLabPath(pathname) !== null;
}
