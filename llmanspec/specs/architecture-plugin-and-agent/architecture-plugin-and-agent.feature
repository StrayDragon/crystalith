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
    - DEFERRED（产品化）：通用智能体多步 tool calling 循环 MAY 使用 AI SDK streamText + maxSteps / ToolLoopAgent。当前 QA/research 已用 streamText 与局部 tools，但 MUST NOT 假定全站已是完整 ToolLoopAgent 产品。

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
    - AI SDK middleware MUST 覆盖重试与结构化日志；OpenTelemetry tracer MAY 后续接入。

  @req:r22 @human
  场景: openai-key-generates
    - 必须成立：当 开发者配置 OpenAI API key；那么 ai SDK 可完成 generateText/streamText/generateObject
    当 开发者配置 OpenAI API key
    那么 ai SDK 可完成 generateText/streamText/generateObject

  @req:r80 @human
  场景: anthropic-provider-switch
    - 必须成立：当 用户在 config 中切换 Anthropic provider；那么 系统 SHALL 使用 @ai-sdk/anthropic 而非 @ai-sdk/openai 发起调用
    当 用户在 config 中切换 Anthropic provider
    那么 系统 SHALL 使用 @ai-sdk/anthropic 而非 @ai-sdk/openai 发起调用

  @req:r118 @human
  场景: agent-multi-tool-loop
    - 必须成立：当 QA 对话触发检索 + 联网搜索；那么 agent SHALL 自主多轮调用 retrieveSources 和 webSearch 工具，在 maxSteps 内完成
    当 QA 对话触发检索 + 联网搜索
    那么 agent SHALL 自主多轮调用 retrieveSources 和 webSearch 工具，在 maxSteps 内完成

  @req:r155 @human
  场景: faq-generateobject-schema
    - 必须成立：当 用户请求 FAQ 类型结构化输出；那么 generateObject SHALL 返回符合 Zod schema 的 JSON，类型推断正确
    当 用户请求 FAQ 类型结构化输出
    那么 generateObject SHALL 返回符合 Zod schema 的 JSON，类型推断正确

  @req:r190 @human
  场景: streaming-sse-events
    - 必须成立：当 前端请求流式 QA；那么 SSE 流 SHALL 实时推送 text-delta 和 tool-call/tool-result 事件
    当 前端请求流式 QA
    那么 SSE 流 SHALL 实时推送 text-delta 和 tool-call/tool-result 事件

  @req:r221 @human
  场景: tokenizer-counts-context-window
    - 必须成立：当 系统计算 context window 使用量；那么 gpt-tokenizer encode().length 返回正确 token 数
    当 系统计算 context window 使用量
    那么 gpt-tokenizer encode().length 返回正确 token 数

  @req:r247 @human
  场景: middleware-retry-backoff
    - 必须成立：当 LLM 调用失败需要重试；那么 middleware SHALL 按配置的有限次数自动重试并采用指数退避
    当 LLM 调用失败需要重试
    那么 middleware SHALL 按配置的有限次数自动重试并采用指数退避
