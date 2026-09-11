import { resolveApiBaseUrl } from '../../../api/apiEnv';
import { toast } from '../../../shared/toast';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser: use same origin (dev-server proxy handles forwarding)
    return window.location.origin;
  }
  return resolveApiBaseUrl();
}

const BASE_URL = getBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
 * GET /v2/notebooks/:nid/qa/export?sessionId=...&messageId=...&format=markdown
 */
export function exportQaMarkdownDownload(params: {
  notebookId: number;
  sessionId: number;
  messageId?: number | null;
}) {
  const query = new URLSearchParams();
  query.set('sessionId', String(params.sessionId));
  if (params.messageId) {
    query.set('messageId', String(params.messageId));
  }
  query.set('format', 'markdown');
  openDownloadUrl(`${BASE_URL}/v2/notebooks/${params.notebookId}/qa/export?${query.toString()}`);
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
    sessionId: String(params.sessionId),
    format: 'json',
  });
  if (params.messageId) {
    query.set('messageId', String(params.messageId));
  }
  const url = `${BASE_URL}/v2/notebooks/${params.notebookId}/qa/export?${query.toString()}`;
  const response = await fetch(url);
  const raw: unknown = await response.json();
  const sessionId =
    isRecord(raw) && typeof raw.sessionId === 'number' ? raw.sessionId : params.sessionId;
  const messageId =
    isRecord(raw) && typeof raw.messageId === 'number' ? raw.messageId : (params.messageId ?? 0);
  const filename = `qa-session-${sessionId}-message-${messageId}.json`;
  downloadTextAsFile(filename, JSON.stringify(raw, null, 2), 'application/json');
  toast.success('已导出 QA JSON');
}

/**
 * Download Output export as Markdown.
 * GET /v2/notebooks/:nid/outputs/:id/export?format=markdown
 */
export function exportOutputMarkdownDownload(params: { notebookId: number; outputId: number }) {
  const query = new URLSearchParams();
  query.set('format', 'markdown');
  openDownloadUrl(
    `${BASE_URL}/v2/notebooks/${params.notebookId}/outputs/${params.outputId}/export?${query.toString()}`,
  );
}

/**
 * Download Output export as JSON.
 */
export async function exportOutputJsonDownload(params: { notebookId: number; outputId: number }) {
  const query = new URLSearchParams({
    format: 'json',
  });
  const url = `${BASE_URL}/v2/notebooks/${params.notebookId}/outputs/${params.outputId}/export?${query.toString()}`;
  const response = await fetch(url);
  const raw: unknown = await response.json();
  const outputId =
    isRecord(raw) && typeof raw.outputId === 'number' ? raw.outputId : params.outputId;
  const outputType =
    isRecord(raw) && typeof raw.outputType === 'string' ? raw.outputType : 'output';
  const filename = `output-${outputId}-${outputType}.json`;
  downloadTextAsFile(filename, JSON.stringify(raw, null, 2), 'application/json');
  toast.success('已导出 Output JSON');
}
