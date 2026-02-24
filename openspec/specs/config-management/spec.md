# config-management Specification

## Purpose

定义 Crystalith 的运行时配置系统：从 `config/app.yaml` 加载并校验配置（pydantic-settings），支持 `${{ env.* }}` / `${{ secrets.* }}` 插值与环境变量覆盖，并生成 `config/app.schema.json` 以提供编辑器校验与补全。

## Related specs

- `GLOSSARY.md`
- `ai-provider-config/spec.md`
- `deployment/spec.md`
- `source-ingestion-url/spec.md`

## Requirements
### Requirement: YAML 配置加载与校验
系统 SHALL 使用 pydantic-settings 从 YAML 配置文件加载并校验配置；当配置无效（缺失必填/类型不匹配）时 MUST 输出清晰的校验错误信息。

系统 SHALL 支持通过环境变量与 secrets 对一组明确字段进行覆盖以适配部署场景（例如 `database.url` 可被 `DATABASE_URL=postgresql://...` 覆盖）。

### Requirement: Environment and secrets interpolation in YAML
系统 MUST 支持在 YAML 配置中使用 `${{ env.VAR }}` 与 `${{ secrets.VAR }}` 进行插值解析，以避免在仓库中提交明文敏感信息。

### Requirement: No plaintext secrets in repo example config
系统 MUST 确保仓库内的示例配置（例如 `config/app.yaml`）不包含真实密钥或环境私有端点（例如内网 base_url、仅本地可用的代理默认开启）；敏感字段 MUST 使用 `${{ env.* }}` / `${{ secrets.* }}` 或明显占位符，并提供对外可理解的默认值（例如 `https://api.openai.com/v1`、`localhost` 等）。

### Requirement: OpenAI is the default one-click startup path
系统 MUST 使开箱即用的“一键启动”默认路径仅依赖 OpenAI（用户提供 `OPENAI_API_KEY` 即可），默认 chat 与 embedding 均走 OpenAI provider，且不要求本地 Ollama。
仓库默认配置 `config/app.yaml` 中，`models.defaults.chat` 与 `models.defaults.embedding` 指向的默认模型 provider MUST 为 `openai`。

### Requirement: Offline mode can be enabled via env overrides
系统 SHALL 允许通过环境变量覆盖切换到离线路径（Ollama），且无需修改 `config/app.yaml` 文件内容。
例如：设置 `OLLAMA_HOST=http://ollama:11434`、`CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local` 后，系统 MUST 使用上述覆盖值作为默认模型选择。

### Requirement: 配置 Schema 生成
系统 SHALL 生成配置的 JSON Schema，用于 YAML 语言服务校验与补全。
Schema MUST 可生成并保存为文件（例如 `config/app.schema.json`）。

### Requirement: URL fetch security settings are schema-validated and safe by default
系统 MUST 在配置 schema 中表达 URL fetch 的安全策略（SSRF 防护相关字段），并保证默认值为“安全拒绝”（阻止 localhost/私网/元数据等高风险目标）。
部署方 MAY 通过显式 allowlist 配置放行受控目标；allowlist 的配置路径为 `source_ingestion.url_fetch.security.*`。

### Requirement: YAML 语言服务提示
系统 SHALL 提供可直接用于 YAML 语言服务的 Schema 引用字符串。
当用户在 YAML 头部添加 `# yaml-language-server: $schema=<URL>` 时，编辑器 SHOULD 可基于生成的 Schema 提供校验与补全。

### Requirement: Model Settings Resolution Priority
系统 MUST 定义并遵循统一的模型请求设置优先级：请求级显式覆盖 > model-level 配置 > 全局默认 > 库默认。
该优先级适用于（但不限于）temperature/timeout 等 request options：显式覆盖 MUST 优先生效，model-level MUST 覆盖全局默认。
