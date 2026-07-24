import type {
  ResearchConfirmBody,
  ResearchCreateBody,
  ResearchForkBody,
  ResearchNodeActionProposal,
  ResearchNodeChatBody,
  ResearchNodeChatStreamEvent,
  ResearchNodePatchBody,
  ResearchRun,
  ResearchRunStatus,
  ResearchRunSummary,
  ResearchRunsPage,
} from '@crystalith/shared';

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
    if (ev.event === 'chunk') {
      const data = ev.data as { text?: string };
      yield { event: 'chunk', data: { text: data.text ?? '' } };
    } else if (ev.event === 'proposal') {
      yield { event: 'proposal', data: ev.data as ResearchNodeActionProposal };
    } else if (ev.event === 'done') {
      const data = ev.data as { proposals?: ResearchNodeActionProposal[] };
      yield { event: 'done', data: { proposals: data.proposals } };
    } else if (ev.event === 'error') {
      const data = ev.data as { errorCode?: string; message?: string };
      yield {
        event: 'error',
        data: {
          errorCode: data.errorCode ?? 'UNKNOWN',
          message: data.message ?? '节点对话失败',
        },
      };
    } else if (ev.event === 'log') {
      const data = ev.data as { message?: string; nodeId?: string };
      yield {
        event: 'log',
        data: { message: data.message ?? '', nodeId: data.nodeId },
      };
    }
    // Unknown event names are ignored (must not mix into Run stream handlers).
  }
}
