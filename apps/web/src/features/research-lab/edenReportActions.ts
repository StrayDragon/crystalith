import type { ResearchReport } from '@crystalith/shared';

import { researchReportToMarkdown } from './researchReportToMarkdown';

export type EdenOpenReportResult =
  | { ok: true; notebookId: number; runId: number }
  | { ok: false; error: string };

/** Resolve navigation target for Eden openReport (r430). */
export function resolveEdenOpenReport(
  notebookId: number,
  runId: number | null | undefined,
): EdenOpenReportResult {
  if (runId === null || runId === undefined || !Number.isFinite(runId) || runId <= 0) {
    return { ok: false, error: '缺少有效的 ResearchRun id，无法打开报告' };
  }
  return { ok: true, notebookId, runId };
}

export type EdenExportResult =
  | { ok: true; markdown: string; title: string }
  | { ok: false; error: string };

/** Resolve markdown export from Run report SSOT (r433). */
export function resolveEdenExportFromReport(
  report: ResearchReport | null | undefined,
): EdenExportResult {
  if (!report) {
    return { ok: false, error: '当前 Run 尚无报告，无法导出' };
  }
  return {
    ok: true,
    markdown: researchReportToMarkdown(report),
    title: report.title,
  };
}

export function downloadResearchReportMarkdown(markdown: string, title: string): void {
  const safe = title.replaceAll(/[^\w\u4E00-\u9FFF-]+/gu, '_').slice(0, 80) || 'research-report';
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safe}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
