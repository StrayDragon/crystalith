/** Path helpers for Demo Lab (`/demo/research-lab/...`). Product uses `research-lab/labRouting`. */

const DEMO_LAB_PREFIX = '/demo/research-lab';

export type DemoResearchLabRoute =
  | { notebookId: number; view: 'graph' }
  | { notebookId: number; view: 'report' };

export function parseDemoResearchLabPath(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
): DemoResearchLabRoute | null {
  const reportMatch = pathname.match(/^\/demo\/research-lab\/(\d+)\/report\/?$/);
  if (reportMatch) {
    const notebookId = Number(reportMatch[1]);
    if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
    return { notebookId, view: 'report' };
  }
  const match = pathname.match(/^\/demo\/research-lab\/(\d+)\/?$/);
  if (!match) return null;
  const notebookId = Number(match[1]);
  if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
  return { notebookId, view: 'graph' };
}

export function demoResearchLabPath(notebookId: number): string {
  return `${DEMO_LAB_PREFIX}/${notebookId}`;
}

export function demoResearchLabReportPath(notebookId: number): string {
  return `${DEMO_LAB_PREFIX}/${notebookId}/report`;
}

export function navigateToDemoResearchLab(notebookId: number): void {
  const next = demoResearchLabPath(notebookId);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) {
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  window.history.pushState({ researchLabDemo: true, notebookId, view: 'graph' }, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToDemoLabReport(notebookId: number): void {
  const next = demoResearchLabReportPath(notebookId);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.pushState({ researchLabDemo: true, notebookId, view: 'report' }, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function isDemoResearchLabPath(pathname: string): boolean {
  return parseDemoResearchLabPath(pathname) !== null;
}

export {
  clearLabSessionSnapshot,
  persistLabScenarioId,
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  readPersistedLabScenarioId,
  type LabSessionSnapshot,
} from './labSession';
