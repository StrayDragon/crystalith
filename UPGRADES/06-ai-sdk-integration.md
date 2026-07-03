# 06 — Vercel AI SDK 作为 Agent 运行时（专题）

> 调研结论：**Vercel AI SDK 是 crystalith v2 AI 层的唯一基础**。它已从「LLM 调用库」进化为完整的 Agent 运行时——Provider 抽象、Agent Loop（`maxSteps`）、结构化输出（`generateObject`/`streamObject`）、Tool Calling、Multi-modal、Telemetry、Middleware 一应俱全。https://ai-sdk.dev/docs/introduction
>
> 本文档补充 [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md)：详述 Vercel AI SDK 在 crystalith 各场景下的最佳实践。

## 一、AI SDK 核心能力地图

Vercel AI SDK 的核心模块完全满足本项目需求：

| 能力 | AI SDK 对应 | 覆盖场景 |
|------|------------|---------|
| **Provider 抽象** | `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google` / `@ai-sdk/ollama` / `@ai-sdk/mistral` / `@ai-sdk/deepseek` / `@ai-sdk/groq` / `@ai-sdk/xai` / `@ai-sdk/amazon-bedrock` / `@ai-sdk/azure` / `@ai-sdk/cohere` / … | 替换 crystalith 的 `shared/ai/factory.py`（376 行） |
| **Agent Loop** | `streamText` + `maxSteps` → 多步 tool calling agent（思考→工具→结果→继续） | 替换 pydantic-ai `Agent.run()`，覆盖 QA/Research |
| **结构化输出** | `generateObject(schema: Zod)` / `streamObject(schema: Zod)` | 替换 pydantic-ai `output_type`，覆盖 7 种 Output 生成 |
| **Tool Calling** | `tool({ description, parameters: z.object(...), execute })` | 替换 pydantic-ai `@agent.tool`，覆盖 retrieval / web_search / mount_ui |
| **流式生成** | `streamText` → ReadableStream → SSE relay；前端 `useChat` hook | 替换 Python SSE 端点 + pydantic-ai `agent.iter()` |
| **Multi-modal** | `content: [{ type: "text" }, { type: "image" }]` 统一文件/图片/文本 | 未来图片理解/视觉 RAG |
| **Telemetry** | OpenTelemetry tracer（`experimental_telemetry`） | 替换 pydantic-ai `instrument` |
| **Middleware** | 请求/响应拦截、日志、重试、用户访问控制 | 替换 `shared/ai/retry.py`（233 行） |

## 二、Provider 层 ↔ crystalith `shared/ai/` 映射

AI SDK 的 `@ai-sdk/*` 系列 provider 包**官方维护**，且全部开源（Apache-2.0），覆盖所有主流 LLM 服务：

| crystalith 现状（Python） | AI SDK 对应 |
|------|------|
| `shared/ai/factory.py`（376 行 provider 工厂） | `import { createOpenAI } from "@ai-sdk/openai"` + 按需选 provider |
| `shared/ai/openai_provider.py` + `ollama_provider.py` | `@ai-sdk/openai` + `@ai-sdk/ollama`（原生 Ollama provider） |
| `shared/config/models.py`（1090 行模型配置） | `createOpenAI({ apiKey, baseURL, ... })(modelId)` 直传，极简 |
| `shared/config/ollama_discovery.py`（340 行端点探测） | ✂️ **直接砍掉**，桌面 app 配 `localhost:11434` 即可 |
| `shared/config/endpoint_candidates.py`（170 行） | ✂️ 同上 |
| `shared/ai/openai_client_manager.py` | `apiKey` 参数（支持 env / 直接传入） |
| `shared/ai/retry.py`（233 行重试策略） | AI SDK middleware 实现 retry，或自建薄 wrapper ~30 行 |
| `shared/ai/effective_settings.py`（模型设置映射） | `{ temperature, maxTokens, topP }` 直接传参 |

**Provider 初始化示例**（Bun 后端）：

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "@ai-sdk/ollama";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// OpenAI（云 API）
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Ollama（本地，桌面 app 默认）
const ollama = createOllama({ baseURL: "http://localhost:11434/api" });

// Anthropic（云 API）
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 模型实例：provider(modelId)
const model = openai("gpt-4o");
const localModel = ollama("qwen2.5:7b");
```

**收益**：砍掉 crystalith `shared/ai/` + `shared/config/` 的端点探测/多 provider 胶水约 **2000+ 行**，换成 AI SDK 官方 provider 包的声明式配置。

## 三、Agent 运行时：AI SDK 的 agent loop

AI SDK 通过 `streamText` + `maxSteps` 提供原生多步 agent loop，**无需额外 agent 框架**：

```typescript
import { streamText, tool } from "ai";
import { z } from "zod";

const result = streamText({
  model: openai("gpt-4o"),
  system: "你是 crystalith RAG 助手...",
  messages: conversationHistory,
  maxSteps: 10,  // 最多 10 轮思考→工具→结果循环
  tools: {
    retrieveSources: tool({
      description: "从 notebook 检索相关上下文",
      parameters: z.object({ query: z.string(), topK: z.number().default(5) }),
      execute: async ({ query, topK }) => {
        // sqlite-vec 向量检索 → 返回 chunks
        const chunks = await vectorStore.search(query, topK);
        return chunks.map(c => ({ id: c.id, text: c.text, source: c.source }));
      },
    }),
    webSearch: tool({
      description: "联网搜索补充信息",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const res = await fetch(`http://localhost:8888/search?q=${encodeURIComponent(query)}&format=json`);
        const data = await res.json();
        return data.results.slice(0, 5);
      },
    }),
    mountUI: tool({
      description: "在回复中嵌入图表/表格/交互组件",
      parameters: z.object({ type: z.enum(["chart", "table", "timeline"]), data: z.any() }),
      execute: async ({ type, data }) => ({ type, data }), // 前端取 tool result 渲染
    }),
  },
});

// 流式吐出给 SSE
for await (const chunk of result.fullStream) {
  // chunk.type === "text-delta" → 文字增量
  // chunk.type === "tool-call" → 工具调用开始
  // chunk.type === "tool-result" → 工具结果
}
```

### AI SDK Agent Loop vs pydantic-ai Agent

| 能力 | pydantic-ai | AI SDK (`streamText` + `maxSteps`) | 说明 |
|------|-------------|-------------------------------------|------|
| 多步 tool calling | `Agent.run()` + tools | `streamText` + `maxSteps` + `tools` | ✅ 对等 |
| 流式输出 | `agent.iter()` | `fullStream` async iterable | ✅ 对等 |
| 结构化输出 | `output_type=PydanticModel` | `generateObject(schema: Zod)`（独立 API） | ✅ 对等 |
| 依赖注入 | `deps_type` + `RunContext[Deps]` | 闭包 / `execute` 参数 | ⚠️ 需自管，TS 闭包更自然 |
| System Prompt | `system_prompt` | `system` 参数 | ✅ 对等 |
| 工具执行上下文 | `RunContext` | `execute` 函数闭包 | ✅ 对等 |
| 重试 | pydantic-ai retry policy | AI SDK middleware / 自建 ~30 行 | ⚠️ 需补 |

**结论**：AI SDK `streamText` + `maxSteps` 已完整覆盖 pydantic-ai 的 agent loop 能力，且更灵活（工具执行直接写 async 函数，无 DI 概念负担）。

## 四、crystalith 各 feature 的 AI SDK 重构思路

crystalith 现用 pydantic-graph 的「显式状态机图」与 AI SDK 的「agent loop + tool calling」是两种范式。迁移时把图的每个节点变成 **agent 工具**，让 agent loop 驱动：

### 1. QA 基础问答（`features/qa/`）— 最契合

```
AI SDK agent + retrieval 工具（搜 sqlite-vec → 返回带引用的 chunks）
```

用户提问 → agent 自主决定调 `retrieveSources(query)` 工具 → 拿到带 chunk_id 的上下文 → 生成带引用标记的回答。**完美替代 pydantic-ai Agent + 手动 RAG 拼接。**

```typescript
// qa/handler.ts
const result = streamText({
  model: getConfiguredModel(),
  system: "你是 crystalith 的 RAG 助手。先检索上下文再回答，必须标注引用来源。",
  messages: [{ role: "user", content: userQuery }],
  maxSteps: 5,
  tools: {
    retrieveSources: tool({
      description: "检索 notebook 中与问题相关的 chunk",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => await ragService.retrieve(notebookId, query),
    }),
  },
});
```

### 2. Outputs 结构化生成（`shared/agents/output_graph.py`，832 行图）

当前线性图 `ResolveContext → GenerateOutput → MapCitations → Postprocess → Persist`，用 **`generateObject`** 直接替代：

```typescript
import { generateObject } from "ai";

const { object: output } = await generateObject({
  model: openai("gpt-4o"),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      content: z.string(),
      citations: z.array(z.number()),
    })),
  }),
  system: "你是 crystalith 结构化输出引擎...",
  prompt: `根据以下资料生成 ${outputType} 格式的输出：\n${context}`,
});

// 后处理：映射引用 → 持久化（普通 async 函数链，不进 agent loop）
```

**建议**：Output 图保留为 **普通 async 函数链**（流水线语义），不进 agent loop。每种 output 类型一个 `generateObject` 调用 + 前后处理。

### 3. Citations 引用溯源（`features/citations/`）

做成 retrieval 工具的返回结构：`retrieveSources` 工具返回 `{ chunk_id, text, source_id, page }[]`，前端据此渲染高亮 + 跳转。后端 `citations/context` 端点保留为普通 CRUD 查询。

### 4. Research agentic 研究（`features/research/graph.py`，13 端点 + 图，**若保留**）

这是 AI SDK agent loop 的**最佳应用场景**：

```typescript
const result = streamText({
  model: openai("gpt-4o"),
  system: "你是 crystalith 研究 Agent。搜索 → 分析 → 综合 → 呈报。",
  messages: conversationHistory,
  maxSteps: 20, // 研究需要更多轮次
  tools: {
    webSearch: tool({ /* SearXNG fetch */ }),
    analyzeResults: tool({ /* LLM 分析搜索结果的子任务 */ }),
    writeReport: tool({
      description: "将研究发现写入报告",
      parameters: z.object({ content: z.string(), sections: z.array(z.string()) }),
      execute: async ({ content, sections }) => {
        await saveResearchReport(sessionId, { content, sections });
        return { saved: true };
      },
    }),
  },
});
```

AI SDK 的多轮 agent loop 天然支持「搜索→分析→综合→用户审批→继续」。**比手写 pydantic-graph 节省大量状态机代码。**

### 5. Studio/Slides（`features/studio/`，流式生成）

AI SDK `streamText` 的 `fullStream` 事件流直接对接前端流式幻灯片生成：

```typescript
// 后端
for await (const chunk of result.fullStream) {
  if (chunk.type === "text-delta") {
    ssEmit({ event: "text_delta", data: chunk.textDelta });
  }
}

// 前端
const { messages } = useChat({ api: "http://localhost:8032/api/v2/studio" });
```

## 五、AI SDK 前端集成（Elysia SSE + `useChat` hook）

AI SDK 的双端设计让前后端共享 tool 定义和 Zod schema。前端用 `useChat` hook 直接消费 SSE 流：

```typescript
// 前端组件
import { useChat } from "@ai-sdk/react";
// 或 Vercel 官方：import { useChat } from "ai/react";

function ChatPanel() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/v2/chat",   // Elysia 端点
  });
  // messages 自动更新（含 tool-call / tool-result 渲染）
}
```

若不想引入前端 `ai/react` 依赖（我们已有自己的 chat 状态管理），后端直接 emit SSE，前端用 `EventSource` 消费：

```typescript
// 后端 Elysia
app.post("/api/v2/chat", async ({ body }) => {
  const result = streamText({ /* ... */ });
  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of result.fullStream) {
          controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } }
  );
});
```

## 六、Middleware & Telemetry

AI SDK 的 middleware 系统覆盖重试、日志、访问控制：

```typescript
import { wrapLanguageModel } from "ai";

// 重试 middleware（替代 shared/ai/retry.py）
function withRetry(model: LanguageModelV1, maxRetries = 3) {
  return wrapLanguageModel({
    model,
    middleware: {
      async transformParams({ params }) { return params; },
      async wrapGenerate({ doGenerate }) {
        for (let i = 0; i < maxRetries; i++) {
          try { return await doGenerate(); }
          catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
        }
        throw new Error("unreachable");
      },
    },
  });
}

const model = withRetry(openai("gpt-4o"), 3);
```

OpenTelemetry 集成（替换 pydantic-ai `instrument`）：

```typescript
streamText({
  model,
  messages,
  experimental_telemetry: {
    isEnabled: true,
    tracer: myOtelTracer,
    functionId: "qa-agent",
    metadata: { notebookId, sessionId },
  },
});
```

## 七、收益与风险

### 收益（强）

1. **统一 AI 栈、零额外依赖**：Provider 抽象 + Agent Loop + 结构化输出 + 流式 + 多模态全部在一个官方生态中，不需要组合多个来源的包。
2. **官方维护、Apache-2.0 许可证**：无需担心私有 scope 许可证兼容性；长期稳定性有保障。
3. **Provider 覆盖广**：OpenAI / Anthropic / Google / Mistral / DeepSeek / Groq / Ollama / xAI / Bedrock / Azure / Cohere / … 全部官方 provider 包。
4. **前端 hooks 开箱即用**：`useChat` / `useCompletion` / `useObject` 减少前端状态管理代码。
5. **Tool system 天然契合 RAG**：retrieval/citation/webSearch 做成工具，agent 自主决策何时检索，比固定流水线更智能。
6. **TypeScript 一等公民**：API 设计深度拥抱 TS 类型系统，Zod schema 前后端共享。
7. **文档齐全**：https://ai-sdk.dev/docs 覆盖所有场景和每个 provider。

### 风险（低，均可控）

1. **Elysia SSE 兼容** — AI SDK 的 `streamText` 返回 Web `ReadableStream`，Elysia 完全支持。✅ 已验证（见 [08-web-framework](./08-web-framework-elysia-vs-hono.md)）。
2. **多步 agent loop** — `maxSteps` 已是 AI SDK 稳定特性。应对：Phase 0 spike 即验证。
3. **pydantic-graph 线性流水线迁移** — 流水线不进 agent loop，保留为普通 async 函数 + `generateObject`，语义更清晰且无范式差异。
4. **模型配置管理** — AI SDK 无内置"模型注册表"UI。应对：建一个薄的模型配置 CRUD 表（`model_configs`）+ 前端配置页即可。
5. **Ollama 原生** — `@ai-sdk/ollama` 已经是独立包，可用性良好。

## 八、建议落地

1. **Provider 层**：用 `@ai-sdk/openai` + `@ai-sdk/ollama` + `@ai-sdk/anthropic` 等按需引入，砍掉所有 Python provider 工厂代码。
2. **Agent 层**：`streamText` + `maxSteps` + `tools` 统一跑 QA/对话/Research。
3. **结构化输出**：`generateObject` / `streamObject` 覆盖 Output 生成、Eval LLM-as-Judge。
4. **生成流水线**（Output 图）：保留为普通 async 代码 + `generateObject`，不进 agent loop。
5. **工具化**：把 retrieval / citation / webSearch / mountUI 实现为 `tool()`，挂给 agent。
6. **P0 spike 增加**：在 Phase 0 加入「AI SDK streamText + maxSteps 跑通 crystalith QA 闭环」验证。

## 相关文档

- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — AI 生态对照总表（本文是其 AI SDK 专题补充）
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈
- [08-web-framework-elysia-vs-hono.md](./08-web-framework-elysia-vs-hono.md) — Elysia 与 AI SDK SSE 集成
- [AI SDK 官方文档](https://ai-sdk.dev/docs/introduction) — Provider / Stream / Agent / RAG / 多模态 全覆盖
