/**
 * Research Lab — deep-research workbench (Eden ResearchRun + SSE only).
 */
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { toast } from '../../shared/toast';
import {
  defaultForkDraft,
  findForkContext,
  previewPruneAlongEdge,
  type ForkDraft,
  type PrunePreview,
} from '../research-lab-demo/fake/graphMutations';
import type { LabNodeActionProposal } from '../research-lab-demo/fake/nodeChatTypes';
import {
  applyEdenPrimaryActionOverlay,
  resolveLabPrimaryAction,
  type LabPrimaryActionKind,
} from '../research-lab-demo/fake/resolveLabPrimaryAction';
import type { LabNode } from '../research-lab-demo/fake/types';
import { acceptNodeChatAction as applyNodeChatAction } from './acceptNodeChatAction';
import { cancelActiveEdenRun } from './edenCancelFlow';
import {
  downloadResearchReportMarkdown,
  resolveEdenExportFromReport,
  resolveEdenOpenReport,
} from './edenReportActions';
import { getResearchRun } from './edenResearchApi';
import {
  labPausedBannerText,
  shouldShowLabPausedBanner,
  shouldShowLabPlayingTip,
} from './labBannerState';
import { LabChatModelSelect } from './LabChatModelSelect';
import LabComposePanel, { EDEN_EXAMPLE_TOPIC } from './LabComposePanel';
import LabGraph from './LabGraph';
import { LabForkDialog, LabPruneDialog, useDialogEscape } from './LabMutationDialogs';
import LabNodeDrawer from './LabNodeDrawer';
import LabProgressBar from './LabProgressBar';
import { navigateToLabReport, navigateToWorkspace } from './labRouting';
import ResearchTasksDrawer from './ResearchTasksDrawer';
import ResearchTasksTrigger from './ResearchTasksTrigger';
import { isActiveResearchStatus, type ResearchTaskListItem } from './researchTaskTypes';
import { isSynthesizeFailureReason } from './synthesizeFailure';
import {
  navigateLabWithRun,
  readActiveRunIdFromUrl,
  useEdenLabController,
  type EdenLabController,
} from './useEdenLabController';

export default function ResearchLabPage({ notebookId }: { notebookId: number }) {
  const [runId, setRunId] = useState(() => readActiveRunIdFromUrl());

  useEffect(() => {
    const sync = () => setRunId(readActiveRunIdFromUrl());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return <EdenResearchLabSession notebookId={notebookId} runId={runId} />;
}

function EdenResearchLabSession({
  notebookId,
  runId,
}: {
  notebookId: number;
  runId: number | null;
}) {
  const lab = useEdenLabController(notebookId, runId);

  const sessionLabel =
    lab.phase === 'idle'
      ? '新建任务'
      : runId
        ? `Run #${runId}`
        : lab.topicDraft.trim() || lab.scenario.topic;

  return (
    <LabWorkbench
      notebookId={notebookId}
      lab={lab}
      sessionLabel={sessionLabel}
      lastError={lab.lastError}
      onComposeSubmit={(topic) => lab.composeAndStart(topic)}
      onSelectTask={(task) => {
        const rid = Number(task.id);
        if (Number.isFinite(rid) && rid > 0) navigateLabWithRun(notebookId, rid);
      }}
      onCreateNew={() => {
        lab.restart();
        navigateLabWithRun(notebookId, null);
      }}
    />
  );
}

type LabWorkbenchProps = {
  notebookId: number;
  lab: EdenLabController;
  sessionLabel: string;
  lastError?: string;
  onComposeSubmit: (topic: string) => void;
  onSelectTask: (task: ResearchTaskListItem) => void;
  onCreateNew: () => void;
};

function LabWorkbench({
  notebookId,
  lab,
  sessionLabel,
  lastError,
  onComposeSubmit,
  onSelectTask,
  onCreateNew,
}: LabWorkbenchProps) {
  const selected = lab.derived.nodes.find((n) => n.id === lab.selectedNodeId) ?? null;
  // Avoid Compose flash while Eden loads `?rid=` (phase is idle until GET returns).
  const urlRid = readActiveRunIdFromUrl();
  const loadingExistingRun = Boolean(urlRid && lab.phase === 'idle');
  const showCompose = lab.phase === 'idle' && !loadingExistingRun;
  const [tasksDrawerOpen, setTasksDrawerOpen] = useState(false);

  const [forkEdgeId, setForkEdgeId] = useState<string | null>(null);
  const [forkDraft, setForkDraft] = useState<ForkDraft>({ title: '', query: '', summary: '' });
  const [prunePreview, setPrunePreview] = useState<PrunePreview | null>(null);

  const drawerCitations = lab.citations;

  const questionText =
    lab.derived.nodes.find((n) => n.role === 'question')?.conclusion?.trim() ||
    lab.topicDraft.trim();

  const primary = useMemo(() => {
    const base = resolveLabPrimaryAction({
      phase: lab.phase,
      playing: lab.playing,
      reshaping: lab.reshaping,
      hasTopic: questionText.length > 0,
      conclusionNodeId: lab.derived.conclusionNodeId,
      selectedNodeId: lab.selectedNodeId,
      selectedRole: selected?.role ?? null,
      confirmKind: lab.confirmKind,
    });
    return applyEdenPrimaryActionOverlay(base, {
      runStatus: lab.runStatus ?? null,
      hasSeededGraph: lab.derived.nodes.length > 0,
    });
  }, [
    lab.phase,
    lab.playing,
    lab.reshaping,
    questionText,
    lab.derived.conclusionNodeId,
    lab.derived.nodes.length,
    lab.selectedNodeId,
    selected?.role,
    lab.confirmKind,
    lab.runStatus,
  ]);

  const openReport = useCallback(() => {
    const resolved = resolveEdenOpenReport(notebookId, readActiveRunIdFromUrl());
    if (!resolved.ok) {
      toast.error(resolved.error);
      return;
    }
    navigateToLabReport(resolved.notebookId, resolved.runId);
  }, [notebookId]);

  const exportSuggestedFromGraph = useCallback(() => {
    const rid = readActiveRunIdFromUrl();
    if (rid === null) {
      toast.error('缺少有效的 ResearchRun id，无法导出');
      return;
    }
    void (async () => {
      try {
        const run = await getResearchRun(notebookId, rid);
        const resolved = resolveEdenExportFromReport(run.report);
        if (!resolved.ok) {
          toast.error(resolved.error);
          return;
        }
        downloadResearchReportMarkdown(resolved.markdown, resolved.title);
        toast.success('已导出研究报告 Markdown', 2800);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(msg);
      }
    })();
  }, [notebookId]);

  const acceptNodeChatAction = useCallback(
    (proposal: LabNodeActionProposal, node: LabNode): boolean => {
      return applyNodeChatAction({
        proposal,
        node,
        edges: lab.derived.edges,
        nodes: lab.derived.nodes,
        mode: 'eden',
        lab,
        openReport,
        onStatusNote: (message) => toast.info(message, 2400),
      });
    },
    [lab, openReport],
  );

  const runPrimary = (kind: LabPrimaryActionKind) => {
    switch (kind) {
      case 'start':
        lab.composeAndStart(lab.topicDraft || questionText);
        break;
      case 'pause':
        lab.pause();
        break;
      case 'cancel':
        lab.cancel();
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
      case 'approve_branch':
        lab.approveBranch();
        break;
      case 'skip_branch':
        lab.skipBranch();
        break;
      case 'approve_reexpand':
        lab.approveReexpand();
        break;
      case 'skip_reexpand':
        lab.skipReexpand();
        break;
      case 'request_reexpand':
        lab.requestReexpand();
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

  const onCancelTask = useCallback(
    (task: ResearchTaskListItem) => {
      if (!isActiveResearchStatus(task.status)) return;
      const rid = Number(task.id);
      if (!Number.isFinite(rid) || rid <= 0) return;
      const currentRid = readActiveRunIdFromUrl();
      if (currentRid === rid) {
        lab.cancel();
        return;
      }
      void (async () => {
        try {
          await cancelActiveEdenRun(notebookId, rid);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          toast.error(msg);
        }
      })();
    },
    [lab, notebookId],
  );

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
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 shadow-sm">
            <ScienceIcon sx={{ fontSize: 16 }} />
          </span>
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm font-semibold text-gray-900">深度研究</div>
            <div className="truncate text-[11px] text-gray-500">
              #{notebookId}
              {showCompose ? ' · 新建任务' : ` · ${sessionLabel}`}
            </div>
          </div>
        </div>

        {!showCompose ? (
          <LabProgressBar
            phase={lab.phase}
            progressPct={lab.progressPct}
            searchesUsed={lab.searchesUsed}
            maxSearches={lab.maxSearches}
            researchDone={lab.researchDone}
            researchTotal={lab.researchTotal}
            events={lab.progressEvents}
            onSelectNodeId={(nodeId) => lab.setSelectedNodeId(nodeId)}
          />
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-1.5">
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

          {!showCompose && primary.tertiary ? (
            <button
              type="button"
              disabled={primary.tertiary.disabled}
              title={primary.title}
              onClick={() => runPrimary(primary.tertiary!.kind)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.tertiary.kind === 'finish_report'
                ? tid(TestIds.researchLabConfirmFinish)
                : primary.tertiary.kind === 'request_reexpand'
                  ? tid(TestIds.researchLabRequestReexpand)
                  : {})}
            >
              {primary.tertiary.label}
            </button>
          ) : null}
          {!showCompose && primary.secondary ? (
            <button
              type="button"
              disabled={
                primary.secondary.disabled || (lab.busy && primary.secondary.kind !== 'cancel')
              }
              title={primary.title}
              onClick={() => runPrimary(primary.secondary!.kind)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.secondary.kind === 'continue_dig'
                ? tid(TestIds.researchLabConfirmContinue)
                : primary.secondary.kind === 'skip_branch'
                  ? tid(TestIds.researchLabConfirmSkip)
                  : primary.secondary.kind === 'skip_reexpand'
                    ? tid(TestIds.researchLabConfirmSkipReexpand)
                    : primary.secondary.kind === 'request_reexpand'
                      ? tid(TestIds.researchLabRequestReexpand)
                      : primary.secondary.kind === 'cancel'
                        ? tid(TestIds.researchLabCancel)
                        : {})}
            >
              {primary.secondary.label}
            </button>
          ) : null}
          {!showCompose ? (
            <button
              type="button"
              disabled={primary.disabled || (lab.busy && primary.kind !== 'cancel')}
              title={primary.title}
              onClick={() => runPrimary(primary.kind)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.kind === 'approve_branch'
                ? tid(TestIds.researchLabConfirmApprove)
                : primary.kind === 'approve_reexpand'
                  ? tid(TestIds.researchLabConfirmApproveReexpand)
                  : primary.kind === 'finish_report'
                    ? tid(TestIds.researchLabConfirmFinish)
                    : primary.kind === 'resume'
                      ? tid(TestIds.researchLabSchedule)
                      : primary.kind === 'cancel'
                        ? tid(TestIds.researchLabCancel)
                        : tid(TestIds.researchLabStart))}
            >
              {lab.reshaping
                ? '重塑中…'
                : lab.busy && primary.kind !== 'cancel'
                  ? '处理中…'
                  : primary.label}
            </button>
          ) : null}

          <ResearchTasksTrigger notebookId={notebookId} onOpen={() => setTasksDrawerOpen(true)} />
        </div>
      </header>

      {lastError ? (
        <div
          className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          role="alert"
        >
          {lastError}
        </div>
      ) : null}

      {lab.phase === 'failed' && isSynthesizeFailureReason(lab.failureReason) ? (
        <div
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          role="alert"
          {...tid(TestIds.researchLabSynthesizeFailBanner)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">结案失败：{lab.failureReason}</span>
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-800">换模</span>
              <LabChatModelSelect
                value={lab.modelId}
                onChange={(modelId) => lab.setModelId(modelId)}
                className="rounded border border-amber-300 bg-white px-1.5 py-1 text-[11px]"
                data-testid={TestIds.researchLabRetrySynthesizeModel}
              />
            </label>
            <button
              type="button"
              disabled={lab.reshaping}
              onClick={() => lab.retrySynthesize()}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
              {...tid(TestIds.researchLabRetrySynthesize)}
            >
              重试结案
            </button>
          </div>
        </div>
      ) : null}

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

        {showCompose ? (
          <LabComposePanel
            notebookId={notebookId}
            mode="eden"
            exampleTopic={EDEN_EXAMPLE_TOPIC}
            draft={{
              topic: lab.topicDraft,
              useNotebookSources: lab.useNotebookSources,
              allowWeb: lab.allowWeb,
              selectedSourceIds: lab.selectedSourceIds,
              depth: lab.depth,
              modelId: lab.modelId,
            }}
            onChange={(patch) => {
              if (patch.topic !== undefined) lab.setTopicDraft(patch.topic);
              if (patch.useNotebookSources !== undefined) {
                lab.setUseNotebookSources(patch.useNotebookSources);
              }
              if (patch.allowWeb !== undefined) lab.setAllowWeb(patch.allowWeb);
              if (patch.depth !== undefined) lab.setDepth(patch.depth);
              if (patch.selectedSourceIds !== undefined) {
                lab.setSelectedSourceIds(patch.selectedSourceIds);
              }
              if (patch.modelId !== undefined) lab.setModelId(patch.modelId);
            }}
            onSubmit={() => {
              const topic = lab.topicDraft.trim();
              if (!topic) return;
              onComposeSubmit(topic);
            }}
          />
        ) : null}

        {loadingExistingRun ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-50/80 backdrop-blur-[1px]">
            <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
              正在加载 Run #{urlRid}…
            </p>
          </div>
        ) : null}

        {!showCompose && lab.reshaping ? (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-900 shadow-md backdrop-blur">
            流程重塑中 · 重算布局
          </div>
        ) : null}
        {shouldShowLabPausedBanner({
          showCompose,
          reshaping: lab.reshaping,
          playing: lab.playing,
          phase: lab.phase,
        }) ? (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50/95 px-3 py-1.5 text-[11px] font-medium text-blue-900 shadow-md backdrop-blur">
            {labPausedBannerText(lab.phase, lab.confirmKind)}
          </div>
        ) : null}
        {shouldShowLabPlayingTip({ showCompose, playing: lab.playing }) ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[240px] rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-[10px] text-gray-500 shadow-sm">
            点节点打开会话 · 边上分叉/剪枝 · 左下角画布设置
          </div>
        ) : null}

        {!showCompose ? (
          <LabNodeDrawer
            overlay
            mode="eden"
            notebookId={notebookId}
            runId={lab.runId ?? readActiveRunIdFromUrl()}
            llmBusy={Boolean(lab.llmActivity)}
            onChatError={(msg) => lab.reportError(msg)}
            node={selected}
            phase={lab.phase}
            citations={drawerCitations}
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
        ) : null}
      </div>

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

      <ResearchTasksDrawer
        open={tasksDrawerOpen}
        onClose={() => setTasksDrawerOpen(false)}
        notebookId={notebookId}
        onSelectTask={(task) => {
          setTasksDrawerOpen(false);
          onSelectTask(task);
        }}
        onCreateNew={() => {
          setTasksDrawerOpen(false);
          onCreateNew();
        }}
        onCancelTask={onCancelTask}
      />
    </div>
  );
}
