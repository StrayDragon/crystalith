import type {
  ResearchArtifactRef,
  ResearchConfirmBody,
  ResearchConvertToNoteResponse,
  ResearchConvertToSourceResponse,
  ResearchCreateBody,
  ResearchForkBody,
  ResearchForkRunBody,
  ResearchNodeActionProposal,
  ResearchNodeChatBody,
  ResearchNodeChatStreamEvent,
  ResearchNodePatchBody,
  ResearchProgressList,
  ResearchReport,
  ResearchReportView,
  ResearchRequestReexpandBody,
  ResearchRevision,
  ResearchRevisionCreateBody,
  ResearchRevisionsList,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
  ResearchRunsPage,
} from '@crystalith/shared';
import { ResearchNodeActionProposalSchema } from '@crystalith/shared';

import { api } from '../../api/eden';
import { parseServerError } from '../../api/parseServerError';
import { streamRequest } from '../../api/stream';

function throwEdenError(error: unknown): never {
  const parsed = parseServerError(error);
  const err = new Error(parsed.message) as Error & { errorCode?: string; status?: number };
  err.errorCode = parsed.errorCode;
  err.status = parsed.status;
  throw err;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function createResearchRun(
  notebookId: number,
  body: ResearchCreateBody,
): Promise<ResearchRun> {
  const { data, error } = await api.v2.notebooks({ nid: notebookId }).research.post(body);
  if (error) throwEdenError(error);
  if (!data) throw new Error('创建 ResearchRun 失败：空响应');
  return data;
}

export async function listResearchRuns(
  notebookId: number,
  opts?: { offset?: number; limit?: number; status?: ResearchRunStatus[] },
): Promise<ResearchRunsPage> {
  const { data, error } = await api.v2.notebooks({ nid: notebookId }).research.get({
    query: {
      offset: opts?.offset ?? 0,
      limit: opts?.limit ?? 50,
      ...(opts?.status && opts.status.length > 0 ? { status: opts.status } : {}),
    },
  });
  if (error) throwEdenError(error);
  if (!data) throw new Error('列出 ResearchRun 失败：空响应');
  return data;
}

export async function getResearchRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .get();
  if (error) throwEdenError(error);
  if (!data) throw new Error('获取 ResearchRun 失败：空响应');
  return data;
}

export async function listProgress(
  notebookId: number,
  runId: number,
  opts?: { afterSeq?: number; limit?: number },
): Promise<ResearchProgressList> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .progress.get({
      query: {
        afterSeq: opts?.afterSeq ?? 0,
        limit: opts?.limit ?? 100,
      },
    });
  if (error) throwEdenError(error);
  if (!data) throw new Error('获取进度账本失败：空响应');
  return data;
}

export async function cancelResearchRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .cancel.post();
  if (error) throwEdenError(error);
  if (!data) throw new Error('取消 ResearchRun 失败：空响应');
  return data;
}

export async function retrySynthesizeResearchRun(
  notebookId: number,
  runId: number,
  body?: { modelId?: string },
): Promise<ResearchRun> {
  const run = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
  const { data, error } = await run['retry-synthesize'].post(body ?? {});
  if (error) throwEdenError(error);
  if (!data) throw new Error('重试结案失败：空响应');
  return data;
}

export async function confirmResearchRun(
  notebookId: number,
  runId: number,
  body: ResearchConfirmBody,
): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .confirm.post(body);
  if (error) throwEdenError(error);
  if (!data) throw new Error('确认 ResearchRun 失败：空响应');
  return data;
}

export async function addResearchBudget(notebookId: number, runId: number): Promise<ResearchRun> {
  const run = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
  const { data, error } = await run['add-budget'].post({});
  if (error) throwEdenError(error);
  if (!data) throw new Error('加购检索预算失败：空响应');
  return data;
}

export async function requestReexpand(
  notebookId: number,
  runId: number,
  body?: ResearchRequestReexpandBody,
): Promise<ResearchRun> {
  const run = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
  const { data, error } = await run['request-reexpand'].post(body ?? {});
  if (error) throwEdenError(error);
  if (!data) throw new Error('请求再扩展失败：空响应');
  return data;
}

export async function pruneResearchNode(
  notebookId: number,
  runId: number,
  nodeId: string,
): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .nodes({ nodeId })
    .prune.post();
  if (error) throwEdenError(error);
  if (!data) throw new Error('剪枝失败：空响应');
  return data;
}

export async function forkResearchNode(
  notebookId: number,
  runId: number,
  nodeId: string,
  body?: ResearchForkBody,
): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .nodes({ nodeId })
    .fork.post(body ?? {});
  if (error) throwEdenError(error);
  if (!data) throw new Error('分叉失败：空响应');
  return data;
}

export async function patchResearchNode(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodePatchBody,
): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .nodes({ nodeId })
    .patch(body);
  if (error) throwEdenError(error);
  if (!data) throw new Error('更新节点失败：空响应');
  return data;
}

export function summaryToTaskItem(s: ResearchRunSummary): {
  id: string;
  notebookId: number;
  topic: string;
  status: ResearchRunStatus;
} {
  return {
    id: String(s.id),
    notebookId: s.notebookId,
    topic: s.topic,
    status: s.status,
  };
}

// ---------------------------------------------------------------------------
// Revisions / report CoW / convert (c89 — ResearchRun APIs)
// ---------------------------------------------------------------------------

function researchRunPath(notebookId: number, runId: number) {
  return api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
}

export async function listResearchRevisions(
  notebookId: number,
  runId: number,
): Promise<ResearchRevisionsList> {
  const { data, error } = await researchRunPath(notebookId, runId).revisions.get();
  if (error) throwEdenError(error);
  if (!data) throw new Error('列出版本失败：空响应');
  return data;
}

export async function createResearchRevision(
  notebookId: number,
  runId: number,
  body?: ResearchRevisionCreateBody,
): Promise<ResearchRevision> {
  const { data, error } = await researchRunPath(notebookId, runId).revisions.post(body ?? {});
  if (error) throwEdenError(error);
  if (!data) throw new Error('创建版本失败：空响应');
  return data;
}

export async function getResearchRevision(
  notebookId: number,
  runId: number,
  revId: string,
): Promise<ResearchRevision> {
  const { data, error } = await researchRunPath(notebookId, runId).revisions({ revId }).get();
  if (error) throwEdenError(error);
  if (!data) throw new Error('获取版本失败：空响应');
  return data;
}

export async function restoreResearchRevision(
  notebookId: number,
  runId: number,
  revId: string,
): Promise<ResearchRun> {
  const { data, error } = await researchRunPath(notebookId, runId)
    .revisions({ revId })
    .restore.post();
  if (error) throwEdenError(error);
  if (!data) throw new Error('恢复版本失败：空响应');
  return data;
}

/** POST …/revisions/:revId/fork-run — new ResearchRun from revision snapshot (c105). */
export async function forkResearchRunFromRevision(
  notebookId: number,
  runId: number,
  revId: string,
  body?: ResearchForkRunBody,
): Promise<ResearchRun> {
  const revision = researchRunPath(notebookId, runId).revisions({ revId });
  const { data, error } = await revision['fork-run'].post(body ?? {});
  if (error) throwEdenError(error);
  if (!data) throw new Error('派生新研究失败：空响应');
  return data;
}

/** POST …/schedule — start kernel for queued Run only. */
export async function scheduleResearchRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const { data, error } = await researchRunPath(notebookId, runId).schedule.post();
  if (error) throwEdenError(error);
  if (!data) throw new Error('启动研究失败：空响应');
  return data;
}

/** GET …/report — canonical + working view (no separate GET …/report/working). */
export async function getResearchReportView(
  notebookId: number,
  runId: number,
): Promise<ResearchReportView> {
  const { data, error } = await researchRunPath(notebookId, runId).report.get();
  if (error) throwEdenError(error);
  if (!data) throw new Error('获取报告视图失败：空响应');
  return data;
}

export async function putResearchCanonicalReport(
  notebookId: number,
  runId: number,
  report: ResearchReport,
): Promise<ResearchReportView> {
  const { data, error } = await researchRunPath(notebookId, runId).report.put({ report });
  if (error) throwEdenError(error);
  if (!data) throw new Error('写入权威报告失败：空响应');
  return data;
}

export async function putResearchWorkingReport(
  notebookId: number,
  runId: number,
  report: ResearchReport,
): Promise<ResearchReportView> {
  const { data, error } = await researchRunPath(notebookId, runId).report.working.put({ report });
  if (error) throwEdenError(error);
  if (!data) throw new Error('写入 working 报告失败：空响应');
  return data;
}

export async function discardResearchWorkingReport(
  notebookId: number,
  runId: number,
): Promise<ResearchReportView> {
  const { data, error } = await researchRunPath(notebookId, runId).report.working.delete();
  if (error) throwEdenError(error);
  if (!data) throw new Error('丢弃 working 报告失败：空响应');
  return data;
}

export async function convertResearchToNote(
  notebookId: number,
  runId: number,
  artifact: ResearchArtifactRef,
): Promise<ResearchConvertToNoteResponse> {
  const { data, error } = await researchRunPath(notebookId, runId)['convert-to-note'].post({
    artifact,
  });
  if (error) throwEdenError(error);
  if (!data) throw new Error('转为笔记失败：空响应');
  return data;
}

export async function convertResearchToSource(
  notebookId: number,
  runId: number,
  artifact: ResearchArtifactRef,
): Promise<ResearchConvertToSourceResponse> {
  const { data, error } = await researchRunPath(notebookId, runId)['convert-to-source'].post({
    artifact,
  });
  if (error) throwEdenError(error);
  if (!data) throw new Error('转为来源失败：空响应');
  return data;
}

/**
 * Short-lived node chat SSE (c78 / c88) — independent of Run `GET …/stream`.
 * Yields typed chunk / proposal / done / error / log events.
 */
export async function* streamNodeChat(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodeChatBody,
  options?: { signal?: AbortSignal },
): AsyncGenerator<ResearchNodeChatStreamEvent> {
  const path = `/v2/notebooks/${notebookId}/research/${runId}/nodes/${encodeURIComponent(nodeId)}/chat`;
  for await (const ev of streamRequest(path, {
    method: 'POST',
    body,
    signal: options?.signal,
  })) {
    const data = isRecord(ev.data) ? ev.data : {};
    if (ev.event === 'chunk') {
      yield {
        event: 'chunk',
        data: { text: typeof data.text === 'string' ? data.text : '' },
      };
    } else if (ev.event === 'proposal') {
      const proposal = ResearchNodeActionProposalSchema.safeParse(ev.data);
      if (!proposal.success) continue;
      yield { event: 'proposal', data: proposal.data };
    } else if (ev.event === 'done') {
      const proposalsRaw = Array.isArray(data.proposals) ? data.proposals : undefined;
      const proposals = proposalsRaw
        ?.map((item) => ResearchNodeActionProposalSchema.safeParse(item))
        .filter((r): r is { success: true; data: ResearchNodeActionProposal } => r.success)
        .map((r) => r.data);
      yield { event: 'done', data: { proposals } };
    } else if (ev.event === 'error') {
      yield {
        event: 'error',
        data: {
          errorCode: typeof data.errorCode === 'string' ? data.errorCode : 'UNKNOWN',
          message: typeof data.message === 'string' ? data.message : '节点对话失败',
        },
      };
    } else if (ev.event === 'log') {
      yield {
        event: 'log',
        data: {
          message: typeof data.message === 'string' ? data.message : '',
          nodeId: typeof data.nodeId === 'string' ? data.nodeId : undefined,
        },
      };
    }
    // Unknown event names are ignored (must not mix into Run stream handlers).
  }
}
