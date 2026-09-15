// Research domain — run SSE stream (replay + live tail).
// Extracted from commands.ts (elysia review B1): single-concern modules,
// consumers keep importing from ./commands.ts (facade re-exports).
import type { ResearchGraphPatch } from '@crystalith/shared';
import { eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { researchRuns } from '../../db/schema.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { sseFrame, sseResponse } from '../../shared/sse-response.ts';
import {
  CONFIRM_OPTIONS,
  getGraph,
  isTerminalStatus,
  requireRun,
  subscribeRun,
  type SseEmit,
} from './research-core.ts';

/** Replay current state to a new SSE subscriber, then keep listening. */
export async function streamRun(
  notebookId: number,
  runId: number,
  emit: SseEmit,
): Promise<() => void> {
  const row = requireRun(notebookId, runId);
  const unsub = subscribeRun(runId, emit);
  emit('status', { status: row.status });
  const graph = getGraph(row);
  if (graph.nodes.length || graph.edges.length) {
    emit('graph_patch', {
      nodes: graph.nodes,
      edges: graph.edges,
    } satisfies ResearchGraphPatch);
  }
  if (row.status === 'awaiting_confirm' && row.confirmKind) {
    emit('confirm', {
      kind: row.confirmKind,
      branchNodeId: row.confirmBranchNodeId ?? undefined,
      options: row.confirmKind ? CONFIRM_OPTIONS[row.confirmKind] : [],
    });
  }
  if (row.status === 'completed') {
    emit('report_ready', { runId });
  }
  return unsub;
}

export function createResearchSseResponse(notebookId: number, runId: number): Response {
  requireRun(notebookId, runId);

  let unsub: (() => void) | undefined;
  // Set by the terminal waiter; invoked when the client side dies so the
  // waiter resolves immediately instead of waiting for its next tick.
  let onClosed: (() => void) | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit: SseEmit = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data)));
        } catch {
          closed = true;
          onClosed?.();
        }
      };
      try {
        unsub = await streamRun(notebookId, runId, emit);
        // Keep the connection open until the client cancels or the run
        // reaches a terminal state. Terminal is signalled primarily by the
        // in-process status broadcast (subscribeRun fan-out); the DB poll
        // below is only a slow fallback for a missed broadcast (c64) — no
        // more per-subscriber 100ms hot loop.
        await new Promise<void>((resolve) => {
          let done = false;
          let unsubStatus: () => void = () => undefined;

          const settleTerminal = () => {
            if (done) return;
            done = true;
            unsubStatus();
            // Allow final events to flush before closing.
            setTimeout(resolve, 50);
          };
          const settleClosed = () => {
            if (done) return;
            done = true;
            unsubStatus();
            resolve();
          };

          unsubStatus = subscribeRun(runId, (event, data) => {
            if (event !== 'status') return;
            const status = (data as { status?: string } | undefined)?.status;
            if (typeof status === 'string' && isTerminalStatus(status)) settleTerminal();
          });
          onClosed = settleClosed;

          const slowTick = () => {
            if (done) return;
            const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
            if (row && isTerminalStatus(row.status)) {
              settleTerminal();
              return;
            }
            setTimeout(slowTick, 2000);
          };
          slowTick();
        });
      } catch (error) {
        emit('error', {
          errorCode: error instanceof AppHttpError ? error.code : ErrorCode.INTERNAL_ERROR,
          message: String(error),
        });
      } finally {
        unsub?.();
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
      closed = true;
      unsub?.();
      onClosed?.();
    },
  });

  return sseResponse(stream);
}
