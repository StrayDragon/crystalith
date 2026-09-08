# language: zh-CN
# capability: architecture-plugin-and-agent
# purpose: 定义 v2 AI 运行时边界：Vercel AI SDK v7、@ai-sdk/* providers、generateObject/streamText、gpt-tokenizer；完整 ToolLoopAgent / maxSteps 产品化 MAY 延后（见 r118）；插件宿主以单一 CrystalithPlugin 接口承载注册/发现/配置（r7/r11）。
# scope: apps/server/src/ai/, apps/server/src/features/, apps/server/src/plugins/

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
    - AI SDK middleware MUST 承载 LLM 调用的自动重试与结构化日志；OpenTelemetry tracer MAY 后续接入。重试策略细节（次数、指数退避）见 generation-observability-and-guardrails retry-honors-retry-after / retry-timeout-budget（canonical）。

  @req:r7 @human
  场景: Plugin contracts share a single CrystalithPlugin SSOT
    - 宿主 MUST 通过单一 `CrystalithPlugin` 接口（id / kind / displayName / configSchema（Zod） / capabilities / factory）承载全部插件种类（output-type | extractor | parser | slides-workflow）的注册、发现与配置解析；extractor 与 slides-workflow 内置插件（含 studio slides config 表与网页提取器 factory）MUST 经同一 registry 注册路径生效，MUST NOT 存在绕过 registry 的平行内置注册形状。per-kind 行为契约（web-extractor-plugins、slides-workflow-plugins）作为 kind 层细化保持有效，MUST NOT 被本接口取代。 DEFERRED（迁移）：output-type 内置注册表（OUTPUT_META）迁移到该接口由后续 change 执行；迁移完成前 OUTPUT_META 是 output-type 的唯一过渡注册形态，期间 MUST NOT 引入第三套平行注册形状。

  @req:r11 @human
  场景: External plugins load from npm dependencies with restart semantics
    - 外部插件 MUST 以 npm 依赖形式分发（官方插件约定 scope `@crystalith-plugin/*`，MUST 为纯 JS 且不依赖 native addon），宿主在启动时按 `plugins.enabled`（allowlist）/ `plugins.disabled`（denylist）/ `plugins.load_order`（后加载者优先消解冲突）从 node_modules 动态 import 加载。系统 MUST NOT 提供运行时热插拔：安装、升级与禁用 MUST 以重启 server 生效。单个插件加载失败 MUST 记入 `/v2/workspace/tools` 的 `diagnostics.plugins.skipped`（含 errorCode/message/hint）并 MUST NOT 阻断启动。
