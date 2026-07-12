import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { ChatTurn, Citation } from '@crystalith/shared';
import { generateText } from 'ai';

import { streamQaResponse } from '../../ai/stream.ts';
import { countTokens } from '../../ai/tokenizer.ts';
import { parseStatsPresetOutput } from './presets.ts';
// QA handler — deterministic retrieval + streamText generation.
//
// c36: aligned with v1 `run_qa_pipeline`. The retrieval+judgment is now
// deterministic (retrieveAndJudge runs BEFORE generation). If no evidence is
// found, the no-evidence answer is streamed directly without an LLM call.
// When evidence is found, the retrieved context is injected into the system
// prompt and streamText generates the answer with inline citations.
//
// c48: stats preset routes through a dedicated JSON-parse path (v1
// api.py:289-304,457-504): generate → parseStatsPresetOutput → use
// fallback_markdown as the answer.
import {
  retrieveAndJudge,
  noEvidenceAnswerForReason,
  resolveCitations,
  type NoEvidenceReason,
  type JudgeResult,
  type ContextStats,
} from './retrieve-and-judge.ts';

// Re-export for consumers (router, presets)
export { retrieveAndJudge, noEvidenceAnswerForReason, resolveCitations };
export type { NoEvidenceReason, JudgeResult, ContextStats };

// ---------------------------------------------------------------------------
// c45: Inline citation fallback (v1 _ensure_inline_citations, api.py:107-112)
// ---------------------------------------------------------------------------

/**
 * If the answer has no [N] style inline citations but we have citations,
 * append [1] as a fallback marker (v1 behavior).
 */
export function ensureInlineCitations(
  answer: string,
  citations: import('@crystalith/shared').Citation[],
): string {
  if (!citations.length) return answer;
  if (answer.includes('[') && answer.includes(']')) return answer;
  return `${answer} [1]`;
}

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
  /** c48: resolved preset id — 'stats' routes through JSON-parse path. */
  preset?: string;
  /** Lifecycle hook for the provisional assistant message (includes citations). */
  onMessageSettled?: (
    accumulatedText: string,
    failed: boolean,
    citations?: import('@crystalith/shared').Citation[],
  ) => void;
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

  // c48: stats preset (v1 api.py:457-504) — generate full text non-streamed,
  // parse JSON, then stream fallback_markdown in chunks. Falls through to
  // normal streaming generation if JSON parsing fails.
  if (opts.preset === 'stats') {
    const systemWithContext = `${opts.systemPrompt}\n\nSource material:\n${judgment.context}`;
    try {
      const { text } = await generateText({
        model: opts.model,
        system: systemWithContext,
        messages: [...opts.history, { role: 'user' as const, content: opts.question }],
      });
      const parsed = parseStatsPresetOutput(text);
      if (parsed) {
        const answer = ensureInlineCitations(parsed.fallback_markdown, judgment.citations);
        return streamStatsAnswer(answer, judgment, opts);
      }
      // parse failed → fall through to normal streaming with the raw text's system
    } catch {
      // generation failed → fall through to normal streaming (will re-generate)
    }
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
    onMessageSettled: (text, failed, citations) => {
      // c45: apply inline citation fallback before persisting
      const finalText = failed ? text : ensureInlineCitations(text, citations ?? []);
      opts.onMessageSettled?.(finalText, failed, citations);
    },
  });
}

/**
 * Stream a no-evidence answer as SSE without invoking the LLM.
 * Emits chunk + done events matching the normal stream shape.
 */
function streamNoEvidence(answer: string, judgment: JudgeResult, opts: QaHandlerOptions): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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

/**
 * c48: Stream a stats-preset answer (evidence=true) as SSE. The answer was
 * already generated+parsed non-streamed; here we emit it in 240-char chunks
 * (v1 chunk_size, api.py:478-484) then a done event with full metadata.
 */
function streamStatsAnswer(
  answer: string,
  judgment: JudgeResult,
  opts: QaHandlerOptions,
): Response {
  const encoder = new TextEncoder();
  const chunkSize = 240;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (opts.messageId !== undefined) {
          emit('state_snapshot', { message_id: opts.messageId });
        }
        for (let i = 0; i < answer.length; i += chunkSize) {
          emit('chunk', { text: answer.slice(i, i + chunkSize) });
        }
        emit('done', {
          message_id: opts.messageId ?? null,
          citations: judgment.citations,
          confidence: judgment.confidence,
          evidence: true,
          no_evidence_reason: null,
          context: judgment.contextStats,
          created_at: new Date().toISOString(),
          tool_calls: [],
        });
        opts.onMessageSettled?.(answer, false, judgment.citations);
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

/** c48: real token count via gpt-tokenizer (was char estimate). */
function estimateTokens(text: string): number {
  return countTokens(text);
}

// ---------------------------------------------------------------------------
// H7: Non-streaming QA — direct generate (replaces SSE re-parse)
// ---------------------------------------------------------------------------

export interface QaDirectResult {
  answer: string;
  citations: Citation[];
  confidence: number;
  evidence: boolean;
  noEvidenceReason: string | undefined;
  contextStats: import('./retrieve-and-judge.ts').ContextStats;
}

/**
 * Run QA with deterministic retrieval + direct generation (no SSE).
 * H7: replaces the old approach of generating an SSE stream then parsing it back.
 * Uses generateText instead of streamText for the non-streaming path.
 */
export async function generateQaDirect(opts: QaHandlerOptions): Promise<QaDirectResult> {
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? 0.2;

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

  // No evidence → short-circuit
  if (!judgment.evidence) {
    const answer = noEvidenceAnswerForReason(judgment.reason ?? null);
    opts.onMessageSettled?.(answer, false);
    return {
      answer,
      citations: judgment.citations,
      confidence: 0,
      evidence: false,
      noEvidenceReason: judgment.reason ?? undefined,
      contextStats: judgment.contextStats,
    };
  }

  // Evidence found → generate with context injection (direct, no SSE)
  const systemWithContext = `${opts.systemPrompt}\n\nSource material:\n${judgment.context}`;
  const { text } = await generateText({
    model: opts.model,
    system: systemWithContext,
    messages: [...opts.history, { role: 'user' as const, content: opts.question }],
  });

  // c48: stats preset — parse JSON output and use fallback_markdown as the
  // answer (v1 api.py:289-304). If parsing fails, fall through to normal text.
  let answerText = text;
  if (opts.preset === 'stats') {
    const parsed = parseStatsPresetOutput(text);
    if (parsed) {
      answerText = parsed.fallback_markdown;
    }
  }

  // Apply inline citation fallback
  const finalText = ensureInlineCitations(answerText, judgment.citations);
  opts.onMessageSettled?.(finalText, false, judgment.citations);

  return {
    answer: finalText,
    citations: judgment.citations,
    confidence: judgment.confidence,
    evidence: true,
    noEvidenceReason: undefined,
    contextStats: judgment.contextStats,
  };
}
