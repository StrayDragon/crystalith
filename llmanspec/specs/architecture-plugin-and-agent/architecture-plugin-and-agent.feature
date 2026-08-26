# language: zh-CN
# capability: architecture-plugin-and-agent
# purpose: 定义 v2 AI 运行时边界：Vercel AI SDK v7、@ai-sdk/* providers、generateObject/streamText、gpt-tokenizer；完整 ToolLoopAgent / maxSteps 产品化 MAY 延后（见 r118）。
# scope: apps/server/src/ai/, apps/server/src/features/

功能: architecture-plugin-and-agent

  @req:r22 @human
  场景: AI runtime is Vercel AI SDK
    - 系统 MUST 使用 Vercel AI SDK (`ai` + `@ai-sdk/*`) 作为唯一 AI 基础层。AI SDK 覆盖 Provider 抽象、结构化输出 (generateObject/streamObject)、Tool Calling、流式生成与 Middleware；完整 Agent Loop (streamText + maxSteps) 产品面见 r118。

  @req:r80 @human
  场景: Provider layer uses @ai-sdk/* official packages
    - 系统 MUST 通过 @ai-sdk/openai、@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/deepseek 等官方 provider 包（及 openai-compatible 白名单动态加载）承接 LLM 调用。API key/baseURL MUST 通过 config 或 env 注入。

  @req:r118 @human
  场景: Agent loop uses streamText + maxSteps
    - DEFERRED（产品化）：通用智能体多步 tool calling 循环（如 QA 中组合检索与联网搜索工具的多轮行为）MAY 使用 AI SDK streamText + maxSteps / ToolLoopAgent。当前 QA/research 已用 streamText 与局部 tools 实现，系统 MUST NOT 假定或承诺全站已是完整 ToolLoopAgent 产品。

  @req:r155 @human
  场景: Structured output uses generateObject + Zod
    - 结构化 JSON 输出 MUST 使用 AI SDK generateObject(schema: Zod)。Output 生成管线 MUST 使用 generateObject + 普通 async 函数链（非通用 agent loop）。

  @req:r190 @human
  场景: Streaming uses streamText ReadableStream + SSE relay
    - 流式生成 MUST 通过 AI SDK streamText 的 fullStream（或等价）→ Elysia SSE Response 中继到前端。SSE MUST 使用 text/event-stream。

  @req:r221 @human
  场景: Token counting uses gpt-tokenizer
    - Token 计数 MUST 使用 gpt-tokenizer（纯 JS），MUST NOT 依赖 tiktoken/wasm 作为主路径。

  @req:r247 @human
  场景: Middleware handles retry and logging
    - AI SDK middleware MUST 承载 LLM 调用的自动重试与结构化日志；OpenTelemetry tracer MAY 后续接入。重试策略细节（次数、指数退避）见 generation-observability-and-guardrails retry-* 规则（canonical）。
