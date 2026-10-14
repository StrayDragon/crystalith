# language: zh-CN
# capability: architecture-plugin-and-agent
# purpose: 定义 v2 AI 运行时边界：Vercel AI SDK v7、@ai-sdk/* providers、generateObject/streamText、gpt-tokenizer；完整 ToolLoopAgent / maxSteps 产品化 MAY 延后（见 r11）；插件宿主以单一 CrystalithPlugin 接口承载注册/发现/配置（r16/r17）。

功能: architecture-plugin-and-agent

  @req:r9
  规则: AI runtime is Vercel AI SDK
    系统 MUST 使用 Vercel AI SDK (`ai` + `@ai-sdk/*`) 作为唯一 AI 基础层。AI SDK 覆盖 Provider 抽象、结构化输出 (generateObject/streamObject)、Tool Calling、流式生成与 Middleware；完整 Agent Loop (streamText + maxSteps) 产品面见 r11。
  @req:r10
  规则: Provider layer uses @ai-sdk/* official packages
    系统 MUST 通过 @ai-sdk/openai、@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/deepseek 等官方 provider 包（及 openai-compatible 白名单动态加载）承接 LLM 调用。API key/baseURL MUST 通过 config 或 env 注入。
  @req:r11
  规则: Agent loop uses streamText + maxSteps
    DEFERRED（产品化）：通用智能体多步 tool calling 循环（如 QA 中组合检索与联网搜索工具的多轮行为）MAY 使用 AI SDK streamText + maxSteps / ToolLoopAgent。当前 QA/research 已用 streamText 与局部 tools 实现，系统 MUST NOT 假定或承诺全站已是完整 ToolLoopAgent 产品。
  @req:r12
  规则: Structured output uses generateObject + Zod
    结构化 JSON 输出 MUST 使用 AI SDK generateObject(schema: Zod)。Output 生成管线 MUST 使用 generateObject + 普通 async 函数链（非通用 agent loop）。
  @req:r13
  规则: Streaming uses streamText ReadableStream + SSE relay
    流式生成 MUST 通过 AI SDK streamText 的 fullStream（或等价）→ Elysia SSE Response 中继到前端。SSE MUST 使用 text/event-stream。

    场景: stream-relay-through-sse
      假如 笔记本中有一篇来源且发起流式提问
      当 以流式模式发起笔记本问答（tests/api-contract/qa-session-contract.test.ts 的 r369 stream done 断言）
      那么 streamText fullStream 经 Elysia SSE 中继返回 200
      而且 SSE Content-Type 为 text/event-stream
  @req:r14
  规则: Token counting uses gpt-tokenizer
    Token 计数 MUST 使用 gpt-tokenizer（纯 JS），MUST NOT 依赖 tiktoken/wasm 作为主路径。

    场景: token-counting-uses-gpt-tokenizer
      假如 AI 调用需要 token 计数与截断
      当 运行 apps/server/tests/tokenizer.test.ts 的计数用例
      那么 countTokens/countMessageTokens/truncateToTokens 按 gpt-tokenizer 纯 JS 实现产出
      而且 主路径不依赖 tiktoken/wasm
  @req:r15
  规则: Middleware handles retry and logging
    AI SDK middleware MUST 承载 LLM 调用的自动重试与结构化日志；OpenTelemetry tracer MAY 后续接入。重试策略细节（次数、指数退避）见 generation-observability-and-guardrails retry-honors-retry-after / retry-timeout-budget（canonical）。
  @req:r16
  规则: Plugin contracts share a single CrystalithPlugin SSOT
    宿主 MUST 通过单一 `CrystalithPlugin` 接口（id / kind / displayName / configSchema（Zod） / capabilities / factory）承载全部插件种类（output-type | extractor | parser | slides-workflow）的注册、发现与配置解析；extractor 与 slides-workflow 内置插件（含 studio slides config 表与网页提取器 factory）MUST 经同一 registry 注册路径生效，MUST NOT 存在绕过 registry 的平行内置注册形状。per-kind 行为契约（web-extractor-plugins、slides-workflow-plugins）作为 kind 层细化保持有效，MUST NOT 被本接口取代。 DEFERRED（迁移）：output-type 内置注册表（OUTPUT_META）迁移到该接口由后续 change 执行；迁移完成前 OUTPUT_META 是 output-type 的唯一过渡注册形态，期间 MUST NOT 引入第三套平行注册形状。
  
    场景: builtins-register-through-single-registry
      假如 插件测试环境就绪（tests/plugins/registry.test.ts 的 r16 断言）
      当 检查 builtinPlugins 聚合与共享 pluginRegistry 消费路径
      那么 extractor 与 slides-workflow 内置插件同在一个聚合列表且每个都携带完整 CrystalithPlugin 合约形状
      而且 extractor 元数据经共享 registry 的 loadedByKind 派生（无平行注册形状）

@req:r17
  规则: External plugins load from npm dependencies with restart semantics
    外部插件 MUST 以 npm 依赖形式分发（官方插件约定 scope `@crystalith-plugin/*`，MUST 为纯 JS 且不依赖 native addon），宿主在启动时按 `plugins.enabled`（allowlist）/ `plugins.disabled`（denylist）/ `plugins.load_order`（后加载者优先消解冲突）从 node_modules 动态 import 加载。系统 MUST NOT 提供运行时热插拔：安装、升级与禁用 MUST 以重启 server 生效。单个插件加载失败 MUST 记入 `/v2/workspace/tools` 的 `diagnostics.plugins.skipped`（含 errorCode/message/hint）并 MUST NOT 阻断启动。

    场景: plugin-load-failure-skips-without-blocking
      假如 多个插件按 plugins.enabled/load_order 从 node_modules 动态 import
      当 运行 apps/server/tests/plugins/registry.test.ts 的 load semantics 用例
      那么 allowlist 外、disabled 与 factory/import 失败的插件记入 diagnostics.plugins.skipped（PLUGIN_* errorCode）
      而且 其余插件继续加载生效且启动不被阻断
      而且 未提供运行时热插拔入口，安装/升级/禁用经重启 server 生效
