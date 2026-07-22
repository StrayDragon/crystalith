/** Lightweight path routing for Research Lab (no react-router). */

const LAB_PREFIX = '/research-lab';

export type ResearchLabRoute =
  | { notebookId: number; view: 'graph' }
  | { notebookId: number; view: 'report' };

export function parseResearchLabPath(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
): ResearchLabRoute | null {
  const reportMatch = pathname.match(/^\/research-lab\/(\d+)\/report\/?$/);
  if (reportMatch) {
    const notebookId = Number(reportMatch[1]);
    if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
    return { notebookId, view: 'report' };
  }
  const match = pathname.match(/^\/research-lab\/(\d+)\/?$/);
  if (!match) return null;
  const notebookId = Number(match[1]);
  if (!Number.isFinite(notebookId) || notebookId <= 0) return null;
  return { notebookId, view: 'graph' };
}

export function researchLabPath(notebookId: number): string {
  return `${LAB_PREFIX}/${notebookId}`;
}

export function researchLabReportPath(notebookId: number): string {
  return `${LAB_PREFIX}/${notebookId}/report`;
}

export function navigateToResearchLab(notebookId: number): void {
  const path = researchLabPath(notebookId);
  if (window.location.pathname === path) return;
  window.history.pushState({ researchLab: true, notebookId, view: 'graph' }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateToLabReport(notebookId: number): void {
  const path = researchLabReportPath(notebookId);
  if (window.location.pathname === path) return;
  window.history.pushState({ researchLab: true, notebookId, view: 'report' }, '', path);
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

export {
  clearLabSessionSnapshot,
  persistLabScenarioId,
  persistLabSessionSnapshot,
  readLabSessionSnapshot,
  readPersistedLabScenarioId,
  type LabSessionSnapshot,
} from './labSession';
