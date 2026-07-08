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

        for await (const part of result.fullStream) {
          // Only relay text deltas and errors to the SSE stream. Tool calls,
          // reasoning, source citations, and finish markers are consumed
          // internally — the frontend renders tool-call cards from the
          // `done` event payload, and citations from the resolver.
          if (part.type === 'text-delta') {
            const text = part.text;
            if (text) emit('chunk', { text });
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

        emit('done', {
          message_id: opts.messageId ?? null,
          citations,
          tool_calls: [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream failed';
        emit('error', { message });
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
