import type { ResearchReport, ResearchRun } from '@crystalith/shared';
import { Typography } from '@material-tailwind/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { t } from '../../../../shared/i18n';
import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import CitationsControl from '../../shared/components/citations/CitationsControl';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';
import NodeInspector from './NodeInspector';
import { citationsFromReport } from './researchCitationAdapter';
import { isProcessResearchStatus, isTerminalResearchStatus } from './researchCreateGate';
import ResearchGraph from './ResearchGraph';
import { useResearchRunDetail } from './useResearchRunDetail';

export type PrimarySurface = 'graph' | 'report' | 'status';

export function resolvePrimarySurface(status: ResearchRun['status']): PrimarySurface {
  if (isProcessResearchStatus(status)) return 'graph';
  if (status === 'completed') return 'report';
  return 'status';
}

function ReportBlocks({ report }: { report: ResearchReport }) {
  const citations = useMemo(() => citationsFromReport(report), [report]);
  return (
    <div className="flex flex-col gap-4" {...tid(TestIds.researchReportSurface)}>
      <div className="flex items-center justify-between gap-2">
        <Typography variant="h6" className="text-base font-semibold">
          {report.title}
        </Typography>
        <CitationsControl citations={citations} elevated />
      </div>
      {report.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
            {section.heading}
          </h3>
          {section.blocks.map((block, idx) => {
            if (block.type === 'paragraph') {
              return (
                <p
                  key={idx}
                  className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap"
                >
                  {block.text}
                </p>
              );
            }
            return (
              <ul key={idx} className="list-disc pl-5 text-sm text-gray-700 dark:text-slate-200">
                {block.items.map((item, i) => (
                  <li key={i}>{item.text}</li>
                ))}
              </ul>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export interface DeepResearchRunDetailProps {
  open: boolean;
  notebookId: number | undefined;
  runId: number | null;
  onClose: () => void;
  onRunUpdated?: () => void;
}

export default function DeepResearchRunDetail({
  open,
  notebookId,
  runId,
  onClose,
  onRunUpdated,
}: DeepResearchRunDetailProps) {
  const { style: modalStyle } = useLayer('modal');
  const modalRef = useRef<HTMLDivElement>(null!);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftExpanded, setDraftExpanded] = useState(false);
  const [showGraphSecondary, setShowGraphSecondary] = useState(false);

  const {
    run,
    isLoading,
    error,
    busy,
    confirm,
    cancel,
    prune,
    fork,
    convertToNote,
    convertToSource,
  } = useResearchRunDetail({ notebookId, runId, open, onRunUpdated });

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: onClose,
  });

  // Capture Escape so E1 popover does not also close (G1 / #4).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSelectedNodeId(null);
      setDraftExpanded(false);
      setShowGraphSecondary(false);
    }
  }, [open]);

  if (!open || runId == null) return null;

  const primary = run ? resolvePrimarySurface(run.status) : 'graph';
  const readOnly = run ? isTerminalResearchStatus(run.status) : true;
  const selectedNode = run?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const highlightNodeId = run?.confirmBranchNodeId ?? null;

  const content = (
    <div
      className="fixed inset-0"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label={t('research.detail.aria')}
      {...tid(TestIds.researchRunDetail)}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="absolute top-1/2 left-1/2 z-10 flex h-[min(720px,85vh)] w-[min(1100px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-700 px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate text-gray-900 dark:text-slate-100">
              {run?.topic ?? t('common.loading')}
            </div>
            <div className="text-[11px] text-gray-500">
              {run ? t(`research.status.${run.status}` as 'research.status.queued') : null}
              {run ? ` · ${run.searchesUsed}/${run.maxSearches}` : null}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {run && !isTerminalResearchStatus(run.status) ? (
              <button
                type="button"
                className="h-8 px-3 rounded-lg text-xs bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                disabled={busy}
                onClick={() => void cancel()}
              >
                {t('research.action.cancel')}
              </button>
            ) : null}
            {run?.report ? (
              <>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void convertToNote({ kind: 'report' })}
                >
                  {t('research.convert.to_note')}
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void convertToSource({ kind: 'report' })}
                >
                  {t('research.convert.to_source')}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {run?.status === 'awaiting_confirm' ? (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2"
            {...tid(TestIds.researchM1ConfirmBar)}
          >
            <span className="text-xs text-amber-900 font-medium">
              {run.confirmKind === 'expand_branch'
                ? t('research.m1.expand_branch')
                : t('research.m1.budget')}
            </span>
            <button
              type="button"
              className="h-7 px-2.5 rounded text-xs bg-white border border-amber-300"
              disabled={busy}
              onClick={() => void confirm({ action: 'continue' })}
            >
              {t('research.m1.continue')}
            </button>
            <button
              type="button"
              className="h-7 px-2.5 rounded text-xs bg-indigo-600 text-white"
              disabled={busy}
              onClick={() => void confirm({ action: 'finish_report' })}
            >
              {t('research.m1.finish_report')}
            </button>
            {run.confirmKind === 'expand_branch' && run.confirmBranchNodeId ? (
              <>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded text-xs bg-white border border-amber-300"
                  disabled={busy}
                  onClick={() =>
                    void confirm({
                      action: 'approve_branch',
                      branchNodeId: run.confirmBranchNodeId!,
                    })
                  }
                >
                  {t('research.m1.approve_branch')}
                </button>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded text-xs bg-white border border-amber-300"
                  disabled={busy}
                  onClick={() =>
                    void confirm({
                      action: 'skip_branch',
                      branchNodeId: run.confirmBranchNodeId!,
                    })
                  }
                >
                  {t('research.m1.skip_branch')}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
            {error}
          </div>
        ) : null}

        <div className="flex-1 min-h-0 flex">
          {isLoading && !run ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              {t('common.loading')}
            </div>
          ) : null}

          {run && primary === 'graph' ? (
            <>
              <div className="flex-1 min-w-0 relative">
                <ResearchGraph
                  nodes={run.nodes}
                  edges={run.edges}
                  selectedNodeId={selectedNodeId}
                  highlightNodeId={highlightNodeId}
                  readOnly={readOnly}
                  onSelectNode={setSelectedNodeId}
                />
                {run.report ? (
                  <div className="absolute bottom-0 inset-x-0 border-t border-gray-200 bg-white/95 dark:bg-slate-900/95">
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => setDraftExpanded((v) => !v)}
                    >
                      {draftExpanded
                        ? t('research.detail.collapse_draft')
                        : t('research.detail.expand_draft')}
                    </button>
                    {draftExpanded ? (
                      <div className="max-h-40 overflow-y-auto px-3 pb-3">
                        <ReportBlocks report={run.report} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <NodeInspector
                node={selectedNode}
                readOnly={readOnly}
                busy={busy}
                onClose={() => setSelectedNodeId(null)}
                onPrune={(id) => void prune(id)}
                onFork={(id, hint) => void fork(id, hint)}
                onConvertNote={(id) => void convertToNote({ kind: 'node', nodeId: id })}
                onConvertSource={(id) => void convertToSource({ kind: 'node', nodeId: id })}
              />
            </>
          ) : null}

          {run && primary === 'report' ? (
            <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-3">
              {run.report ? (
                <ReportBlocks report={run.report} />
              ) : (
                <p className="text-sm text-gray-500">{t('research.detail.no_report')}</p>
              )}
              <button
                type="button"
                className="self-start text-xs text-indigo-600 hover:underline"
                onClick={() => setShowGraphSecondary((v) => !v)}
              >
                {showGraphSecondary
                  ? t('research.detail.hide_graph')
                  : t('research.detail.show_graph_readonly')}
              </button>
              {showGraphSecondary ? (
                <div className="h-64 border border-gray-200 rounded-lg overflow-hidden">
                  <ResearchGraph
                    nodes={run.nodes}
                    edges={run.edges}
                    selectedNodeId={selectedNodeId}
                    readOnly
                    onSelectNode={setSelectedNodeId}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {run && primary === 'status' ? (
            <div className="flex-1 p-6 flex flex-col gap-3 overflow-y-auto">
              <Typography className="text-sm text-gray-800 dark:text-slate-100">
                {t(`research.status.${run.status}` as 'research.status.failed')}
              </Typography>
              {run.errorMessage ? (
                <p className="text-xs text-red-600 whitespace-pre-wrap">{run.errorMessage}</p>
              ) : null}
              {run.report ? <ReportBlocks report={run.report} /> : null}
              {run.nodes.length > 0 ? (
                <div className="h-56 border border-gray-200 rounded-lg overflow-hidden mt-2">
                  <ResearchGraph
                    nodes={run.nodes}
                    edges={run.edges}
                    selectedNodeId={selectedNodeId}
                    readOnly
                    onSelectNode={setSelectedNodeId}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
