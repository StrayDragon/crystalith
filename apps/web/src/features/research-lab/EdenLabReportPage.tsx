/**
 * Eden Lab report surface — ResearchRun revisions / CoW / convert (c85 + c89).
 * Fixture CoW / revisions remain on LabReportPage fixture branch only.
 */
import type {
  ResearchReport,
  ResearchReportView,
  ResearchRevision,
  ResearchRun,
} from '@crystalith/shared';
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  NoteAlt as NoteAltIcon,
  Save as SaveIcon,
  Science as ScienceIcon,
  Source as SourceIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { toast } from '../../shared/toast';
import CitationsControl from '../workspace/shared/components/citations/CitationsControl';
import { runConvertToNote, runConvertToSource } from './edenConvertActions';
import {
  createResearchRevision,
  discardResearchWorkingReport,
  getResearchReportView,
  getResearchRun,
  listResearchRevisions,
  putResearchCanonicalReport,
  putResearchWorkingReport,
  restoreResearchRevision,
} from './edenResearchApi';
import { researchCitationToLabCitation } from './evidenceAdapter';
import LabReportPlateEditor from './LabReportPlateEditor';
import { navigateToResearchLab } from './labRouting';
import { markLabRunNeedsReload } from './labRunReloadGate';
import { markdownToResearchReport } from './markdownToResearchReport';
import { adaptResearchCitationsToUi } from './researchCitationsAdapter';
import { researchReportToMarkdown } from './researchReportToMarkdown';

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; run: ResearchRun; view: ResearchReportView };

type ViewSource = 'canonical' | 'working';

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

function activeReport(view: ResearchReportView, viewing: ViewSource): ResearchReport | null {
  if (viewing === 'working' && view.working) return view.working;
  return view.canonical ?? view.working ?? null;
}

export default function EdenLabReportPage({
  notebookId,
  runId,
}: {
  notebookId: number;
  runId: number | null;
}) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [revisions, setRevisions] = useState<ResearchRevision[]>([]);
  const [activeRevId, setActiveRevId] = useState<string>('');
  const [viewing, setViewing] = useState<ViewSource>('canonical');
  const [editing, setEditing] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [draftMarkdown, setDraftMarkdown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const reload = async (rid: number) => {
    const [run, view, revList] = await Promise.all([
      getResearchRun(notebookId, rid),
      getResearchReportView(notebookId, rid),
      listResearchRevisions(notebookId, rid),
    ]);
    setState({ status: 'ready', run, view });
    setRevisions(revList.items);
    setActiveRevId(revList.items[0]?.id ?? '');
    setViewing(view.working ? 'working' : 'canonical');
    setEditing(false);
    setDraftMarkdown(null);
    setEditorEpoch((n) => n + 1);
  };

  useEffect(() => {
    if (runId === null || runId === undefined || !Number.isFinite(runId) || runId <= 0) {
      setState({ status: 'error', message: '缺少 ?rid=，请从作业台打开报告' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        await reload(runId);
        if (cancelled) return;
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on notebook/run only
  }, [notebookId, runId]);

  const view = state.status === 'ready' ? state.view : null;
  const report = view ? activeReport(view, viewing) : null;
  const hasWorking = Boolean(view?.working);
  const uiCitations = useMemo(
    () => adaptResearchCitationsToUi(report?.citations),
    [report?.citations],
  );
  const labCitations = useMemo(() => {
    const map: Record<string, ReturnType<typeof researchCitationToLabCitation>> = {};
    if (!report?.citations) return map;
    for (const [id, c] of Object.entries(report.citations)) {
      map[id] = researchCitationToLabCitation(id, c);
    }
    return map;
  }, [report?.citations]);

  const displayMarkdown = useMemo(() => {
    if (draftMarkdown !== null) return draftMarkdown;
    if (!report) return '';
    return researchReportToMarkdown(report);
  }, [draftMarkdown, report]);

  const documentKey = `eden-report-${runId}-${activeRevId}-${editorEpoch}-${editing ? 'edit' : 'view'}`;

  const withBusy = async (fn: () => Promise<void>) => {
    if (busy || runId === null || !runId) return;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message, 5000);
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () =>
    void withBusy(async () => {
      if (!view || !runId) return;
      const base = view.canonical ?? view.working;
      if (!base) {
        toast.error('当前无报告可编辑');
        return;
      }
      if (!view.working) {
        const next = await putResearchWorkingReport(notebookId, runId, base);
        setState((prev) => (prev.status === 'ready' ? { ...prev, view: next } : prev));
        toast.info('已创建编辑副本（working）', 2200);
      }
      setViewing('working');
      setEditing(true);
      setDraftMarkdown(null);
      setEditorEpoch((n) => n + 1);
    });

  const finishEditing = () =>
    void withBusy(async () => {
      if (!view || !runId || draftMarkdown === null) {
        setEditing(false);
        return;
      }
      const base = view.working ?? view.canonical;
      const reportBody = markdownToResearchReport(draftMarkdown, base);
      const next = await putResearchWorkingReport(notebookId, runId, reportBody);
      setState((prev) => (prev.status === 'ready' ? { ...prev, view: next } : prev));
      setEditing(false);
      setViewing('working');
      setDraftMarkdown(null);
      setEditorEpoch((n) => n + 1);
      toast.success('已保存编辑副本', 2200);
    });

  const commitCanonical = () =>
    void withBusy(async () => {
      if (!view?.working || !runId) {
        toast.error('没有可提交的编辑副本');
        return;
      }
      let working = view.working;
      if (draftMarkdown !== null) {
        working = markdownToResearchReport(draftMarkdown, working);
      }
      await putResearchCanonicalReport(notebookId, runId, working);
      const next = await discardResearchWorkingReport(notebookId, runId);
      const run = await getResearchRun(notebookId, runId);
      setState({ status: 'ready', run, view: next });
      setEditing(false);
      setViewing('canonical');
      setDraftMarkdown(null);
      setEditorEpoch((n) => n + 1);
      toast.success('已提交权威报告', 2800);
    });

  const discardWorking = () =>
    void withBusy(async () => {
      if (!runId || !hasWorking) return;
      if (!window.confirm('丢弃编辑副本并恢复权威报告？此操作不可撤销。')) return;
      const next = await discardResearchWorkingReport(notebookId, runId);
      setState((prev) => (prev.status === 'ready' ? { ...prev, view: next } : prev));
      setEditing(false);
      setViewing('canonical');
      setDraftMarkdown(null);
      setEditorEpoch((n) => n + 1);
      toast.success('已丢弃编辑副本', 2200);
    });

  const saveRevision = () =>
    void withBusy(async () => {
      if (!runId) return;
      if (editing && draftMarkdown !== null && view) {
        const base = view.working ?? view.canonical;
        await putResearchWorkingReport(
          notebookId,
          runId,
          markdownToResearchReport(draftMarkdown, base),
        );
      }
      const from = hasWorking || viewing === 'working' ? 'working' : 'canonical';
      const rev = await createResearchRevision(notebookId, runId, { from });
      const list = await listResearchRevisions(notebookId, runId);
      setRevisions(list.items);
      setActiveRevId(rev.id);
      toast.success(`已保存版本「${rev.label}」`, 3200);
    });

  const restoreRevision = (revId: string) => {
    if (busy || !runId || !revId) return;
    setBusy(true);
    setActionError('');
    void (async () => {
      try {
        await restoreResearchRevision(notebookId, runId, revId);
        // J1=A: always full GET after restore (do not trust POST body alone)
        const [run, viewNext, list] = await Promise.all([
          getResearchRun(notebookId, runId),
          getResearchReportView(notebookId, runId),
          listResearchRevisions(notebookId, runId),
        ]);
        markLabRunNeedsReload(notebookId, runId);
        setState({ status: 'ready', run, view: viewNext });
        setRevisions(list.items);
        setActiveRevId(revId);
        setEditing(false);
        setViewing('canonical');
        setDraftMarkdown(null);
        setEditorEpoch((n) => n + 1);
        toast.success('已恢复版本；返回图谱将重载思考图', 3600);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setActionError(message);
      } finally {
        setBusy(false);
      }
    })();
  };

  const convertNote = () =>
    void withBusy(async () => {
      if (!runId) return;
      await runConvertToNote(notebookId, runId, { kind: 'report' });
    });

  const convertSource = () =>
    void withBusy(async () => {
      if (!runId) return;
      await runConvertToSource(notebookId, runId, { kind: 'report' });
    });

  const modeBadge = editing
    ? '编辑中'
    : viewing === 'working' && hasWorking
      ? '编辑副本 · 浏览'
      : '权威 · 浏览';

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
            <div className="flex items-center gap-2 truncate text-sm font-semibold">
              研究报告
              {state.status === 'ready' && report ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    editing
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                      : viewing === 'working' && hasWorking
                        ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-100'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {modeBadge}
                </span>
              ) : null}
            </div>
            <div className="truncate text-[11px] text-gray-500">
              #{notebookId}
              {runId ? ` · Run #${runId}` : ''}
              {report ? ` · ${report.title}` : ''}
              {hasWorking ? ' · 未提交编辑副本' : ''}
            </div>
          </div>
        </div>

        {state.status === 'ready' && report ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <select
              className="max-w-[160px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700"
              value={activeRevId}
              disabled={busy || revisions.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                setActiveRevId(id);
                void restoreRevision(id);
              }}
              title={busy ? '正在恢复修订…' : '选择并恢复服务端修订快照'}
              {...tid(TestIds.researchLabRevisionSelect)}
            >
              {revisions.length === 0 ? (
                <option value="">暂无版本</option>
              ) : (
                revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.kind === 'auto_complete' ? ' · 自动' : ''}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              disabled={busy}
              onClick={() => void saveRevision()}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-900 hover:bg-blue-100 disabled:opacity-40"
              title="创建当前快照（服务端 revisions）"
              {...tid(TestIds.researchLabRevisionSave)}
            >
              <SaveIcon sx={{ fontSize: 14 }} />
              保存版本
            </button>

            {editing ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishEditing()}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                {...tid(TestIds.researchLabReportDoneEdit)}
              >
                <CheckIcon sx={{ fontSize: 14 }} />
                完成编辑
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startEditing()}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                title="编辑报告（服务端 working CoW）"
                {...tid(TestIds.researchLabReportEdit)}
              >
                <EditIcon sx={{ fontSize: 14 }} />
                编辑
              </button>
            )}

            {!editing && viewing === 'working' && hasWorking ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setViewing('canonical');
                  setDraftMarkdown(null);
                  setEditorEpoch((n) => n + 1);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                {...tid(TestIds.researchLabReportViewCanonical)}
              >
                查看权威原文
              </button>
            ) : null}
            {!editing && viewing === 'canonical' && hasWorking ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setViewing('working');
                  setDraftMarkdown(null);
                  setEditorEpoch((n) => n + 1);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 hover:bg-blue-100"
              >
                浏览编辑副本
              </button>
            ) : null}
            {hasWorking ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void commitCanonical()}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                >
                  提交权威
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void discardWorking()}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  {...tid(TestIds.researchLabReportDiscard)}
                >
                  <UndoIcon sx={{ fontSize: 14 }} />
                  丢弃编辑
                </button>
              </>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => void convertSource()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <SourceIcon sx={{ fontSize: 14 }} />
              转为来源
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void convertNote()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <NoteAltIcon sx={{ fontSize: 14 }} />
              转为笔记
            </button>

            {uiCitations.length > 0 && !editing ? (
              <CitationsControl citations={uiCitations} elevated triggerLabel="查看报告引用" />
            ) : null}
          </div>
        ) : uiCitations.length > 0 ? (
          <CitationsControl citations={uiCitations} elevated triggerLabel="查看报告引用" />
        ) : null}
      </header>

      {actionError ? (
        <div
          className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          role="alert"
        >
          恢复修订失败：{actionError}
        </div>
      ) : null}

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
        {state.status === 'ready' && report && editing ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-0 px-10 pt-3">
              <div className="mx-auto max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                编辑副本经 PUT …/report/working 持久化；「提交权威」写入 PUT …/report。
              </div>
            </div>
            <LabReportPlateEditor
              documentKey={documentKey}
              markdown={displayMarkdown}
              citations={labCitations}
              orphanIds={new Set()}
              showCitations={false}
              readOnly={false}
              onMarkdownChange={(md) => setDraftMarkdown(md)}
            />
          </div>
        ) : null}
        {state.status === 'ready' && report && !editing ? <EdenReportBody report={report} /> : null}
      </div>
    </div>
  );
}
