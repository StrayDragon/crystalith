/**
 * c69 — rewrite flat `/v2/research…` test paths to nested canonical
 * `/v2/notebooks/:nid/research…` (no query notebookId needed).
 */
export function nestResearchPath(path: string, notebookId: number): string {
  if (path.includes('/notebooks/')) return path;

  if (path === '/v2/research' || path.startsWith('/v2/research?')) {
    const q = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    return `/v2/notebooks/${notebookId}/research${q}`;
  }

  const prefix = '/v2/research/';
  if (path.startsWith(prefix)) {
    return `/v2/notebooks/${notebookId}/research/${path.slice(prefix.length)}`;
  }

  return path;
}
