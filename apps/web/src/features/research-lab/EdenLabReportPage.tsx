import type { ResearchReport, ResearchRun } from '@crystalith/shared';
/**
 * Eden Lab report surface — ResearchRun.report is SSOT (c85).
 * Fixture CoW / revisions remain on LabReportPage fixture branch (c89).
 */
import { ArrowBack as ArrowBackIcon, Science as ScienceIcon } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import CitationsControl from '../workspace/shared/components/citations/CitationsControl';
import { getResearchRun } from './edenResearchApi';
import { navigateToResearchLab } from './labRouting';
import { adaptResearchCitationsToUi } from './researchCitationsAdapter';

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; run: ResearchRun };

function CiteMarks({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 text-[11px] font-medium text-blue-600/80">
      {ids.map((id) => `[${id}]`).join('')}
    </span>
  );
}

function EdenReportBody({ report }: { report: ResearchReport }) {
  return (
    <article className="mx-auto max-w-3xl px-10 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">{report.title}</h1>
      {report.sections.map((section) => (
        <section key={section.id} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{section.heading}</h2>
          {section.blocks.map((block, i) => {
            if (block.type === 'paragraph') {
              return (
                <p key={i} className="mb-3 text-[14.5px] leading-[1.75] text-gray-800">
                  {block.text}
                  <CiteMarks ids={block.citeIds} />
                </p>
              );
            }
            return (
              <ul
                key={i}
                className="mb-3 list-disc space-y-1.5 pl-5 text-[14.5px] leading-[1.75] text-gray-800"
              >
                {block.items.map((item, j) => (
                  <li key={j}>
                    {item.text}
                    <CiteMarks ids={item.citeIds} />
                  </li>
                ))}
              </ul>
            );
          })}
        </section>
      ))}
    </article>
  );
}

export default function EdenLabReportPage({
  notebookId,
  runId,
}: {
  notebookId: number;
  runId: number | null;
}) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    if (runId === null || runId === undefined || !Number.isFinite(runId) || runId <= 0) {
      setState({ status: 'error', message: '缺少 ?rid=，请从作业台打开报告' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const run = await getResearchRun(notebookId, runId);
        if (cancelled) return;
        setState({ status: 'ready', run });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notebookId, runId]);

  const report = state.status === 'ready' ? (state.run.report ?? null) : null;
  const uiCitations = useMemo(
    () => adaptResearchCitationsToUi(report?.citations),
    [report?.citations],
  );

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--cl-bg)] text-gray-900"
      {...tid(TestIds.researchLabReportPage)}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => navigateToResearchLab(notebookId, runId)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          {...tid(TestIds.researchLabBack)}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          返回图谱
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-100 bg-blue-50 text-blue-700 shadow-sm">
            <ScienceIcon sx={{ fontSize: 16 }} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">研究报告</div>
            <div className="truncate text-[11px] text-gray-500">
              #{notebookId}
              {runId ? ` · Run #${runId}` : ''}
              {report ? ` · ${report.title}` : ''}
            </div>
          </div>
        </div>
        {uiCitations.length > 0 ? (
          <CitationsControl citations={uiCitations} elevated triggerLabel="查看报告引用" />
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" {...tid(TestIds.researchLabReport)}>
        {state.status === 'loading' || state.status === 'idle' ? (
          <div className="px-10 py-16 text-center text-sm text-gray-500">加载报告中…</div>
        ) : null}
        {state.status === 'error' ? (
          <div className="mx-auto max-w-lg px-10 py-16 text-center">
            <p className="text-sm text-red-700">{state.message}</p>
            <button
              type="button"
              className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => navigateToResearchLab(notebookId, runId)}
            >
              返回作业台
            </button>
          </div>
        ) : null}
        {state.status === 'ready' && !report ? (
          <div className="mx-auto max-w-lg px-10 py-16 text-center">
            <p className="text-sm text-gray-600">当前 Run 尚无报告。请先完成研究并生成报告。</p>
            <button
              type="button"
              className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => navigateToResearchLab(notebookId, runId)}
            >
              返回作业台
            </button>
          </div>
        ) : null}
        {state.status === 'ready' && report ? <EdenReportBody report={report} /> : null}
      </div>
    </div>
  );
}
