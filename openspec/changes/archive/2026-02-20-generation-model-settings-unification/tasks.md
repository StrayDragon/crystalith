## 1. Resolve model settings

- [x] 1.1 定义统一的“请求级/模型级/全局”设置优先级与解析函数（completion_options/request_options）
- [x] 1.2 将 `completion_options` 映射为 `pydantic_ai` 的 `ModelSettings`（temperature/max_tokens/top_p/stop_sequences 等）
- [x] 1.3 将 `request_options` 映射为 OpenAI SDK / httpx client 配置（timeout/headers/proxy/verify_ssl），并实现可复用的 client 构建与生命周期管理
- [x] 1.4 为解析/映射添加单元测试（含优先级覆盖与不支持字段的降级行为）

## 2. Apply to pydantic-ai path

- [x] 2.1 更新 `build_chat_model*`：构建 `OpenAIChatModel`/`OllamaProvider` 时注入显式 OpenAI client（max_retries=0、timeout 生效、headers 生效）
- [x] 2.2 在 OutputGraph/Slides/Research 等 Agent 调用处接入统一的 model settings（必要时通过 `Agent(..., model_settings=...)` 或 model 构建 settings）
- [x] 2.3 增加回归测试：验证 pydantic-ai 路径会应用 completion/request options（使用 stub client 或可观测字段断言）

## 3. Apply to shared/ai provider path

- [x] 3.1 在 `shared/ai/*Provider` 内部应用默认 completion options（chat）与 request options（chat/embedding）
- [x] 3.2 统一禁用 SDK 内置重试（确保与 `run_with_retry` 不叠加），并补齐对应单测
- [x] 3.3 校验插件 provider 的兼容策略：不支持字段时忽略但记录日志/警告

## 4. Observability & docs

- [x] 4.1 在关键日志中记录 effective settings（timeout/max_retries/temperature/max_tokens 等）并对齐字段名
- [x] 4.2 更新配置说明与示例（如需新增字段/默认值），并确保 `config/app.schema.json` 可生成且通过校验
