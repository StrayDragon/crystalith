/**
 * Minimal OpenAI-compatible chat gateway for Playwright e2e (c100 / L1=B).
 * Enough for AI SDK openai-compatible clients to get a 200 + assistant text.
 * Structured decompose still prefers CL_RESEARCH_E2E_STUB (L1=A).
 */
const port = Number(process.env.CL_E2E_MOCK_GATEWAY_PORT ?? '18039');

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/v1/health')) {
      return json({ status: 'ok', service: 'e2e-mock-openai' });
    }
    if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
      return json({
        id: 'chatcmpl-e2e',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'e2e-mock',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                branches: [
                  { title: '支路A', query: 'e2e A', edgeKind: 'decompose' },
                  { title: '支路B', query: 'e2e B', edgeKind: 'decompose' },
                ],
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }
    if (req.method === 'POST' && url.pathname.includes('/embeddings')) {
      // Dimension MUST match apps/server/src/db/vectors.ts DEFAULT_EMBEDDING_DIM (vec0 table).
      // A mismatch makes every insert fail with EMBEDDING_FAILED.
      // One embedding per input value — real providers return data[] aligned
      // with the request's input array; short lists become zero-length vectors.
      const body = (await req.json()) as { input: string | string[] };
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      return json({
        object: 'list',
        data: inputs.map((_, i) => ({
          object: 'embedding',
          index: i,
          embedding: Array.from({ length: 1024 }, () => 0.01),
        })),
        model: 'e2e-embed',
      });
    }
    return json({ error: { message: `e2e mock: no route ${req.method} ${url.pathname}` } }, 404);
  },
});

console.log(`[e2e-mock-openai] listening on http://127.0.0.1:${server.port}`);
