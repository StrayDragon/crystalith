/**
 * Deep Research node chat — SSE short-lived; proposals only.
 */
import type {
  ResearchNode,
  ResearchNodeActionProposal,
  ResearchNodeChatBody,
} from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { researchRuns } from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { createResearchNodeAgent, proposalFromStructureToolCall } from './node-agent.ts';
import {
  activeLoops,
  appendProgressEvent,
  chatAbortControllers,
  chatKey,
  getGraph,
  newId,
  requireRun,
  resolveNodeRole,
  updateRun,
} from './research-core.ts';

// ---------------------------------------------------------------------------
// C1 — Node chat (SSE short-lived; proposals only)
// ---------------------------------------------------------------------------

/** Pragmatic stub: text + ActionProposal — never mutates graph. */
export function stubNodeChatTurn(
  node: ResearchNode,
  message: string,
): { text: string; proposals: ResearchNodeActionProposal[] } {
  const role = resolveNodeRole(node);
  const lower = message.toLowerCase();
  const proposals: ResearchNodeActionProposal[] = [];
  const push = (
    kind: ResearchNodeActionProposal['kind'],
    label: string,
    rationale: string,
    params?: ResearchNodeActionProposal['params'],
  ) => {
    proposals.push({
      id: newId('ap'),
      kind,
      label,
      rationale,
      status: 'pending',
      params,
    });
  };

  if (role === 'research') {
    if (/prune|剪枝|丢弃|砍掉/u.test(lower)) {
      push('prune_node', '剪枝此节点', '接受后走 POST …/prune（不会在 chat 内自动执行）');
    }
    if (/fork|分叉|扩展|支路/u.test(lower)) {
      push('fork_sibling', '分叉兄弟节点', '接受后走 POST …/fork → confirm', {
        title: `扩展：${node.title}`,
      });
    }
    if (/query|查询|改问|rewrite/u.test(lower)) {
      push('rewrite_query', '改写查询', '接受后走 PATCH …/nodes/:id', {
        query: message.slice(0, 200),
      });
    }
    if (/status|状态|结论/u.test(lower)) {
      push('set_status', '设为 partial', '接受后走 PATCH conclusionStatus', {
        conclusionStatus: 'partial',
      });
    }
  } else if (role === 'question') {
    if (/finish|报告|完成/u.test(lower)) {
      push('confirm_finish', '结束并出报告', '接受后走 POST …/confirm finish_report');
    }
    if (/continue|继续/u.test(lower)) {
      push('confirm_continue', '继续研究', '接受后走 POST …/confirm continue');
    }
    if (/query|改问/u.test(lower)) {
      push('rewrite_query', '改写问题查询', '接受后走 PATCH', { query: message.slice(0, 200) });
    }
  } else {
    if (/report|报告|打开/u.test(lower)) {
      push('open_report', '打开报告', '纯前端导航，不改图');
    }
    if (/finish|完成/u.test(lower)) {
      push('confirm_finish', '结束并出报告', '接受后走 confirm');
    }
    if (/status|状态/u.test(lower)) {
      push('set_status', '设结论状态', '接受后走 PATCH', { conclusionStatus: 'partial' });
    }
  }

  if (proposals.length === 0) {
    // Mild default suggestions by role (still proposals only)
    if (role === 'research') {
      push('fork_sibling', '建议分叉', '可选：接受后走 fork 命令口');
    } else if (role === 'conclusion') {
      push('open_report', '查看报告', '纯前端');
    }
  }

  const text = [
    `关于节点「${node.title}」（${role}）：`,
    message.trim(),
    '',
    proposals.length
      ? `我准备了 ${proposals.length} 个动作提案，请在 UI 确认后才会改图（chat 不会自动剪枝/分叉）。`
      : '暂无结构提案。',
  ].join('\n');

  return { text, proposals };
}

export function createNodeChatSseResponse(
  notebookId: number,
  runId: number,
  nodeId: string,
  body: ResearchNodeChatBody,
  requestSignal?: AbortSignal,
): Response {
  const row = requireRun(notebookId, runId);
  const graph = getGraph(row);
  const node = graph.nodes.find((n) => n.id === nodeId) as ResearchNode | undefined;
  if (!node) {
    throw new AppHttpError(ErrorCode.NOT_FOUND, `Node ${nodeId} not found`);
  }
  if (node.conclusionStatus === 'pruned') {
    throw new AppHttpError(ErrorCode.INVALID_REQUEST, `Cannot chat on pruned node ${nodeId}`);
  }

  // Mutual exclusion with work_unit (and other chat)
  if (row.llmActivity === 'work_unit' || activeLoops.has(runId)) {
    throw new AppHttpError(ErrorCode.RESEARCH_INVALID_STATE, '节点仍在研究中，请稍后再试对话');
  }
  if (row.llmActivity === 'node_chat') {
    throw new AppHttpError(ErrorCode.RESEARCH_INVALID_STATE, '该 Run 已有节点对话进行中');
  }

  const sse = (event: string, data: unknown): string =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  const key = chatKey(runId, nodeId);
  const ac = new AbortController();
  chatAbortControllers.set(key, ac);
  const onRequestAbort = () => ac.abort();
  requestSignal?.addEventListener('abort', onRequestAbort);

  updateRun(runId, { llmActivity: 'node_chat', activeNodeId: nodeId });
  appendProgressEvent(runId, 'chat_started', {
    nodeId,
    headline: '节点对话开始',
    payload: { messagePreview: body.message.slice(0, 80) },
  });

  const clearChatMutex = () => {
    const latest = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
    if (latest?.llmActivity === 'node_chat') {
      updateRun(runId, { llmActivity: null, activeNodeId: null });
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed || ac.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };
      // Bun.serve idleTimeout (default 10s) closes quiet SSE mid-flight. Emit
      // immediately and keep comment heartbeats while waiting on LLM TTFB.
      const heartbeat = setInterval(() => {
        if (closed || ac.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 8_000);
      try {
        emit('log', { message: 'connected', nodeId });

        if (ac.signal.aborted) {
          appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
          emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
          return;
        }

        const role = resolveNodeRole(node);
        const agent = await createResearchNodeAgent(notebookId);
        let proposals: ResearchNodeActionProposal[] = [];
        let usedAgent = false;

        if (agent) {
          try {
            usedAgent = true;
            const result = await agent.stream({
              prompt: body.message,
              abortSignal: ac.signal,
              options: {
                mode: 'node_chat' as const,
                role,
                nodeId: node.id,
                nodeTitle: node.title,
                nodeQuery: node.query,
                allowWeb: row.allowWeb,
                useNotebookSources: row.useNotebookSources,
                // ToolLoopAgent constructed with loosely typed settings
              } as never,
            });

            for await (const part of result.stream) {
              if (ac.signal.aborted) break;
              if (part.type === 'text-delta') {
                const text = 'text' in part ? String(part.text ?? '') : '';
                if (text) emit('chunk', { text });
              } else if (part.type === 'tool-approval-request') {
                const toolCall = (
                  part as {
                    toolCall?: { toolName?: string; toolCallId?: string; input?: unknown };
                  }
                ).toolCall;
                const proposal = proposalFromStructureToolCall({
                  toolName: toolCall?.toolName ?? '',
                  toolCallId: toolCall?.toolCallId,
                  args: toolCall?.input,
                });
                if (proposal) {
                  proposals.push(proposal);
                  emit('proposal', proposal);
                }
              } else if (part.type === 'tool-call') {
                // Fallback if a Structure tool somehow streams without approval
                const tc = part as {
                  toolName?: string;
                  toolCallId?: string;
                  input?: unknown;
                };
                const proposal = proposalFromStructureToolCall({
                  toolName: tc.toolName ?? '',
                  toolCallId: tc.toolCallId,
                  args: tc.input,
                });
                if (proposal && !proposals.some((p) => p.id === proposal.id)) {
                  proposals.push(proposal);
                  emit('proposal', proposal);
                }
              } else if (part.type === 'error') {
                const message =
                  'error' in part && part.error instanceof Error
                    ? part.error.message
                    : 'Generation error';
                emit('error', { errorCode: ErrorCode.INTERNAL_ERROR, message });
                return;
              }
            }
          } catch (agentError) {
            // Fall back to deterministic stub when model/mock is unavailable
            usedAgent = false;
            if (ac.signal.aborted) throw agentError;
            console.warn('[research] node chat agent failed; using stub:', agentError);
          }
        }

        if (!usedAgent) {
          const turn = stubNodeChatTurn(node, body.message);
          proposals = turn.proposals;
          const chunkSize = 48;
          for (let i = 0; i < turn.text.length; i += chunkSize) {
            if (ac.signal.aborted) {
              appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
              emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
              return;
            }
            emit('chunk', { text: turn.text.slice(i, i + chunkSize) });
            await Bun.sleep(0);
          }
          for (const proposal of proposals) {
            if (ac.signal.aborted) break;
            emit('proposal', proposal);
          }
        }

        if (ac.signal.aborted) {
          appendProgressEvent(runId, 'chat_aborted', { nodeId, headline: '对话已中止' });
          emit('error', { errorCode: ErrorCode.INVALID_REQUEST, message: 'aborted' });
          return;
        }

        emit('done', { proposals });
        appendProgressEvent(runId, 'chat_finished', {
          nodeId,
          headline: '节点对话结束',
          payload: { proposalCount: proposals.length, via: usedAgent ? 'agent' : 'stub' },
        });
      } catch (error) {
        emit('error', {
          errorCode: error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR,
          message: String(error),
        });
      } finally {
        clearInterval(heartbeat);
        chatAbortControllers.delete(key);
        requestSignal?.removeEventListener('abort', onRequestAbort);
        clearChatMutex();
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      ac.abort();
      // Eager mutex release if the client/Bun drops the socket mid-flight.
      clearChatMutex();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  });
}
