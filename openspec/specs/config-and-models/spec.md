# config-and-models Specification

## Purpose

定义配置加载、Schema 校验、模型与 provider 选择的统一规则，确保本地一键启动与生产可控覆盖并存。该规范强调安全默认值与可预期覆盖优先级，避免“能跑但不可控”的配置漂移。

## Non-goals

- 不定义具体业务流程
- 不约束前端组件结构

## Requirements

### Requirement: YAML config is validated by schema
系统 MUST 从 YAML 加载配置并以 `config/app.schema.gen.json` 校验结构。

#### Scenario: Invalid YAML config is rejected
- **WHEN** 用户提供的 YAML 配置不满足 `config/app.schema.gen.json`
- **THEN** 系统 SHALL 以明确错误拒绝启动或拒绝加载该配置

### Requirement: HTTP guardrails config is schema-validated and YAML-first
系统 MUST 在 `config/app.schema.gen.json` 中显式声明 HTTP guardrails 配置块，并以 YAML-first 方式加载与校验（不依赖额外的业务 env override）。

#### Scenario: Default config validates without guardrails overrides
- **WHEN** 用户使用仓库提供的默认 `config/app.yaml`
- **THEN** 配置校验 SHALL 通过
- **AND** 系统 SHALL 使用默认的 guardrails 策略（例如 `mode=auto`）

### Requirement: Guardrails default mode only enables for non-loopback exposure
当 `mode=auto` 时，系统 MUST 仅在“非 loopback 暴露”场景启用 guardrails，并支持显式覆盖。

#### Scenario: Operator forces guardrails on for a local bind
- **WHEN** 运维设置 `mode=enabled`
- **AND** 后端 listen host 为 loopback
- **THEN** 系统 SHALL 启用 guardrails

#### Scenario: Operator disables guardrails for a non-local bind
- **WHEN** 运维设置 `mode=disabled`
- **AND** 后端 listen host 为非 loopback
- **THEN** 系统 SHALL 禁用 guardrails

### Requirement: Runtime config source of truth is YAML
系统 MUST 以 `config/app.yaml`（模板渲染 + overlays 合并 + schema 校验）作为运行时业务配置的权威来源；配置加载器 MUST NOT 再执行“读取环境变量覆盖配置字段”的二次覆盖步骤。

配置加载器允许读取的环境变量仅限于“配置定位入口”：
- `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`

配置加载器还 MUST 支持模板渲染输入：
- `{{ env.* }}`：来自 `os.environ` + `.env`（`.env` 覆盖系统 env）
- `{{ secret.* }}`：来自与 `app.yaml` 同目录的 `secret.env`

**Migration**：将原本通过 env 覆盖的业务字段迁移到 `config/app.yaml`（敏感值放入 `config/secret.env` 并以 `{{ secret.KEY }}` 引用）。

#### Scenario: Legacy env overrides are ignored
- **WHEN** 用户设置了诸如 `DATABASE_URL`、`REDIS_URL`、`OLLAMA_HOST`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等环境变量
- **AND** `config/app.yaml` 为对应字段提供了明确值且未通过 `{{ env.* }}` 引用这些变量
- **THEN** 配置加载器 SHALL 不使用这些环境变量覆盖 YAML 字段
- **AND** 系统 SHALL 仍以 YAML 解析出的配置启动并提供服务

#### Scenario: Config path is selectable via env
- **WHEN** 用户设置 `CRYSTALITH_CONFIG_PATH` 指向一个存在的 YAML 文件
- **THEN** 系统 SHALL 加载该文件作为配置来源（并按 schema 校验）

### Requirement: Secrets are auto-discoverable without env
在未设置任何 secrets 定位环境变量的情况下，系统 MUST 自动尝试加载与 `config/app.yaml` 同目录的 `secret.env`（若存在），并支持 `{{ secret.KEY }}` 插值。

#### Scenario: Auto-load config/secret.env
- **WHEN** `config/secret.env` 存在
- **THEN** 系统 SHALL 读取该文件并解析 `{{ secret.* }}` 引用

### Requirement: Endpoint candidates are supported in YAML
系统 MUST 支持在 YAML 中为可选依赖声明候选端点，并在启动或首次使用时按优先级探测与锁定可用端点，以实现“一份 YAML 跨环境复用”。

#### Scenario: Select first reachable endpoint candidate
- **WHEN** 某可选依赖配置了候选端点列表且其中至少一个端点可达
- **THEN** 系统 SHALL 选择第一个可达端点并将其作为该依赖的实际连接端点

#### Scenario: Fallback when no candidates are reachable
- **WHEN** 某可选依赖配置了候选端点列表但均不可达
- **THEN** 系统 SHALL 按降级策略回退到核心可用模式（例如禁用该增强能力或使用本地/内置实现）

### Requirement: Secrets are not committed in plaintext
示例配置 MUST 不包含明文密钥；密钥应由 `config/secret.env`（不提交到仓库）或其他安全注入方式提供。

#### Scenario: Sample config contains no plaintext secrets
- **WHEN** 用户参考仓库内示例配置进行部署
- **THEN** 示例配置 SHALL 不包含明文密钥，并引导用户使用 `config/secret.env` 或其他安全注入提供密钥

### Requirement: Model selection is centralized
模型列表与默认选择 MUST 通过集中配置管理，并 MUST 支持“核心可运行默认模型”与“可选增强模型”并存；当可选模型依赖不可达时，系统 MUST 返回可恢复错误或回退策略，不得导致整体配置加载失败。

#### Scenario: Optional embedding model unavailable
- **WHEN** 默认 embedding 指向可选服务且该服务暂时不可达
- **THEN** 系统 SHALL 报告明确的依赖不可用信息并允许恢复后自动重试或切换，而核心服务继续可用

### Requirement: Providers include built-ins and plugins
provider 体系 MUST 同时支持内置 provider 与插件扩展 provider。

#### Scenario: Select a plugin provider
- **WHEN** 用户配置选择一个插件形式的 provider
- **THEN** 系统 SHALL 能加载并使用该 provider，且与内置 provider 使用同一选择接口

### Requirement: Plugin enablement is configurable via YAML
系统 MUST 通过 `config/app.yaml` 提供插件启用策略配置（allowlist/denylist），并以 schema 校验其结构；插件启用策略 MUST 在启动时生效且可诊断。

#### Scenario: Allowlist loads only selected plugins
- **WHEN** 运维在配置中设置 `plugins.enabled=[\"output-quiz\", \"parser-pdf\"]`
- **THEN** 系统 SHALL 仅加载 allowlist 中存在且兼容的插件
- **AND** 对未加载插件 SHALL 提供结构化诊断信息（disabled/allowlist/missing_dependency 等）

### Requirement: Plugin diagnostics are stable and user-actionable
当插件因禁用/不兼容/依赖缺失/加载失败而被跳过时，系统 MUST 输出稳定的 error_code/message/hint/details，且 hint MUST 是用户可执行的恢复步骤（例如安装依赖、启用插件、升级版本）。

#### Scenario: Missing dependency produces a recovery hint
- **WHEN** 某插件因依赖缺失而加载失败
- **THEN** 系统 SHALL 标记该插件为 skipped 并给出 `missing_dependency`（或等价）error_code
- **AND** hint SHALL 指示如何安装缺失依赖与验证插件可导入

### Requirement: Plugin load order is configurable for deterministic tie-break
系统 MUST 在 `config/app.yaml` 中提供 `plugins.load_order: string[]`（可选）用于控制插件加载顺序，从而使冲突裁决可预测（例如多个 parser 插件同时命中同一文件类型）。

规则：
- 若 `plugins.load_order` 提供，则宿主 MUST 将列表中出现的、且“已发现且启用”的插件按该顺序加载到最后（拥有更高优先级）。
- 未出现在 `plugins.load_order` 的启用插件 MUST 按 `plugin_id` 字典序加载。
- 冲突裁决仍采用 last-wins，但由于加载顺序确定，最终生效项 MUST 可预测。

#### Scenario: Operator pins parser conflict resolution
- **WHEN** 运维设置 `plugins.load_order=[\"parser-pdf\", \"parser-html\"]`
- **AND** 存在多个 parser 插件同时声明支持某些类型
- **THEN** 系统 SHALL 以该加载顺序确定最终生效插件
- **AND** 诊断信息 SHALL 记录最终生效插件 id 以便排障

### Requirement: Active slides workflow plugin is configurable via YAML
系统 MUST 通过 YAML 提供 active slides workflow plugin 的选择配置（例如 `slides.default_plugin` 或等价字段），并以 schema 校验其结构。

规则：

- 当该字段已设置时，宿主 MUST 优先选择该 plugin id 作为 active slides workflow plugin
- 当该字段指向未加载、被禁用或不兼容的插件时，系统 MUST 返回结构化诊断
- 当该字段未设置时，宿主仅可在“恰好发现一个兼容 slides plugin”时自动选择

#### Scenario: Operator pins a default slides plugin
- **WHEN** 运维在配置中设置 `slides.default_plugin="slides-slidev"`
- **THEN** 系统 SHALL 将该 plugin id 作为唯一默认候选
- **AND** 若该插件不可用，系统 SHALL 给出明确恢复提示而不是静默回退到其他插件

### Requirement: URL fetch security config is safe by default
URL 抓取安全配置 MUST 默认拒绝高风险目标（localhost/私网/元数据地址等）。

#### Scenario: Block high-risk URL targets
- **WHEN** 抓取目标指向 localhost/私网/云元数据地址等高风险目标
- **THEN** 系统 SHALL 默认拒绝该请求并返回可理解的错误
### Requirement: Optional service config schema is explicit
配置 Schema MUST 显式声明可选子服务块（启用标记、endpoint、timeout、probe policy、degrade policy），并给出默认值与示例，避免隐式约定。

#### Scenario: Validate config with optional blocks
- **WHEN** 用户仅配置核心服务并省略可选服务配置块
- **THEN** 配置校验 SHALL 通过且使用默认可选策略

### Requirement: Probe and discovery settings are configurable
可选服务探活与自动发现参数 MUST 可通过 `config/app.yaml` 调整，以适配“服务后启动”与自托管网络拓扑；不应依赖业务 env overrides 作为常规配置通道。

#### Scenario: Optional service starts after backend
- **WHEN** 后端已启动后可选服务才启动
- **THEN** 系统 SHALL 在后续探活周期中发现服务恢复并更新可用状态

### Requirement: Interactive chat UI transport is not feature-flagged
系统的对话内交互 UI 传输 MUST 固定使用 session `shared_state.ui`；运行时 MUST 不要求额外 feature flag 才能启用该能力。

#### Scenario: Stats shared UI works without envelope flag
- **WHEN** `chat_prompt_presets_enabled=true` 且 stats preset 生成了结构化结果
- **THEN** 系统 SHALL 直接返回/推送 `shared_state.ui`
- **AND** SHALL 不依赖 `chat_ui_envelope_enabled` 一类 legacy 开关
