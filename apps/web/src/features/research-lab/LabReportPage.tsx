/**
 * Lab report surface (MOCK revisions in sessionStorage).
 *
 * Real: Run report SSOT + convertToNote/Source; cite locate → graph_patch selection.
 * Block anchors `[^@nodeId]` are Lab demo — promote to shared report schema when wiring.
 */
import {
  ArrowBack as ArrowBackIcon,
  AccountTree as AccountTreeIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  FormatQuote as FormatQuoteIcon,
  NoteAlt as NoteAltIcon,
  Save as SaveIcon,
  Science as ScienceIcon,
  Source as SourceIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import { useMemo, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { toast } from '../../shared/toast';
import { deriveLabState } from './fake/deriveLabState';
import { findNodesByCitation, pickPreferredCiteNode } from './fake/findNodesByCitation';
import {
  ensureDefaultRevision,
  getActiveRevision,
  graphSliceFromSession,
  listRevisions,
  saveNewRevision,
  setActiveRevision,
  type LabRevision,
} from './fake/labRevisions';
import {
  activeReportMarkdown,
  applyReportEdit,
  buildCanonical,
  clearWorkingCopy,
  orphanCitationIds,
  persistWorkingCopy,
  readWorkingCopy,
  type ReportViewSource,
  type ReportWorkingCopy,
} from './fake/reportCow';
import { extractCitationIds } from './fake/reportDocument';
import { resolveDefaultExportMarkdown } from './fake/resolveDefaultExportMarkdown';
import { getLabScenario } from './fake/scenarios';
import LabReportPlateEditor from './LabReportPlateEditor';
import { navigateToResearchLab, readPersistedLabScenarioId } from './labRouting';
import { persistLabSessionSnapshot, readLabSessionSnapshot } from './labSession';

function bootstrapRevisions(notebookId: number, scenarioId: string): LabRevision {
  const scenario = getLabScenario(scenarioId);
  const session = readLabSessionSnapshot();
  const derived = deriveLabState(scenario, session?.phase ?? 'completed', {
    forceStatus: session?.forceStatus ?? null,
    metricsOverride: session?.metricsOverride ?? null,
    mutations: session?.mutations ?? undefined,
  });
  const markdown = resolveDefaultExportMarkdown({
    scenario,
    nodes: derived.nodes,
    mutations: session?.mutations ?? {
      prunedNodeIds: [],
      extraNodes: [],
      extraEdges: [],
      nodeEdits: {},
      activityNotes: [],
    },
    edges: derived.edges,
  });
  const graph = session
    ? graphSliceFromSession(session)
    : {
        phase: 'completed' as const,
        mutations: {
          prunedNodeIds: [],
          extraNodes: [],
          extraEdges: [],
          nodeEdits: {},
          activityNotes: [],
        },
        topicDraft: scenario.topic,
        forkSeq: 0,
        forceStatus: null,
      };
  return ensureDefaultRevision({
    notebookId,
    scenarioId,
    reportMarkdown: markdown,
    graph,
  });
}

export default function LabReportPage({ notebookId }: { notebookId: number }) {
  const scenarioId = readPersistedLabScenarioId();
  const scenario = useMemo(() => getLabScenario(scenarioId), [scenarioId]);

  const [revisions, setRevisions] = useState<LabRevision[]>(() => {
    bootstrapRevisions(notebookId, scenarioId);
    return listRevisions(notebookId, scenarioId);
  });
  const [activeRevId, setActiveRevId] = useState<string>(() => {
    bootstrapRevisions(notebookId, scenarioId);
    return getActiveRevision(notebookId, scenarioId)?.id ?? '';
  });

  const activeRev = revisions.find((r) => r.id === activeRevId) ?? revisions[0] ?? null;

  const canonical = useMemo(
    () =>
      buildCanonical({
        scenarioId,
        notebookId,
        markdown: activeRev?.reportMarkdown ?? scenario.reportMarkdown,
        producedAt: activeRev?.createdAt ?? '2026-01-01T00:00:00.000Z',
      }),
    [
      activeRev?.reportMarkdown,
      activeRev?.createdAt,
      scenario.reportMarkdown,
      scenarioId,
      notebookId,
    ],
  );

  const [working, setWorking] = useState<ReportWorkingCopy | null>(() =>
    readWorkingCopy(notebookId, scenarioId),
  );
  // Always land on this round's canonical report. Working copy is opt-in via toolbar.
  const [viewing, setViewing] = useState<ReportViewSource>('canonical');
  const [editing, setEditing] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [showCitations, setShowCitations] = useState(true);

  const activeMarkdown = activeReportMarkdown(canonical, working, viewing);
  const documentKey = `report-doc-${activeRevId}-${editorEpoch}-${editing ? 'edit' : 'view'}`;

  const orphanIds = useMemo(
    () => new Set(orphanCitationIds(canonical.markdown, activeMarkdown)),
    [canonical.markdown, activeMarkdown],
  );

  const refreshRevisions = () => {
    setRevisions(listRevisions(notebookId, scenarioId));
    setActiveRevId(getActiveRevision(notebookId, scenarioId)?.id ?? '');
  };

  const handleMarkdownChange = (nextMarkdown: string) => {
    if (!editing) return;
    const current = activeReportMarkdown(canonical, working, 'working');
    if (nextMarkdown === current) return;
    const result = applyReportEdit({
      canonical,
      working,
      nextMarkdown,
    });
    setWorking(result.working);
    persistWorkingCopy(result.working);
    if (result.forked) {
      toast.info('已创建编辑副本（本轮元报告保持不变）', 2800);
    }
  };

  const startEditing = () => {
    if (!working) {
      const result = applyReportEdit({
        canonical,
        working: null,
        nextMarkdown: canonical.markdown,
      });
      setWorking(result.working);
      persistWorkingCopy(result.working);
      toast.info('已创建编辑副本', 2200);
    }
    setViewing('working');
    setEditing(true);
    setEditorEpoch((n) => n + 1);
  };

  const finishEditing = () => {
    setEditing(false);
    setViewing('working');
    setEditorEpoch((n) => n + 1);
  };

  const viewCanonical = () => {
    setEditing(false);
    setViewing('canonical');
    setEditorEpoch((n) => n + 1);
  };

  const viewWorkingBrowse = () => {
    if (!working) return;
    setEditing(false);
    setViewing('working');
    setEditorEpoch((n) => n + 1);
  };

  const discardWorking = () => {
    if (!working) return;
    if (!window.confirm('丢弃编辑副本并恢复本轮报告？此操作不可撤销。')) return;
    clearWorkingCopy(notebookId, scenarioId);
    setWorking(null);
    setEditing(false);
    setViewing('canonical');
    setEditorEpoch((n) => n + 1);
    toast.success('已丢弃编辑副本', 2200);
  };

  const switchRevision = (id: string) => {
    const rev = setActiveRevision(notebookId, scenarioId, id);
    if (!rev) return;
    clearWorkingCopy(notebookId, scenarioId);
    setWorking(null);
    setActiveRevId(rev.id);
    setEditing(false);
    setViewing('canonical');
    setEditorEpoch((n) => n + 1);
    toast.info(`已切换到「${rev.label}」`, 2200);
  };

  const saveRevisionRound = () => {
    const session = readLabSessionSnapshot();
    if (!session) {
      toast.error('请先从图谱进入，以便绑定思考图快照');
      return;
    }
    const md = activeMarkdown;
    const rev = saveNewRevision({
      notebookId,
      scenarioId,
      reportMarkdown: md,
      graph: graphSliceFromSession(session),
      parentId: activeRevId || null,
    });
    clearWorkingCopy(notebookId, scenarioId);
    setWorking(null);
    refreshRevisions();
    setActiveRevId(rev.id);
    setViewing('canonical');
    setEditing(false);
    setEditorEpoch((n) => n + 1);
    toast.success(`已保存「${rev.label}」（图 + 报告）`, 3200);
  };

  const applyThinkingGraph = () => {
    const rev = getActiveRevision(notebookId, scenarioId);
    if (!rev) return;
    const session = readLabSessionSnapshot();
    const next = {
      scenarioId,
      phase: rev.graph.phase,
      playing: false,
      playbackMs: session?.playbackMs ?? 1400,
      layoutDirection: session?.layoutDirection ?? ('TB' as const),
      edgePathPreset: session?.edgePathPreset ?? ('smoothstep' as const),
      layoutAlgorithm: session?.layoutAlgorithm ?? ('layered' as const),
      selectedNodeId: null as string | null,
      highlightedNodeIds: [] as string[],
      consoleOpen: session?.consoleOpen ?? false,
      consoleVisible: session?.consoleVisible ?? true,
      forceStatus: rev.graph.forceStatus,
      metricsOverride: session?.metricsOverride ?? null,
      confirmChoice: null as string | null,
      mutations: rev.graph.mutations,
      topicDraft: rev.graph.topicDraft,
      forkSeq: rev.graph.forkSeq,
      useNotebookSources: session?.useNotebookSources ?? false,
      allowWeb: session?.allowWeb ?? true,
      selectedSourceIds: session?.selectedSourceIds ?? [],
    };
    persistLabSessionSnapshot(next);
    toast.success(`已套用「${rev.label}」的思考图`, 2600);
    navigateToResearchLab(notebookId);
  };

  /** Citation → graph: restore this revision's graph and select a node that used the cite. */
  const locateCitationOnGraph = (citationId: string) => {
    const rev = activeRev ?? getActiveRevision(notebookId, scenarioId);
    if (!rev) {
      toast.error('没有可定位的报告轮次');
      return;
    }
    const derived = deriveLabState(scenario, rev.graph.phase, {
      forceStatus: rev.graph.forceStatus,
      mutations: rev.graph.mutations,
    });
    const matches = findNodesByCitation(derived.nodes, citationId);
    const preferred = pickPreferredCiteNode(matches);
    if (!preferred) {
      toast.info('本轮思考图中没有使用该引用的节点', 3200);
      return;
    }
    const session = readLabSessionSnapshot();
    persistLabSessionSnapshot({
      scenarioId,
      phase: rev.graph.phase,
      playing: false,
      playbackMs: session?.playbackMs ?? 1400,
      layoutDirection: session?.layoutDirection ?? 'TB',
      edgePathPreset: session?.edgePathPreset ?? 'smoothstep',
      layoutAlgorithm: session?.layoutAlgorithm ?? 'layered',
      selectedNodeId: preferred.id,
      highlightedNodeIds: matches.map((n) => n.id),
      consoleOpen: session?.consoleOpen ?? false,
      consoleVisible: session?.consoleVisible ?? true,
      forceStatus: rev.graph.forceStatus,
      metricsOverride: session?.metricsOverride ?? null,
      confirmChoice: null,
      mutations: rev.graph.mutations,
      topicDraft: rev.graph.topicDraft,
      forkSeq: rev.graph.forkSeq,
      useNotebookSources: session?.useNotebookSources ?? false,
      allowWeb: session?.allowWeb ?? true,
      selectedSourceIds: session?.selectedSourceIds ?? [],
    });
    const citeLabel = scenario.citations[citationId]?.title ?? citationId;
    toast.success(
      matches.length > 1
        ? `引用「${citeLabel}」关联 ${matches.length} 个节点，已选中「${preferred.title}」`
        : `已定位到节点「${preferred.title}」`,
      3600,
    );
    navigateToResearchLab(notebookId);
  };

  /** Block `[^@nodeId]` → graph: restore revision graph and focus that node. */
  const locateNodeOnGraph = (nodeId: string) => {
    const rev = activeRev ?? getActiveRevision(notebookId, scenarioId);
    if (!rev) {
      toast.error('没有可定位的报告轮次');
      return;
    }
    const derived = deriveLabState(scenario, rev.graph.phase, {
      forceStatus: rev.graph.forceStatus,
      mutations: rev.graph.mutations,
    });
    const node = derived.nodes.find((n) => n.id === nodeId);
    if (!node) {
      toast.info('本轮思考图中没有该节点锚点', 3200);
      return;
    }
    const session = readLabSessionSnapshot();
    persistLabSessionSnapshot({
      scenarioId,
      phase: rev.graph.phase,
      playing: false,
      playbackMs: session?.playbackMs ?? 1400,
      layoutDirection: session?.layoutDirection ?? 'TB',
      edgePathPreset: session?.edgePathPreset ?? 'smoothstep',
      layoutAlgorithm: session?.layoutAlgorithm ?? 'layered',
      selectedNodeId: node.id,
      highlightedNodeIds: [node.id],
      consoleOpen: session?.consoleOpen ?? false,
      consoleVisible: session?.consoleVisible ?? true,
      forceStatus: rev.graph.forceStatus,
      metricsOverride: session?.metricsOverride ?? null,
      confirmChoice: null,
      mutations: rev.graph.mutations,
      topicDraft: rev.graph.topicDraft,
      forkSeq: rev.graph.forkSeq,
      useNotebookSources: session?.useNotebookSources ?? false,
      allowWeb: session?.allowWeb ?? true,
      selectedSourceIds: session?.selectedSourceIds ?? [],
    });
    toast.success(`已定位到节点「${node.title}」`, 3200);
    navigateToResearchLab(notebookId);
  };

  const convertToSource = () => {
    toast.success(`已登记为笔记本来源（Fake · ${activeRev?.label ?? '报告'}）`, 4500);
  };

  const convertToNote = () => {
    toast.info(`Deep Research 笔记插件规划中（将写入 ${activeRev?.label ?? '报告'}）`, 5000);
  };

  const modeBadge = editing
    ? '编辑中'
    : viewing === 'working'
      ? '编辑副本 · 浏览'
      : `${activeRev?.label ?? '报告'} · 浏览`;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--cl-bg)] text-gray-900"
      {...tid(TestIds.researchLabReportPage)}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => navigateToResearchLab(notebookId)}
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
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  editing
                    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                    : viewing === 'working'
                      ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-100'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {modeBadge}
              </span>
            </div>
            <div className="truncate text-[11px] text-gray-500">
              #{notebookId} · {scenario.shortLabel}
              {working ? ' · 未保存编辑副本' : ''}
              {!editing ? ` · 引用 ${extractCitationIds(activeMarkdown).length}` : ''}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <select
            className="max-w-[160px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700"
            value={activeRevId}
            onChange={(e) => switchRevision(e.target.value)}
            title="切换报告轮次（每轮绑定思考图）"
            {...tid(TestIds.researchLabRevisionSelect)}
          >
            {revisions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.kind === 'default_export' ? ' · 默认' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={saveRevisionRound}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-900 hover:bg-blue-100"
            title="把当前报告正文 + 当前思考图保存为新一轮"
            {...tid(TestIds.researchLabRevisionSave)}
          >
            <SaveIcon sx={{ fontSize: 14 }} />
            保存新一轮
          </button>

          <button
            type="button"
            onClick={applyThinkingGraph}
            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] text-teal-900 hover:bg-teal-100"
            title="套用本轮绑定的思考图并返回图谱"
            {...tid(TestIds.researchLabRevisionApplyGraph)}
          >
            <AccountTreeIcon sx={{ fontSize: 14 }} />
            本轮思考图
          </button>

          {editing ? (
            <button
              type="button"
              onClick={finishEditing}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 hover:bg-blue-100"
              {...tid(TestIds.researchLabReportDoneEdit)}
            >
              <CheckIcon sx={{ fontSize: 14 }} />
              完成编辑
            </button>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
              title="编辑本轮报告（CoW 副本）"
              {...tid(TestIds.researchLabReportEdit)}
            >
              <EditIcon sx={{ fontSize: 14 }} />
              编辑
            </button>
          )}

          {!editing && viewing === 'working' ? (
            <button
              type="button"
              onClick={viewCanonical}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
              {...tid(TestIds.researchLabReportViewCanonical)}
            >
              查看本轮原文
            </button>
          ) : null}
          {!editing && viewing === 'canonical' && working ? (
            <button
              type="button"
              onClick={viewWorkingBrowse}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 hover:bg-blue-100"
            >
              浏览编辑副本
            </button>
          ) : null}
          {working ? (
            <button
              type="button"
              onClick={discardWorking}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              {...tid(TestIds.researchLabReportDiscard)}
            >
              <UndoIcon sx={{ fontSize: 14 }} />
              丢弃编辑
            </button>
          ) : null}

          <button
            type="button"
            onClick={convertToSource}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            <SourceIcon sx={{ fontSize: 14 }} />
            转为来源
          </button>
          <button
            type="button"
            onClick={convertToNote}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            <NoteAltIcon sx={{ fontSize: 14 }} />
            转为笔记
          </button>
          {!editing ? (
            <button
              type="button"
              role="switch"
              aria-checked={showCitations}
              title={showCitations ? '隐藏引用' : '显示引用'}
              onClick={() => setShowCitations((v) => !v)}
              className={`ml-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                showCitations
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
            >
              <FormatQuoteIcon sx={{ fontSize: 15, opacity: showCitations ? 0.85 : 0.45 }} />
              <span className={showCitations ? 'text-gray-600' : 'text-gray-400'}>引用</span>
              <span
                className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${
                  showCitations ? 'bg-blue-500/80' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
                    showCitations ? 'translate-x-3' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col" {...tid(TestIds.researchLabReport)}>
        {editing ? (
          <div className="mb-0 px-10 pt-3">
            <div className="max-w-3xl mx-auto rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              编辑副本中。完成后可「保存新一轮」把正文与当前思考图成对固化。
            </div>
          </div>
        ) : null}
        <LabReportPlateEditor
          documentKey={documentKey}
          markdown={activeMarkdown}
          citations={scenario.citations}
          orphanIds={orphanIds}
          showCitations={showCitations && !editing}
          readOnly={!editing}
          onMarkdownChange={handleMarkdownChange}
          onLocateCitationOnGraph={locateCitationOnGraph}
          onLocateNodeOnGraph={locateNodeOnGraph}
        />
      </div>
    </div>
  );
}
