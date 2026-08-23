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
        }
      };
      try {
        unsub = await streamRun(notebookId, runId, emit);
        // Keep connection open until client cancels or run reaches terminal
        // and a short grace period. Poll status for terminal close.
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (closed) {
              resolve();
              return;
            }
            const row = db().select().from(researchRuns).where(eq(researchRuns.id, runId)).get();
            if (
              row &&
              (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled')
            ) {
              // Allow final events to flush
              setTimeout(() => {
                resolve();
              }, 50);
              return;
            }
            setTimeout(tick, 100);
          };
          tick();
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
    },
  });

  return sseResponse(stream);
}
