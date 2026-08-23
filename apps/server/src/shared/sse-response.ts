// Shared SSE helpers — single source for frame formatting and response
// headers across qa / research / studio / ai streaming endpoints.
//
// History: framing + headers were copy-pasted 6× with drifting header sets
// (some sites missing `x-accel-buffering`, others missing
// `Connection: keep-alive`). Consolidated during the elysia idiom review.

export type SseFrame = (event: string, data: unknown) => string;

/** Format one SSE event frame (`event:` + `data:` JSON + blank line). */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Canonical proxy-friendly SSE headers (no buffering, keep connection alive). */
export const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
} as const;

/** Build an SSE Response from a byte stream with canonical headers. */
export function sseResponse(
  stream: ReadableStream<Uint8Array>,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(stream, {
    headers: { ...SSE_HEADERS, ...extraHeaders },
  });
}
