import type {
  ResearchConfirmBody,
  ResearchCreateBody,
  ResearchForkBody,
  ResearchNodePatchBody,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
  ResearchRunsPage,
} from '@crystalith/shared';

import { api } from '../../api/eden';
import { parseServerError } from '../../api/parseServerError';

function throwEdenError(error: unknown): never {
  const parsed = parseServerError(error);
  const err = new Error(parsed.message) as Error & { errorCode?: string; status?: number };
  err.errorCode = parsed.errorCode;
  err.status = parsed.status;
  throw err;
}

export async function createResearchRun(
  notebookId: number,
  body: ResearchCreateBody,
): Promise<ResearchRun> {
  const { data, error } = await api.v2.notebooks({ nid: notebookId }).research.post(body);
  if (error) throwEdenError(error);
  if (!data) throw new Error('创建 ResearchRun 失败：空响应');
  return data as ResearchRun;
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
  return data as ResearchRunsPage;
}

export async function getResearchRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .get();
  if (error) throwEdenError(error);
  if (!data) throw new Error('获取 ResearchRun 失败：空响应');
  return data as ResearchRun;
}

export async function cancelResearchRun(notebookId: number, runId: number): Promise<ResearchRun> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .research({ rid: runId })
    .cancel.post();
  if (error) throwEdenError(error);
  if (!data) throw new Error('取消 ResearchRun 失败：空响应');
  return data as ResearchRun;
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
  return data as ResearchRun;
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
  return data as ResearchRun;
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
  return data as ResearchRun;
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
  return data as ResearchRun;
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
