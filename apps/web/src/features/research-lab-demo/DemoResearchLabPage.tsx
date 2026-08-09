/**
 * Demo Research Lab — xlsx-lib fixture playback under `/demo/research-lab/:nid`.
 * Product Eden Lab lives at `/research-lab/:nid` (c103).
 */
import {
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreHorizIcon,
  Science as ScienceIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { TestIds, tid } from '../../shared/testids';
import { toast } from '../../shared/toast';
import { acceptNodeChatAction as applyNodeChatAction } from '../research-lab/acceptNodeChatAction';
import {
  labPausedBannerText,
  shouldShowLabPausedBanner,
  shouldShowLabPlayingTip,
} from '../research-lab/labBannerState';
import LabComposePanel from '../research-lab/LabComposePanel';
import LabGraph from '../research-lab/LabGraph';
import { LabForkDialog, LabPruneDialog, useDialogEscape } from '../research-lab/LabMutationDialogs';
import LabNodeDrawer from '../research-lab/LabNodeDrawer';
import LabProgressBar from '../research-lab/LabProgressBar';
import { navigateToWorkspace } from '../research-lab/labRouting';
import {
  defaultForkDraft,
  findForkContext,
  previewPruneAlongEdge,
  type ForkDraft,
  type PrunePreview,
} from '../research-lab/model/graphMutations';
import type { LabController } from '../research-lab/model/labController';
import type { LabNodeActionProposal } from '../research-lab/model/nodeChatTypes';
import {
  resolveLabPrimaryAction,
  type LabPrimaryActionKind,
} from '../research-lab/model/resolveLabPrimaryAction';
import type { LabNode } from '../research-lab/model/types';
import ResearchTasksDrawer from '../research-lab/ResearchTasksDrawer';
import ResearchTasksTrigger from '../research-lab/ResearchTasksTrigger';
import type { ResearchTaskListItem } from '../research-lab/researchTaskTypes';
import {
  demoStatusFromLabPhase,
  getActiveDemoResearchTaskId,
  getDemoTaskSwitchEpoch,
  listDemoResearchTasks,
  subscribeDemoResearchTasks,
  updateDemoResearchTask,
} from './demoResearchTasks';
import {
  navigateToDemoLabReport,
  persistLabScenarioId,
  readLabSessionSnapshot,
  readPersistedLabScenarioId,
} from './demoRouting';
import { buildSuggestedReportFromNodes } from './fake/buildSuggestedReport';
import {
  ensureDefaultRevision,
  graphSliceFromSession,
  updateDefaultRevision,
} from './fake/labRevisions';
import { resolveDefaultExportMarkdown } from './fake/resolveDefaultExportMarkdown';
import { useLabController } from './fake/useLabController';
import LabControlConsole from './LabControlConsole';
import { fixtureLabSessionPort } from './labSessionPort';
import { bindActiveTaskSession } from './openDemoResearchTask';
import { useDemoResearchTasks } from './useDemoResearchTasks';

export default function DemoResearchLabPage({ notebookId }: { notebookId: number }) {
  const switchEpoch = useSyncExternalStore(
    subscribeDemoResearchTasks,
    getDemoTaskSwitchEpoch,
    () => 0,
  );
  return <DemoResearchLabSession key={`${notebookId}:${switchEpoch}`} notebookId={notebookId} />;
}

function DemoResearchLabSession({ notebookId }: { notebookId: number }) {
  const lab = useLabController(readPersistedLabScenarioId('xlsx-lib'));

  useEffect(() => {
    persistLabScenarioId(lab.scenarioId);
  }, [lab.scenarioId]);

  useEffect(() => {
    const taskId = getActiveDemoResearchTaskId();
    if (!taskId) return;
    const status = demoStatusFromLabPhase(lab.phase);
    if (status) updateDemoResearchTask(taskId, { status, scenarioId: lab.scenarioId });
    bindActiveTaskSession();
  }, [lab.phase, lab.scenarioId, lab.mutations, lab.topicDraft]);

  const sessionLabel = lab.phase === 'idle' ? '新建任务' : lab.scenario.shortLabel;

  return (
    <LabWorkbench
      notebookId={notebookId}
      lab={lab}
      sessionLabel={sessionLabel}
      showConsole
      onComposeSubmit={(topic) => {
        fixtureLabSessionPort.createTask({
          notebookId,
          topic,
          scenarioId: fixtureLabSessionPort.defaultScenarioId,
          status: 'running',
        });
        lab.composeAndStart(topic);
        bindActiveTaskSession();
        toast.info('演示任务已加入头像旁任务列表', 3200);
      }}
      onSelectTask={(task) => {
        const demo = listDemoResearchTasks().find((t) => t.id === task.id);
        if (demo) fixtureLabSessionPort.openTask(demo);
      }}
      onCreateNew={() => {
        fixtureLabSessionPort.openCompose(notebookId);
      }}
    />
  );
}

type LabWorkbenchProps = {
  notebookId: number;
  lab: LabController;
  sessionLabel: string;
  showConsole: boolean;
  onComposeSubmit: (topic: string) => void;
  onSelectTask: (task: ResearchTaskListItem) => void;
  onCreateNew: () => void;
};

function LabWorkbench({
  notebookId,
  lab,
  sessionLabel,
  showConsole,
  onComposeSubmit,
  onSelectTask,
  onCreateNew,
}: LabWorkbenchProps) {
  const selected = lab.derived.nodes.find((n) => n.id === lab.selectedNodeId) ?? null;
  const showCompose = lab.phase === 'idle';
  const demoTasks = useDemoResearchTasks(notebookId);
  const [tasksDrawerOpen, setTasksDrawerOpen] = useState(false);

  const [forkEdgeId, setForkEdgeId] = useState<string | null>(null);
  const [forkDraft, setForkDraft] = useState<ForkDraft>({ title: '', query: '', summary: '' });
  const [prunePreview, setPrunePreview] = useState<PrunePreview | null>(null);

  const drawerCitations = lab.scenario.citations;

  const questionText =
    // intentionally || — empty conclusion falls back to topic draft
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing
    lab.derived.nodes.find((n) => n.role === 'question')?.conclusion?.trim() ||
    lab.topicDraft.trim();

  const primary = useMemo(() => {
    return resolveLabPrimaryAction({
      phase: lab.phase,
      playing: lab.playing,
      reshaping: lab.reshaping,
      hasTopic: questionText.length > 0,
      conclusionNodeId: lab.derived.conclusionNodeId,
      selectedNodeId: lab.selectedNodeId,
      selectedRole: selected?.role ?? null,
      confirmKind: lab.confirmKind,
    });
  }, [
    lab.phase,
    lab.playing,
    lab.reshaping,
    questionText,
    lab.derived.conclusionNodeId,
    lab.selectedNodeId,
    selected?.role,
    lab.confirmKind,
  ]);

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
    navigateToDemoLabReport(notebookId);
  }, [lab, notebookId]);

  const exportSuggestedFromGraph = useCallback(() => {
    lab.persistNow();
    const session = readLabSessionSnapshot();
    if (!session) {
      toast.error('无法读取当前图谱会话');
      return;
    }
    const fromNodes = buildSuggestedReportFromNodes({
      topic: lab.topicDraft || lab.scenario.topic,
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

  const acceptNodeChatAction = useCallback(
    (proposal: LabNodeActionProposal, node: LabNode): boolean => {
      return applyNodeChatAction({
        proposal,
        node,
        edges: lab.derived.edges,
        nodes: lab.derived.nodes,
        mode: 'fixture',
        lab,
        openReport,
        onStatusNote: (message) => {
          toast.info(message, 2400);
        },
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
      case 'skip_reexpand':
      case 'request_reexpand':
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

  const cancelFork = useCallback(() => {
    setForkEdgeId(null);
  }, []);
  const cancelPrune = useCallback(() => {
    setPrunePreview(null);
  }, []);
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
          onClick={() => {
            navigateToWorkspace();
          }}
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
            onSelectNodeId={(nodeId) => {
              lab.setSelectedNodeId(nodeId);
            }}
          />
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {showConsole ? (
            <button
              type="button"
              title={
                lab.consoleVisible
                  ? lab.consoleOpen
                    ? '收起试验控制台'
                    : '展开试验控制台'
                  : '显示试验控制台（高级）'
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
          ) : null}

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
              onClick={() => {
                runPrimary(primary.tertiary!.kind);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.tertiary.kind === 'finish_report'
                ? tid(TestIds.researchLabConfirmFinish)
                : {})}
            >
              {primary.tertiary.label}
            </button>
          ) : null}
          {!showCompose && primary.secondary ? (
            <button
              type="button"
              disabled={primary.secondary.disabled}
              title={primary.title}
              onClick={() => {
                runPrimary(primary.secondary!.kind);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.secondary.kind === 'continue_dig'
                ? tid(TestIds.researchLabConfirmContinue)
                : primary.secondary.kind === 'skip_branch'
                  ? tid(TestIds.researchLabConfirmSkip)
                  : {})}
            >
              {primary.secondary.label}
            </button>
          ) : null}
          {!showCompose ? (
            <button
              type="button"
              disabled={primary.disabled}
              title={primary.title}
              onClick={() => {
                runPrimary(primary.kind);
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
              {...(primary.kind === 'approve_branch'
                ? tid(TestIds.researchLabConfirmApprove)
                : primary.kind === 'finish_report'
                  ? tid(TestIds.researchLabConfirmFinish)
                  : tid(TestIds.researchLabStart))}
            >
              {lab.reshaping ? '重塑中…' : primary.label}
            </button>
          ) : null}

          <ResearchTasksTrigger
            notebookId={notebookId}
            onOpen={() => {
              setTasksDrawerOpen(true);
            }}
          />
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

        {showCompose ? (
          <LabComposePanel
            notebookId={notebookId}
            mode="fixture"
            exampleTopic={lab.scenario.topic}
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
            mode="fixture"
            notebookId={notebookId}
            runId={null}
            llmBusy={false}
            node={selected}
            phase={lab.phase}
            citations={drawerCitations}
            reportAvailable={selected?.role === 'conclusion' && lab.derived.reportVisible}
            onOpenReport={openReport}
            constraintsNote={selected?.role === 'question' ? lab.scenario.constraintsNote : null}
            onClose={() => {
              lab.setSelectedNodeId(null);
            }}
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

      {showConsole && lab.consoleVisible ? <LabControlConsole lab={lab} /> : null}

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
        onClose={() => {
          setTasksDrawerOpen(false);
        }}
        notebookId={notebookId}
        tasks={demoTasks.tasks.map((t) => ({
          id: t.id,
          notebookId: t.notebookId,
          topic: t.topic,
          status: t.status,
        }))}
        activeTaskId={demoTasks.activeTaskId}
        loading={false}
        error=""
        onSelectTask={(task) => {
          setTasksDrawerOpen(false);
          onSelectTask(task);
        }}
        onCreateNew={() => {
          setTasksDrawerOpen(false);
          onCreateNew();
        }}
      />
    </div>
  );
}
