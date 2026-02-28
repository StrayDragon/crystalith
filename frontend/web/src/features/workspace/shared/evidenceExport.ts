import {
  exportOutputV1NotebooksNotebookIdOutputsOutputIdExportGet as exportOutput,
  exportQaV1NotebooksNotebookIdQaExportGet as exportQa,
} from '../../../api/generated';
import { unwrapData } from '../../../api/unwrap';
import { toast } from '../../../shared/toast';

function downloadTextAsFile(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openDownloadUrl(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

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
  openDownloadUrl(`/v1/notebooks/${params.notebookId}/qa/export?${query.toString()}`);
}

export async function exportQaJsonDownload(params: {
  notebookId: number;
  sessionId: number;
  messageId?: number | null;
}) {
  const response = await unwrapData(
    exportQa<true>({
      path: { notebook_id: params.notebookId },
      query: {
        session_id: params.sessionId,
        message_id: params.messageId ?? undefined,
        format: 'json',
      },
    }),
  );
  const filename = `qa-session-${response.session_id}-message-${response.message_id}.json`;
  downloadTextAsFile(filename, JSON.stringify(response, null, 2), 'application/json');
  toast.success('已导出 QA JSON');
}

export function exportOutputMarkdownDownload(params: {
  notebookId: number;
  outputId: number;
}) {
  const query = new URLSearchParams();
  query.set('format', 'markdown');
  openDownloadUrl(`/v1/notebooks/${params.notebookId}/outputs/${params.outputId}/export?${query.toString()}`);
}

export async function exportOutputJsonDownload(params: {
  notebookId: number;
  outputId: number;
}) {
  const response = await unwrapData(
    exportOutput<true>({
      path: { notebook_id: params.notebookId, output_id: params.outputId },
      query: { format: 'json' },
    }),
  );
  const filename = `output-${response.output_id}-${response.output_type}.json`;
  downloadTextAsFile(filename, JSON.stringify(response, null, 2), 'application/json');
  toast.success('已导出 Output JSON');
}
