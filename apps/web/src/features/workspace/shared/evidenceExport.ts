import { toast } from '../../../shared/toast';


const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
  'http://localhost:8032';

function downloadTextAsFile(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openDownloadUrl(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Download QA export as Markdown.
 * v2 equivalent: GET /v2/qa/export?session_id=...&message_id=...&format=markdown
 */
export function exportQaMarkdownDownload(params: {
  notebookId: number;
  sessionId: number;
  messageId?: number | null;
}) {
  const query = new URLSearchParams();
  query.set('session_id', String(params.sessionId));
  if (params.messageId) {
    query.set('message_id', String(params.messageId));
  }
  query.set('format', 'markdown');
  // Note: v2 server doesn't have /qa/export yet — fallback to raw download
  openDownloadUrl(`${BASE_URL}/v2/qa/export?${query.toString()}`);
}

/**
 * Download QA export as JSON.
 */
export async function exportQaJsonDownload(params: {
  notebookId: number;
  sessionId: number;
  messageId?: number | null;
}) {
  const query = new URLSearchParams({
    session_id: String(params.sessionId),
    format: 'json',
  });
  if (params.messageId) {
    query.set('message_id', String(params.messageId));
  }
  const url = `${BASE_URL}/v2/qa/export?${query.toString()}`;
  const response = await fetch(url);
  const data = await response.json();
  const filename = `qa-session-${(data as Record<string, unknown>).session_id}-message-${(data as Record<string, unknown>).message_id}.json`;
  downloadTextAsFile(filename, JSON.stringify(data, null, 2), 'application/json');
  toast.success('已导出 QA JSON');
}

/**
 * Download Output export as Markdown.
 * v2 equivalent: GET /v2/outputs/:id/export?format=markdown
 */
export function exportOutputMarkdownDownload(params: { notebookId: number; outputId: number }) {
  const query = new URLSearchParams();
  query.set('format', 'markdown');
  openDownloadUrl(`${BASE_URL}/v2/outputs/${params.outputId}/export?${query.toString()}`);
}

/**
 * Download Output export as JSON.
 */
export async function exportOutputJsonDownload(params: { notebookId: number; outputId: number }) {
  const url = `${BASE_URL}/v2/outputs/${params.outputId}/export?format=json`;
  const response = await fetch(url);
  const data = await response.json();
  const filename = `output-${(data as Record<string, unknown>).output_id}-${(data as Record<string, unknown>).output_type}.json`;
  downloadTextAsFile(filename, JSON.stringify(data, null, 2), 'application/json');
  toast.success('已导出 Output JSON');
}
