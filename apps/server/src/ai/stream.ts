import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { ChatTurn, Citation, ContextStats } from '@crystalith/shared';
// Streaming — relay Vercel AI SDK `streamText` stream parts into SSE
// events compatible with the v1 frontend chat consumer (`useChat.ts`).
//
// SSE event contract (backward-compatible with v1):
//   event: chunk\ndata: {"text":"..."}\n\n
//   event: state_snapshot\ndata: {"messageId":123}\n\n
//   event: done\ndata: {"messageId":123,"citations":[...]}\n\n
//   event: error\ndata: {"message":"..."}\n\n
import { streamText, isStepCount } from 'ai';
import type { Tool } from 'ai';

import { sseFrame, sseResponse } from '../shared/sse-response.ts';

export interface StreamQaOptions {
  model: LanguageModelV4;
  systemPrompt: string;
  messages: ChatTurn[];
  /** AI SDK tools (retrieveSources, webSearch, ...). */
  tools?: Record<string, Tool>;
  /** Max agent-loop steps (bounded by isStepCount). */
  maxSteps?: number;
  /** Stable message id assigned to the assistant message (for state_snapshot). */
  messageId?: number;
  /** Citations computed after retrieval (attached to the done event). */
  citationsResolver?: () => Citation[] | Promise<Citation[]>;
  /**
   * Optional localized notice emitted as a trailing chunk after generation
   * settles and appended to the persisted answer text (e.g. weak-grounding
   * tips). No effect on the generated content itself.
   */
  settleNotice?: string;
  /** Confidence score in [0,1] computed from evidence (attached to done). */
  confidenceResolver?: () => number | Promise<number> | undefined;
  /**
   * Async callback that receives resolved citations and returns a no-evidence
   * reason string (or undefined). Called after citationsResolver for dynamic
   * detection (v1 5-reason parity).
   */
  noEvidenceResolver?: (citations: Citation[]) => Promise<string | undefined> | string | undefined;
  /**
   * Context stats (v1 ContextStats) attached to the done event when pre-computed
   * by the deterministic retrieval stage (c36). c54: type now sourced from
   * @crystalith/shared instead of a duplicated inline struct.
   */
  contextStats?: ContextStats;
  /**
   * Optional sink for tool-result events emitted during the stream loop.
   * Each tool call's result is forwarded here so the caller can accumulate
   * retrieved chunks (or other tool outputs) for citation resolution.
   */
  onToolResult?: (toolName: string, result: unknown) => void;
  /**
   * Optional lifecycle hook for the provisional assistant message.
   * Called once when the stream settles: `accumulatedText` is the full
   * concatenated answer, `failed` is true if the stream errored/aborted,
   * `citations` are resolved for persistence (v1 finalize citations=).
   * Callers use this to persist the final content on success, or delete the
   * empty placeholder on failure (mirrors v1 api.py:550-557).
   */
  onMessageSettled?: (accumulatedText: string, failed: boolean, citations?: Citation[]) => void;
}

/** SSE-encode a single event. Delegates to the shared SSE helper. */
export function sseEvent(event: string, data: unknown): string {
  return sseFrame(event, data);
}

/** Drop XML-shaped tool invocations some models leak into the answer text. */
function stripLeakedToolCallXml(text: string): string {
  return text
    .replace(/<tool_call\b[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<tool_call\b[\s\S]*$/gi, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Run a streaming QA agent loop and return a `Response` whose body is an SSE
 * stream. The stream emits `chunk` (text deltas), `state_snapshot` (message
 * id), `done` (final citations), and `error` events.
 */
export function streamQaResponse(opts: StreamQaOptions): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // Emit the stable message id early so the frontend can create the
        // assistant message placeholder before the first text delta.
        if (opts.messageId !== undefined) {
          emit('state_snapshot', { messageId: opts.messageId });
        }

        const result = streamText({
          model: opts.model,
          instructions: opts.systemPrompt,
          messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
          tools: opts.tools,
          stopWhen: isStepCount(opts.maxSteps ?? 5),
        });

        let accumulated = '';
        for await (const part of result.stream) {
          // Relay text deltas and errors to the SSE stream; forward tool
          // results to the caller's sink (so it can accumulate retrieved
          // chunks for citation resolution). Other part types (reasoning,
          // finish markers) are consumed internally.
          if (part.type === 'text-delta') {
            const text = part.text;
            if (text) {
              accumulated += text;
              emit('chunk', { text });
            }
          } else if (part.type === 'tool-result') {
            opts.onToolResult?.(part.toolName, part.output);
          } else if (part.type === 'error') {
            const message =
              part.error instanceof Error
                ? part.error.message
                : typeof part.error === 'string'
                  ? part.error
                  : 'Generation error';
            emit('error', { message });
          }
        }

        // Trailing localized notice (weak-grounding tips): emitted as its own
        // chunk AND folded into the persisted text so stream and storage agree.
        if (opts.settleNotice) {
          accumulated += opts.settleNotice;
          emit('chunk', { text: opts.settleNotice });
        }

        const citations = opts.citationsResolver ? await opts.citationsResolver() : [];

        const noEvidence = opts.noEvidenceResolver
          ? await opts.noEvidenceResolver(citations)
          : undefined;

        emit('done', {
          messageId: opts.messageId ?? null,
          citations,
          confidence: opts.confidenceResolver ? await opts.confidenceResolver() : undefined,
          evidence: !noEvidence,
          noEvidenceReason: noEvidence,
          context: opts.contextStats,
          createdAt: new Date().toISOString(),
          toolCalls: [],
        });

        opts.onMessageSettled?.(stripLeakedToolCallXml(accumulated), false, citations);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream failed';
        emit('error', { message });
        opts.onMessageSettled?.('', true, []);
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
