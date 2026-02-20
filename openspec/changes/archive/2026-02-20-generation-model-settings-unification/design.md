## Context

当前 Crystalith 后端同时存在两条 LLM 调用路径：

1) **pydantic-ai 路径**：`shared/agents/*` 中通过 `build_chat_model()` 构建 `pydantic_ai.models.openai.OpenAIChatModel`，再由 `pydantic_ai.Agent` 执行结构化输出生成（OutputGraph/Slides/Research 等）。

2) **Provider 路径**：`shared/ai/*` 中自定义 `ChatProvider/EmbeddingProvider`（OpenAI/Ollama/插件），由业务代码直接调用，并通过 `run_with_retry` 实现业务层重试。

配置层已经支持：
- `models.available[].completion_options`：temperature/max_tokens/top_p/stop/reasoning…
- `models.available[].request_options`：timeout/verify_ssl/proxy/headers…
- 全局 `ai.timeout` / `ai.max_retries`

但目前这些设置在不同路径上的生效方式并不一致，导致“同一份 app.yaml 不同模块表现不同”的问题，以及 SDK 内置重试与业务重试叠加造成的尾延迟放大。

## Goals / Non-Goals

**Goals:**
- 统一模型请求设置（completion + request）的解析与优先级，并让两条 LLM 路径一致生效。
- 明确并消除“嵌套重试”：SDK retry 与业务 retry 只能有一层作为来源，默认以业务层为准（更可控）。
- 在关键日志中输出 effective settings（便于排查配置未生效/性能异常）。
- 保持向后兼容：尽量不改变现有 API 形状；如需新增配置项，提供安全默认值。

**Non-Goals:**
- 不引入新的模型 provider（仅统一现有 openai/ollama/插件的设置注入方式）。
- 不在本次重构中重写所有 LLM 调用为同一套抽象（以“统一配置生效 + 可观测性”为主）。
- 不把所有 completion options 暴露为请求级 API 参数（仍以配置为主，未来再评估）。

## Decisions

### 1) 定义统一的 settings 解析优先级

统一优先级（从高到低）：
1. **请求级显式覆盖**（如 API 参数 `top_k/min_score/model_id` 等，或未来引入的 request-level model overrides）
2. **model-level 配置**（`ModelConfig.completion_options/request_options`）
3. **全局默认**（`settings.ai.timeout/max_retries` 等）
4. **库默认值**

理由：可预测、易排障，并允许对单一模型做差异化调参。

### 2) pydantic-ai 路径使用显式 ModelSettings + 显式 OpenAI client

- 将 `completion_options` 映射到 `pydantic_ai.settings.ModelSettings`（temperature/max_tokens/top_p/stop_sequences/extra_headers…）。
- 将 `request_options` 注入到 OpenAI SDK 的 `AsyncOpenAI(..., timeout=..., http_client=...)`：
  - `timeout` → OpenAI SDK timeout / pydantic-ai ModelSettings timeout
  - `headers` → ModelSettings.extra_headers（优先）或 SDK client 层 header
  - `proxy/verify_ssl` → 通过自建 `httpx.AsyncClient` 注入
- 显式设置 OpenAI SDK `max_retries=0`（避免与业务重试叠加）。

理由：pydantic-ai 默认 provider 会创建自己的 client/http_client，不容易与业务配置统一；显式 client 注入可控且可测试。

### 3) Provider 路径对 completion_options 采用“provider 默认参数”策略

不改动接口签名（避免 BREAKING），而是在 provider 实例内部保存默认 completion options，并在每次调用时应用到 SDK 请求参数：
- chat：temperature/max_tokens/top_p/stop…
- embedding：仅应用 request_options（completion_options 不适用）

理由：最小侵入；配置即可全局生效；调用方无需改代码。

### 4) 统一重试边界：业务层负责重试与退避

- 对 Provider 路径：保持 `run_with_retry` 为唯一重试入口；SDK retry 关闭。
- 对 pydantic-ai 路径：区分两类重试：
  - **schema/输出验证重试**：继续使用 `Agent(retries=...)`
  - **网络/限流重试**：不依赖 SDK 内置重试；由业务层在调用 `agent.run(...)` 外包一层 retry（仅针对明确可重试错误）

理由：将“格式重试”与“网络重试”分离，避免指数级叠加与不可预测尾延迟。

## Risks / Trade-offs

- [并非所有 provider 支持所有设置] → 对不支持字段的 provider 采取忽略/降级，并在日志中记录（不 hard-fail）。
- [自建 httpx client 影响连接池/资源] → 复用 app 生命周期级别的 client（单例）并在 shutdown 时关闭；增加单测覆盖。
- [行为变化导致输出分布变化] → 通过显式记录 effective settings + 回归测试降低风险。

## Migration Plan

- 先在代码层引入统一解析与注入，并保持默认值与当前尽量一致。
- 逐步开启更严格的一致性检查（例如：启动时 warn 未生效字段）。
- 如出现问题，可通过：
  - 将某些模型的 completion_options 置空
  - 或临时恢复 SDK retries（仅作为紧急开关，不作为默认）

## Open Questions

- completion_options 是否需要在请求级支持“临时覆盖”（例如 Debug 或 A/B）？若需要，如何避免 API 膨胀？
- 对插件 provider 的设置注入边界：是统一采用 `ModelSettings` 结构，还是保持插件自定义解析？
