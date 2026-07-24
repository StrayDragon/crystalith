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
  fetch(req) {
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
      return json({
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: Array.from({ length: 8 }, () => 0.01) }],
        model: 'e2e-embed',
      });
    }
    return json({ error: { message: `e2e mock: no route ${req.method} ${url.pathname}` } }, 404);
  },
});

console.log(`[e2e-mock-openai] listening on http://127.0.0.1:${server.port}`);
