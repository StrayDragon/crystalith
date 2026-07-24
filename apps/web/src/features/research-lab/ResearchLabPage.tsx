/**
 * Research Lab — Deep Research UX surface (fake runtime until Eden wire-up).
 *
 * ## Mock vs Real
 * | Lab (this feature)                         | Real (server ResearchRun)                             |
 * | ------------------------------------------ | ----------------------------------------------------- |
 * | `fake/*` scenarios + `deriveLabState`      | ResearchRun graph SSOT + SSE `graph_patch`            |
 * | `useLabController` local mutations         | Eden `POST …/research/:rid/nodes/:id/{prune,fork}`    |
 * | phase playback timer                       | Run status machine + stream events                    |
 * | `proposeNodeChatTurn` / mock enrichment    | node chat / agent turns (shape in `nodeChatTypes`)    |
 * | `labSession` / `labRevisions` sessionStorage | Run report + checkpoints (server)                   |
 * | `/research-lab/:nid` SPA route             | ResearchRun HTTP + future wired Lab UI                |
 *
 * Wiring change: `llmanspec/changes/update-research-prune-cascade`
 * (prune closure B + failed merge retain — Lab mirrors server helper).
 *
 * Keep presentation (LabGraph, report Plate) reusable; swap controller/data
 * ports under `fake/` when connecting Eden.
 */
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Science as ScienceIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { toast } from '../../shared/toast';
import { buildSuggestedReportFromNodes } from './fake/buildSuggestedReport';
import {
  defaultForkDraft,
  findForkContext,
  previewPruneAlongEdge,
  type ForkDraft,
  type PrunePreview,
} from './fake/graphMutations';
import {
  ensureDefaultRevision,
  graphSliceFromSession,
  updateDefaultRevision,
} from './fake/labRevisions';
import { formatStatusChangeNote, mockEnrichAfterStatus } from './fake/mockNodeEnrichment';
import type { LabNodeActionProposal } from './fake/nodeChatTypes';
import { findInboundEdgeForNode } from './fake/proposeNodeChatTurn';
import { resolveDefaultExportMarkdown } from './fake/resolveDefaultExportMarkdown';
import { resolveLabPrimaryAction, type LabPrimaryActionKind } from './fake/resolveLabPrimaryAction';
import type { LabNode } from './fake/types';
import { useLabController } from './fake/useLabController';
import LabControlConsole from './LabControlConsole';
import LabGraph from './LabGraph';
import { LabForkDialog, LabPruneDialog, useDialogEscape } from './LabMutationDialogs';
import LabNodeDrawer from './LabNodeDrawer';
import LabProgressBar from './LabProgressBar';
import {
  navigateToLabReport,
  navigateToWorkspace,
  persistLabScenarioId,
  readPersistedLabScenarioId,
} from './labRouting';
import { readLabSessionSnapshot } from './labSession';

export default function ResearchLabPage({ notebookId }: { notebookId: number }) {
  const lab = useLabController(readPersistedLabScenarioId());
  const selected = lab.derived.nodes.find((n) => n.id === lab.selectedNodeId) ?? null;

  const [forkEdgeId, setForkEdgeId] = useState<string | null>(null);
  const [forkDraft, setForkDraft] = useState<ForkDraft>({ title: '', query: '', summary: '' });
  const [prunePreview, setPrunePreview] = useState<PrunePreview | null>(null);

  useEffect(() => {
    persistLabScenarioId(lab.scenarioId);
  }, [lab.scenarioId]);

  const questionText =
    lab.derived.nodes.find((n) => n.role === 'question')?.conclusion?.trim() ||
    lab.topicDraft.trim();

  const primary = useMemo(
    () =>
      resolveLabPrimaryAction({
        phase: lab.phase,
        playing: lab.playing,
        reshaping: lab.reshaping,
        hasTopic: questionText.length > 0,
        conclusionNodeId: lab.derived.conclusionNodeId,
        selectedNodeId: lab.selectedNodeId,
        selectedRole: selected?.role ?? null,
      }),
    [
      lab.phase,
      lab.playing,
      lab.reshaping,
      questionText,
      lab.derived.conclusionNodeId,
      lab.selectedNodeId,
      selected?.role,
    ],
  );

  const openReport = useCallback(() => {
    lab.persistNow();
    persistLabScenarioId(lab.scenarioId);
    const session = readLabSessionSnapshot();
    const graph = session
      ? graphSliceFromSession(session)
      : {
          phase: lab.phase,
          mutations: lab.mutations,
          topicDraft: lab.topicDraft,
          forkSeq: 0,
          forceStatus: lab.forceStatus,
        };
    const markdown = resolveDefaultExportMarkdown({
      scenario: lab.scenario,
      nodes: lab.derived.nodes,
      mutations: lab.mutations,
      edges: lab.derived.edges,
    });
    ensureDefaultRevision({
      notebookId,
      scenarioId: lab.scenarioId,
      reportMarkdown: markdown,
      graph,
    });
    navigateToLabReport(notebookId);
  }, [lab, notebookId]);

  const exportSuggestedFromGraph = useCallback(() => {
    lab.persistNow();
    const session = readLabSessionSnapshot();
    if (!session) {
      toast.error('无法读取当前图谱会话');
      return;
    }
    const fromNodes = buildSuggestedReportFromNodes({
      topic: lab.scenario.topic,
      nodes: lab.derived.nodes,
      citations: lab.scenario.citations,
      edges: lab.derived.edges,
    });
    updateDefaultRevision({
      notebookId,
      scenarioId: lab.scenarioId,
      reportMarkdown: fromNodes,
      graph: graphSliceFromSession(session),
    });
    toast.success('已从当前思考图导出默认建议报告', 2800);
  }, [lab, notebookId]);

  /** MOCK: ActionProposal ports mirror edge prune/fork + confirm; real = Eden + SSE. */
  const acceptNodeChatAction = useCallback(
    (proposal: LabNodeActionProposal, node: LabNode): boolean => {
      switch (proposal.kind) {
        case 'prune_node': {
          const edge = findInboundEdgeForNode(node.id, lab.derived.edges, lab.derived.nodes);
          if (!edge) return false;
          lab.pruneAlongEdge(edge.id);
          return true;
        }
        case 'fork_sibling': {
          const edge = findInboundEdgeForNode(node.id, lab.derived.edges, lab.derived.nodes);
          if (!edge) return false;
          lab.forkAlongEdge(edge.id, {
            title: proposal.params?.title ?? `对照：${node.title}`,
            query: proposal.params?.query ?? node.query,
            summary: proposal.params?.summary,
          });
          return true;
        }
        case 'rewrite_query': {
          const q = proposal.params?.query?.trim();
          if (!q) return false;
          if (node.role === 'question' || node.id === 'root') {
            lab.setTopicDraft(q);
            lab.editNode(node.id, { query: q, conclusion: q });
          } else {
            lab.editNode(node.id, { query: q });
          }
          return true;
        }
        case 'set_status': {
          const status = proposal.params?.conclusionStatus;
          if (!status || status === 'pruned') return false;
          const enriched = mockEnrichAfterStatus(node, status);
          lab.editNode(node.id, enriched);
          toast.info(formatStatusChangeNote(node.title, node.conclusionStatus, status), 2400);
          return true;
        }
        case 'confirm_finish': {
          lab.finishReport();
          lab.setConfirmChoice('finish_report');
          return true;
        }
        case 'confirm_continue': {
          lab.continueDig();
          lab.setConfirmChoice('continue_dig');
          return true;
        }
        case 'open_report': {
          openReport();
          return true;
        }
        default:
          return false;
      }
    },
    [lab, openReport],
  );

  const runPrimary = (kind: LabPrimaryActionKind) => {
    switch (kind) {
      case 'start':
        lab.startFromIdle();
        break;
      case 'pause':
        lab.pause();
        break;
      case 'resume':
        lab.resume();
        break;
      case 'finish_report':
        lab.finishReport();
        if (lab.derived.conclusionNodeId) {
          lab.setSelectedNodeId(lab.derived.conclusionNodeId);
        }
        break;
      case 'continue_dig':
        lab.continueDig();
        break;
      case 'view_conclusion':
        openReport();
        break;
      case 'restart':
        lab.restart();
        break;
      case 'retry':
        lab.retry();
        break;
      default:
        break;
    }
  };

  const onSelectNode = useCallback(
    (id: string | null) => {
      lab.setSelectedNodeId(id);
    },
    [lab],
  );

  const requestFork = useCallback(
    (edgeId: string) => {
      const ctx = findForkContext(edgeId, lab.derived.edges, lab.derived.nodes);
      if (!ctx) return;
      setForkDraft(defaultForkDraft(ctx.parent, ctx.sibling));
      setForkEdgeId(edgeId);
    },
    [lab.derived.edges, lab.derived.nodes],
  );

  const requestPrune = useCallback(
    (edgeId: string) => {
      const preview = previewPruneAlongEdge(edgeId, lab.derived);
      if (!preview) return;
      setPrunePreview(preview);
    },
    [lab.derived],
  );

  const cancelFork = useCallback(() => setForkEdgeId(null), []);
  const cancelPrune = useCallback(() => setPrunePreview(null), []);
  useDialogEscape(forkEdgeId !== null, cancelFork);
  useDialogEscape(prunePreview !== null, cancelPrune);

  const forkEdgeLabel = useMemo(() => {
    if (!forkEdgeId) return '';
    const e = lab.derived.edges.find((x) => x.id === forkEdgeId);
    return e?.labelNote ?? e?.kind ?? forkEdgeId;
  }, [forkEdgeId, lab.derived.edges]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 text-gray-900"
      {...tid(TestIds.researchLabPage)}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => navigateToWorkspace()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          {...tid(TestIds.researchLabBack)}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
          返回
        </button>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-100 bg-blue-50 text-blue-700 shadow-sm">
            <ScienceIcon sx={{ fontSize: 16 }} />
          </span>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold text-gray-900">深度研究实验室</div>
            <div className="truncate text-[11px] text-gray-500">
              #{notebookId} · {lab.scenario.shortLabel}
            </div>
          </div>
        </div>

        <LabProgressBar
          phase={lab.phase}
          metrics={lab.derived.metrics}
          activityLog={lab.derived.activityLog}
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title={
              lab.consoleVisible
                ? lab.consoleOpen
                  ? '收起试验控制台'
                  : '展开试验控制台'
                : '显示试验控制台'
            }
            onClick={() => {
              if (!lab.consoleVisible) {
                lab.setConsoleVisible(true);
                lab.setConsoleOpen(true);
                return;
              }
              lab.setConsoleOpen(!lab.consoleOpen);
            }}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              lab.consoleVisible && lab.consoleOpen
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <TerminalIcon sx={{ fontSize: 16 }} />
          </button>

          {lab.derived.reportVisible ? (
            <div className="relative">
              <details className="group">
                <summary className="flex h-8 list-none cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-600 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                  <MoreHorizIcon sx={{ fontSize: 16 }} />
                  更多
                </summary>
                <div className="absolute right-0 z-30 mt-1 min-w-[160px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-[11px] text-gray-700 hover:bg-gray-50"
                    onClick={exportSuggestedFromGraph}
                    {...tid(TestIds.researchLabExportSuggested)}
                  >
                    导出建议报告
                  </button>
                </div>
              </details>
            </div>
          ) : null}

          {primary.secondary ? (
            <button
              type="button"
              disabled={primary.secondary.disabled}
              title={primary.title}
              onClick={() => runPrimary(primary.secondary!.kind)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
            >
              {primary.secondary.label}
            </button>
          ) : null}
          <button
            type="button"
            disabled={primary.disabled}
            title={primary.title}
            onClick={() => runPrimary(primary.kind)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
            {...tid(TestIds.researchLabStart)}
          >
            {lab.reshaping ? '重塑中…' : primary.label}
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <LabGraph
          nodes={lab.derived.nodes}
          edges={lab.derived.edges}
          selectedNodeId={lab.selectedNodeId}
          highlightedNodeIds={lab.highlightedNodeIds}
          direction={lab.layoutDirection}
          layoutAlgorithm={lab.layoutAlgorithm}
          edgePathPreset={lab.edgePathPreset}
          reshaping={lab.reshaping}
          onSelectNode={onSelectNode}
          onForkEdge={requestFork}
          onPruneEdge={requestPrune}
          onDirection={lab.setLayoutDirection}
          onAlgorithm={lab.setLayoutAlgorithm}
          onEdgePathPreset={lab.setEdgePathPreset}
          className="h-full w-full"
        />

        {lab.reshaping ? (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-900 shadow-md backdrop-blur">
            流程重塑中 · 重算布局
          </div>
        ) : !lab.playing &&
          lab.phase !== 'idle' &&
          lab.phase !== 'completed' &&
          lab.phase !== 'failed' ? (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50/95 px-3 py-1.5 text-[11px] font-medium text-blue-900 shadow-md backdrop-blur">
            {lab.phase === 'awaiting_confirm'
              ? '等待确认 · 可拖动节点 / 分叉剪枝，或点顶栏收束'
              : '已暂停 · 可拖动节点 / 分叉剪枝，再点顶栏继续'}
          </div>
        ) : (
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[240px] rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-[10px] text-gray-500 shadow-sm">
            点节点打开会话 · 边上分叉/剪枝 · 左下角画布设置
          </div>
        )}

        <LabNodeDrawer
          overlay
          node={selected}
          phase={lab.phase}
          citations={lab.scenario.citations}
          reportAvailable={selected?.role === 'conclusion' && lab.derived.reportVisible}
          onOpenReport={openReport}
          constraintsNote={selected?.role === 'question' ? lab.scenario.constraintsNote : null}
          onClose={() => lab.setSelectedNodeId(null)}
          onConfirmFinish={() => {
            lab.finishReport();
            lab.setConfirmChoice('finish_report');
          }}
          onConfirmContinue={() => {
            lab.continueDig();
            lab.setConfirmChoice('continue_dig');
          }}
          onAcceptAction={acceptNodeChatAction}
          onEdit={(id, patch) => {
            lab.editNode(id, patch);
            if (id === 'root' && patch.conclusion) {
              lab.setTopicDraft(patch.conclusion);
            }
          }}
        />
      </div>

      {lab.consoleVisible ? <LabControlConsole lab={lab} /> : null}

      <LabForkDialog
        open={forkEdgeId !== null}
        draft={forkDraft}
        edgeLabel={forkEdgeLabel}
        onChange={setForkDraft}
        onCancel={cancelFork}
        onConfirm={() => {
          if (!forkEdgeId) return;
          lab.forkAlongEdge(forkEdgeId, forkDraft);
          setForkEdgeId(null);
        }}
      />

      <LabPruneDialog
        open={prunePreview !== null}
        preview={prunePreview}
        onCancel={cancelPrune}
        onConfirm={() => {
          if (!prunePreview) return;
          lab.pruneAlongEdge(prunePreview.edgeId);
          setPrunePreview(null);
        }}
      />
    </div>
  );
}
