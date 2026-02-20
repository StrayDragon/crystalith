## Why

当前后端存在两条并行的 LLM 调用链路：一条走 `pydantic_ai.Agent`（用于 OutputGraph/Slides 等结构化输出），另一条走 `shared/ai/*` Provider 包装（用于 chat / embedding 等）。两条链路对 `config/app.yaml` 的解释与生效范围不一致，导致：

- `ModelConfig.completion_options`（temperature/max_tokens/stop 等）在部分链路不生效或行为不一致；
- `ModelConfig.request_options` 与全局 `ai.timeout / ai.max_retries` 的优先级不清晰，出现超时/重试策略割裂；
- SDK 内置重试与业务层 `run_with_retry` 叠加，造成尾延迟膨胀且难以调参；
- 代理/自定义 header/SSL 校验等请求选项在不同调用点表现不一致，影响部署可控性。

## What Changes

- 统一“模型请求配置”的解析规则与优先级：request-level overrides → model-level options → global defaults。
- 在 `pydantic_ai` 路径中显式传入与配置一致的 model settings（completion options）与 request settings（timeout/headers/proxy 等）。
- 在 `shared/ai` Provider 路径中补齐对 `completion_options/request_options` 的应用（对 OpenAI/Ollama 与插件 provider 尽量一致）。
- 统一 SDK 重试策略：明确哪一层负责重试/退避；避免嵌套 backoff（不引入 BREAKING API，行为以“更可预测”为目标）。
- 增补可观测性字段：记录每次生成使用的 effective settings（便于排查“配置没生效”类问题）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `agent-architecture`: Agent/Graph 的模型构建与 LLM 调用 MUST 统一应用模型请求设置（completion/request options），并记录 effective settings。
- `ai-provider-config`: 配置中的 `completion_options` / `request_options` MUST 在 chat/embedding 两类调用路径一致生效，并明确优先级与覆盖方式。
- `config-management`: 配置 schema/覆盖策略需要明确新增/已有字段的优先级与默认行为（含 env overrides）。
- `backend-performance`: 重试/超时策略统一后，系统 SHOULD 避免嵌套重试导致的尾延迟放大，并提供必要的日志字段。

## Impact

- Backend
  - `backend/py/src/crystalith/shared/agents/models.py`：统一构建 `pydantic_ai` 模型时的 settings/profile 与请求级配置注入。
  - `backend/py/src/crystalith/shared/ai/*`：Provider 路径补齐 completion/request options 的应用与一致性。
  - `backend/py/src/crystalith/shared/config/*`：补充优先级说明、schema 校验与文档化。
  - `backend/py/tests/*`：补充“配置生效一致性”的单测与回归用例。
- 配置形状原则上保持不变；如需要新增字段，将通过 schema 与示例配置说明，并提供向后兼容默认值。
