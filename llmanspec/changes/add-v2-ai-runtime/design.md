## Approach

Vercel AI SDK v7 是统一 AI 运行时，覆盖 provider 抽象、agent loop、结构化输出、tool calling、流式生成、middleware。

### Provider Registry

```ts
// server/src/ai/providers.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';

export function createProvider(type: string, config: { apiKey: string; baseURL?: string }) {
  switch (type) {
    case 'openai': return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    case 'anthropic': return createAnthropic({ apiKey: config.apiKey, baseURL: config.baseURL });
    case 'google': return createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    case 'deepseek': return createDeepSeek({ apiKey: config.apiKey, baseURL: config.baseURL });
    default: throw new Error(`Unsupported provider: ${type}`);
  }
}

// Usage: createProvider('openai', { apiKey })('gpt-4o')
```

关键点：
- AI SDK v7 使用 `createXxx({ apiKey })` factory → 返回函数 `(modelId) => LanguageModelV4`
- 每个 provider 包独立安装（tree-shaking）
- baseURL 支持自定义兼容端点

### Agent Loop (streamText + tools + maxSteps)

```ts
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: provider('gpt-4o'),
  system: 'You are a RAG assistant.',
  messages: conversationHistory,
  maxSteps: 5,
  tools: {
    retrieveSources: tool({
      description: 'Retrieve relevant chunks from the notebook',
      parameters: z.object({ query: z.string(), topK: z.number().default(5) }),
      execute: async ({ query, topK }) => {
        return await ragService.retrieve(notebookId, query, topK);
      },
    }),
  },
});

// SSE relay
for await (const chunk of result.fullStream) {
  // chunk.type: 'text-delta' | 'tool-call' | 'tool-result' | 'finish'
}
```

关键点：
- `maxSteps` 控制 agent loop 最大轮次
- tools 可以是 `tool()` from ai 或 `dynamicTool()` from provider-utils
- fullStream 可用于自定义 SSE 中继（Elysia ReadableStream）

### Structured Output (generateObject)

```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: provider('gpt-4o'),
  schema: z.object({
    title: z.string(),
    sections: z.array(z.object({ heading: z.string(), content: z.string() })),
  }),
  system: 'Generate structured output.',
  prompt: userPrompt,
});
```

Or use the newer `Output.object()` pattern (AI SDK v7):
```ts
import { generateText, Output } from 'ai';
const { output } = await generateText({
  model: provider('gpt-4o'),
  output: Output.object({ schema: FaqSchema }),
  prompt: 'Generate FAQ.',
});
```

### Streaming (SSE → Elysia)

```ts
// Elysia endpoint
app.post('/v2/qa/stream', async ({ body }) => {
  const result = streamText({ ... });
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

### Middleware

```ts
import { wrapLanguageModel } from 'ai';

function withRetry(model: LanguageModelV4, maxRetries = 3) {
  return wrapLanguageModel({
    model,
    middleware: {
      async wrapGenerate({ doGenerate }) {
        for (let i = 0; i < maxRetries; i++) {
          try { return await doGenerate(); }
          catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
        }
        throw new Error('unreachable');
      },
    },
  });
}
```

### Token Counting

```ts
import { encode } from 'gpt-tokenizer';
const count = encode(text).length;
```

gpt-tokenizer v3 纯 JS，零 wasm，支持 cl100k_base (GPT-4/GPT-3.5) 和 o200k_base (GPT-4o)。

### Dependencies

- ai@^7.0 — core SDK
- @ai-sdk/openai@^4, @ai-sdk/anthropic@^4, @ai-sdk/google@^4, @ai-sdk/deepseek@^3
- gpt-tokenizer@^3.4
- zod@^4 (shared with frontend)

### Migration note

BREAKING: pydantic-ai + pydantic-graph + langchain-community 全部替换。
Pattern 映射：
- pydantic-ai Agent.run() → AI SDK streamText + maxSteps + tools
- pydantic-ai output_type → generateObject(schema: Zod) or Output.object()
- pydantic-graph BaseNode → async function chain + generateObject
- tiktoken → gpt-tokenizer
- SearxSearchWrapper → fetch()
