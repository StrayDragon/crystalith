# config-management Specification

## Purpose
TBD - created by archiving change add-research-workspace. Update Purpose after archive.
## Requirements
### Requirement: YAML 配置加载与校验
系统 SHALL 使用 pydantic-settings 从 YAML 配置文件加载并校验配置，并在加载后支持通过环境变量与 secrets 对一组明确字段进行覆盖（用于部署场景下的无代码配置）。

#### Scenario: 加载有效配置
- **WHEN** 提供符合 Schema 的 YAML 配置
- **THEN** 系统成功加载并使用该配置

#### Scenario: 加载无效配置
- **WHEN** YAML 配置缺失必填字段或类型不匹配
- **THEN** 系统给出清晰的校验错误信息

#### Scenario: 使用环境变量覆盖数据库连接
- **WHEN** 配置文件中存在 `database.url`
- **AND** 设置环境变量 `DATABASE_URL=postgresql://...`
- **THEN** 系统使用该环境变量值覆盖配置文件中的数据库连接

### Requirement: Environment and secrets interpolation in YAML
系统 MUST 支持在 YAML 配置中使用 `${{ env.VAR }}` 与 `${{ secrets.VAR }}` 进行插值解析，用于在不提交明文敏感信息的前提下配置运行时参数。

#### Scenario: env 插值解析
- **WHEN** YAML 中包含 `${{ env.OPENAI_API_KEY }}`
- **AND** 环境变量 `OPENAI_API_KEY` 已设置
- **THEN** 系统在加载配置时将该字段解析为环境变量值

#### Scenario: secrets 插值解析
- **WHEN** YAML 中包含 `${{ secrets.OPENAI_API_KEY }}`
- **AND** secrets 源提供 `OPENAI_API_KEY`
- **THEN** 系统在加载配置时将该字段解析为 secrets 值

### Requirement: No plaintext secrets in repo example config
系统 MUST 确保仓库内的示例配置（例如 `config/app.yaml`）不包含真实密钥或环境私有端点（例如内网 base_url、仅本地可用的代理默认开启）；敏感字段 MUST 使用 `${{ env.* }}` / `${{ secrets.* }}` 或明显占位符，并提供对外可理解的默认值（例如 `https://api.openai.com/v1`、`localhost` 等）。

#### Scenario: 示例配置不包含真实 OpenAI key
- **WHEN** 检查仓库默认配置 `config/app.yaml`
- **THEN** OpenAI provider 的 `api_key` 不为真实密钥
- **AND** 其值使用 `${{ env.OPENAI_API_KEY }}` / `${{ secrets.OPENAI_API_KEY }}` 或占位符

#### Scenario: 示例配置不包含私有 base_url 与默认代理开启
- **WHEN** 检查仓库默认配置 `config/app.yaml`
- **THEN** OpenAI provider 的 `base_url` 为公共可理解默认值（例如 `https://api.openai.com/v1`）或占位符
- **AND** 默认代理配置不强制开启（例如 `proxy_settings.enabled` 默认为 `false`）

### Requirement: OpenAI is the default one-click startup path
系统 MUST 使开箱即用的“一键启动”默认路径仅依赖 OpenAI（用户提供 `OPENAI_API_KEY` 即可），默认 chat 与 embedding 均走 OpenAI provider，且不要求本地 Ollama。

#### Scenario: 默认 chat 与 embedding 均为 OpenAI provider
- **WHEN** 检查仓库默认配置 `config/app.yaml`
- **THEN** `models.defaults.chat` 指向的默认模型 provider 为 `openai`
- **AND** `models.defaults.embedding` 指向的默认模型 provider 为 `openai`

### Requirement: Offline mode can be enabled via env overrides
系统 SHALL 允许通过环境变量覆盖切换到离线路径（Ollama），且无需修改 `config/app.yaml` 文件内容。

#### Scenario: 通过环境变量切换到 Ollama
- **WHEN** 用户设置 `OLLAMA_HOST=http://ollama:11434`
- **AND** 用户设置 `CRYSTALITH_DEFAULT_CHAT_MODEL=qwen-local`
- **AND** 用户设置 `CRYSTALITH_DEFAULT_EMBEDDING_MODEL=bge-m3-local`
- **THEN** 系统在加载配置后使用上述覆盖值作为默认模型选择

### Requirement: 配置 Schema 生成
系统 SHALL 生成配置的 JSON Schema，用于 YAML 语言服务校验与补全。

#### Scenario: 生成 Schema
- **WHEN** 调用配置管理器的 Schema 生成接口
- **THEN** 生成并保存 JSON Schema 文件（本地路径，例如 `config/app.schema.json`）

### Requirement: YAML 语言服务提示
系统 SHALL 提供可直接用于 YAML 语言服务的 Schema 引用字符串。

#### Scenario: 使用 Schema 注释
- **WHEN** 用户在 YAML 头部添加 `# yaml-language-server: $schema=<URL>`
- **THEN** 编辑器可基于生成的 Schema 提供校验与补全
