# ai-provider-config Specification

## Purpose

定义 Crystalith 的 AI provider 与模型配置方式：支持 OpenAI/Ollama 等 provider，区分 chat 与 embedding 模型，统一 model-level completion/request options 的解析与生效，并允许通过插件机制扩展第三方 provider。

## Related specs

- `GLOSSARY.md`
- `config-management/spec.md`
- `plugin-system/spec.md`
- `generation-preference/spec.md`

## Requirements
### Requirement: Provider interfaces are split
系统 MUST 分离并保持稳定的 provider 接口：

- `ChatProvider`：用于聊天/生成（支持 sync 与 stream）
- `EmbeddingProvider`：用于向量化（支持 batch）

### Requirement: Models are configured via `models.available` and selected via `models.defaults`
系统 MUST 以 `models.available[]` 作为可用模型清单（每个条目 `id` 唯一），并通过 `models.defaults.chat` 与 `models.defaults.embedding` 指定默认 chat/embedding 模型（值为 `models.available[].id`）。

`models.defaults.*` 指向不存在的 id 时 MUST 配置校验失败并给出明确错误信息（列出可用 ids）。

### Requirement: Providers include built-ins and plugins
系统 MUST 支持内置 provider（例如 `openai`、`ollama`）以及插件 provider（见 `plugin-system/spec.md`）。

AI provider 插件 MUST 实现 `AIProviderPlugin`，并通过 Python entry points 被自动发现；entry point 的 `name` MUST 作为 provider id，且与 `models.available[].provider` 匹配后才能被引用。

### Requirement: Model-level options apply consistently
系统 SHALL 支持并一致应用 model-level options：

- `models.available[].completion_options`：chat 生成默认参数
- `models.available[].request_options`：timeout/proxy/verify_ssl/headers 等请求级设置

对不支持某些 request_options 的 provider，系统 MAY 降级忽略，但 MUST 在日志中可观测。
