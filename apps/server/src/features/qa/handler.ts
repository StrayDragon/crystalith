import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Citation, ChatTurn } from '@crystalith/shared';
// QA handler — deterministic retrieval + streamText generation.
//
// c36: aligned with v1 `run_qa_pipeline`. The retrieval+judgment is now
// deterministic (retrieveAndJudge runs BEFORE generation). If no evidence is
// found, the no-evidence answer is streamed directly without an LLM call.
// When evidence is found, the retrieved context is injected into the system
// prompt and streamText generates the answer with inline citations.
import {
  retrieveAndJudge,
  noEvidenceAnswerForReason,
  resolveCitations,
  type NoEvidenceReason,
  type JudgeResult,
  type ContextStats,
} from './retrieve-and-judge.ts';
import { streamQaResponse } from '../../ai/stream.ts';

// Re-export for consumers (router, presets)
export { retrieveAndJudge, noEvidenceAnswerForReason, resolveCitations };
export type { NoEvidenceReason, JudgeResult, ContextStats };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QaHandlerOptions {
  model: LanguageModelV4;
  question: string;
  notebookId: number;
  history: ChatTurn[];
  systemPrompt: string;
  messageId?: number;
  maxSteps?: number;
  /** RAG strategy id override. */
  strategyId?: string;
  /** Retrieval top-K (default 5). */
  topK?: number;
  /** Minimum similarity score (default 0.2, v1 EVIDENCE_THRESHOLD_DEFAULT). */
  minScore?: number;
  /** Scope retrieval to specific sources (v1 source_ids). */
  sourceIds?: number[];
  /** Lifecycle hook for the provisional assistant message. */
  onMessageSettled?: (accumulatedText: string, failed: boolean) => void;
}

// ---------------------------------------------------------------------------
// Stream handler
// ---------------------------------------------------------------------------

/**
 * Run streaming QA with deterministic retrieval + RAG context injection.
 *
 * Flow (v1-aligned):
 * 1. retrieveAndJudge() — deterministic embed + search + evidence judgment
 * 2. If no evidence → stream the localized no-evidence answer directly
 * 3. If evidence → inject context into system prompt, streamText generates
 *
 * Returns a Response with SSE event stream.
 */
export async function streamQa(opts: QaHandlerOptions): Promise<Response> {
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? 0.2;

  // Step 1: Deterministic retrieval + judgment
  const historyTokens = estimateTokens(opts.history.map((m) => m.content).join(' '));
  const judgment = await retrieveAndJudge({
    notebookId: opts.notebookId,
    question: opts.question,
    sourceIds: opts.sourceIds,
    topK,
    minScore,
    strategyId: opts.strategyId,
    historyTokens,
  });

  // Step 2: No evidence → short-circuit with localized answer
  if (!judgment.evidence) {
    const answer = noEvidenceAnswerForReason(judgment.reason ?? null);
    return streamNoEvidence(answer, judgment, opts);
  }

  // Step 3: Evidence found → generate with context injection
  const systemWithContext = `${opts.systemPrompt}\n\nSource material:\n${judgment.context}`;

  return streamQaResponse({
    model: opts.model,
    systemPrompt: systemWithContext,
    messages: [...opts.history, { role: 'user' as const, content: opts.question }],
    maxSteps: opts.maxSteps ?? 1, // no tool calls needed — context is pre-injected
    messageId: opts.messageId,
    citationsResolver: async () => judgment.citations,
    confidenceResolver: async () => judgment.confidence,
    noEvidenceResolver: async () => judgment.reason,
    contextStats: judgment.contextStats,
    onMessageSettled: opts.onMessageSettled,
  });
}

/**
 * Stream a no-evidence answer as SSE without invoking the LLM.
 * Emits chunk + done events matching the normal stream shape.
 */
function streamNoEvidence(
  answer: string,
  judgment: JudgeResult,
  opts: QaHandlerOptions,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        if (opts.messageId !== undefined) {
          emit('state_snapshot', { message_id: opts.messageId });
        }

        // Stream the no-evidence answer as a single chunk
        emit('chunk', { text: answer });

        emit('done', {
          message_id: opts.messageId ?? null,
          citations: judgment.citations,
          confidence: 0,
          evidence: false,
          no_evidence_reason: judgment.reason,
          context: judgment.contextStats,
          created_at: new Date().toISOString(),
          tool_calls: [],
        });

        opts.onMessageSettled?.(answer, false);
      } catch {
        opts.onMessageSettled?.('', true);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** Rough token estimate (~4 chars/token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
