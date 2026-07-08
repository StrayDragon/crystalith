## Approach

Vercel AI SDK v7 是统一 AI 运行时，覆盖 provider 抽象、agent loop、结构化输出、tool calling、流式生成、middleware。

### Provider Registry (Config-Driven, Whitelist + Dynamic Import)

**核心原则**: 配置驱动，不 hardcode provider。新增 provider 只需 config 改一行 + 注册表加一条映射。

```ts
// server/src/ai/provider-registry.ts
import type { LanguageModelV1 } from 'ai';

interface ProviderEntry {
  sdk: string; // npm 包名
  factory: string; // 工厂函数名
}

const KNOWN_PROVIDERS: Record<string, ProviderEntry> = {
  openai: { sdk: '@ai-sdk/openai', factory: 'createOpenAI' },
  anthropic: { sdk: '@ai-sdk/anthropic', factory: 'createAnthropic' },
  google: { sdk: '@ai-sdk/google', factory: 'createGoogleGenerativeAI' },
  deepseek: { sdk: '@ai-sdk/openai', factory: 'createOpenAI' }, // OpenAI-compatible
  'openai-compatible': { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
  groq: { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
  together: { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
  bedrock: { sdk: '@ai-sdk/amazon-bedrock', factory: 'createAmazonBedrock' },
};

export async function resolveModel(config: ModelConfig): Promise<LanguageModelV1> {
  const entry = KNOWN_PROVIDERS[config.provider];
  if (entry) {
    const mod = await import(entry.sdk);
    const factoryFn = mod[entry.factory] as (
      opts: Record<string, unknown>,
    ) => (modelId: string) => LanguageModelV1;
    return factoryFn({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      ...config.providerOptions,
    })(config.model);
  }
  // Advanced fallback: allow config to specify sdk + factory directly
  if (config.sdk && config.factory) {
    const mod = await import(config.sdk);
    const factoryFn = mod[config.factory] as (
      opts: Record<string, unknown>,
    ) => (modelId: string) => LanguageModelV1;
    return factoryFn({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      ...config.providerOptions,
    })(config.model);
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}
```

**安全说明**: `import('@ai-sdk/openai')` 不是 eval —— 只能加载已安装的 npm 包。能修改配置文件的攻击者已经拥有文件系统权限，`import()` 不增加攻击面。90% 的 provider 走 `openai-compatible` 路径，一行配置即可。

**配置示例** (`config/app.yaml`):

```yaml
models:
  defaults: { chat: 'gpt-4o', embedding: 'text-embedding-3-small' }
  available:
    - id: 'gpt-4o'
      provider: 'openai' # → KNOWN_PROVIDERS['openai'] → @ai-sdk/openai
      model: 'gpt-4o'
      apiKey: '{{ secret.OPENAI_API_KEY }}'
      options: { temperature: 0.7, maxTokens: 4096 }
    - id: 'gateway-chat'
      provider: 'openai-compatible' # → KNOWN_PROVIDERS['openai-compatible']
      model: '{{ env.MODEL_NAME }}'
      apiKey: '{{ secret.LOCAL_KEY }}'
      baseUrl: 'http://127.0.0.1:50256/v1'
```

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
          try {
            return await doGenerate();
          } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
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

- ai@^7 — core SDK
- @ai-sdk/openai@^4
- @ai-sdk/anthropic@^4
- @ai-sdk/google@^4
- @ai-sdk/deepseek@^3
- @ai-sdk/openai-compatible@^1 — 覆盖 90% 自定义/本地网关 provider
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
