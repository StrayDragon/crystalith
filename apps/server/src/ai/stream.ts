import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Citation, ChatTurn } from '@crystalith/shared';
// Streaming — relay Vercel AI SDK `streamText` fullStream parts into SSE
// events compatible with the v1 frontend chat consumer (`useChat.ts`).
//
// SSE event contract (backward-compatible with v1):
//   event: chunk\ndata: {"text":"..."}\n\n
//   event: state_snapshot\ndata: {"message_id":123}\n\n
//   event: done\ndata: {"message_id":123,"citations":[...]}\n\n
//   event: error\ndata: {"message":"..."}\n\n
import { streamText, isStepCount } from 'ai';
import type { Tool } from 'ai';

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
   * by the deterministic retrieval stage (c36).
   */
  contextStats?: { total: number; system: number; history: number; retrieval: number; query: number; max_tokens: number };
  /**
   * Optional sink for tool-result events emitted during the fullStream loop.
   * Each tool call's result is forwarded here so the caller can accumulate
   * retrieved chunks (or other tool outputs) for citation resolution.
   */
  onToolResult?: (toolName: string, result: unknown) => void;
  /**
   * Optional lifecycle hook for the provisional assistant message.
   * Called once when the stream settles: `accumulatedText` is the full
   * concatenated answer, `failed` is true if the stream errored/aborted.
   * Callers use this to persist the final content on success, or delete the
   * empty placeholder on failure (mirrors v1 api.py:550-557).
   */
  onMessageSettled?: (accumulatedText: string, failed: boolean) => void;
}

/** SSE-encode a single event. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
          emit('state_snapshot', { message_id: opts.messageId });
        }

        const result = streamText({
          model: opts.model,
          system: opts.systemPrompt,
          messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
          tools: opts.tools,
          stopWhen: isStepCount(opts.maxSteps ?? 5),
        });

        let accumulated = '';
        for await (const part of result.fullStream) {
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

        const citations = opts.citationsResolver ? await opts.citationsResolver() : [];

        const noEvidence = opts.noEvidenceResolver
          ? await opts.noEvidenceResolver(citations)
          : undefined;

        emit('done', {
          message_id: opts.messageId ?? null,
          citations,
          confidence: opts.confidenceResolver ? await opts.confidenceResolver() : undefined,
          evidence: !noEvidence,
          no_evidence_reason: noEvidence,
          context: opts.contextStats,
          created_at: new Date().toISOString(),
          tool_calls: [],
        });

        opts.onMessageSettled?.(accumulated, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream failed';
        emit('error', { message });
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
