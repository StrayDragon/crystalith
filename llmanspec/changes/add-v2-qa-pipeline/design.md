## Approach

### SSE Streaming Pattern

Elysia 返回 ReadableStream → `text/event-stream`:

```ts
app.post('/v2/qa/stream', async ({ body }) => {
  const { question, notebook_id, session_id } = body;
  const result = streamText({
    model: getModel(session_id),
    system: getPreset(session_id),
    messages: [...history, { role: 'user', content: question }],
    maxSteps: 5,
    tools: {
      retrieveSources: tool({
        description: 'Retrieve relevant chunks from the notebook',
        parameters: z.object({ query: z.string(), topK: z.number().default(5) }),
        execute: async ({ query, topK }) => {
          const chunks = await ragService.retrieve(notebook_id, query, topK);
          return chunks.map(c => ({ id: c.id, text: c.text, source: c.source, page: c.page }));
        },
      }),
    },
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of result.fullStream) {
          controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
});
```

SSE events: `text-delta`, `tool-call`, `tool-result`, `finish`

### Citation Mapping

LLM 生成的回答通过 `retrieveSources` tool 返回的 chunk metadata 自动映射引用:

```ts
// citations endpoint
GET /v2/notebooks/:nid/sessions/:sid/messages/:mid/citations
→ [{ chunk_id, source_id, page, text_preview }]
```

### Presets

QA system prompt 通过 preset 管理:
```ts
// config/presets.ts
export const defaultPreset = 'You are a helpful RAG assistant. Answer based on provided context with citations.';
export const analysisPreset = 'You are a deep analysis assistant. Identify patterns, contradictions, and implications.';
```

### Migration note

- v1 `shared/ui_state.py` Rivu state → v2 message-embedded `components?: UIMount[]`
- v1 SSE `state_snapshot`/`state_delta` → v2 SSE `text-delta`/`tool-call`/`tool-result`
- Agent tool calling replaces manual RAG pipeline
