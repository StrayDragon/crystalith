# config-and-models Specification

## Purpose

定义配置加载、Schema 校验、模型与 provider 选择的统一规则，确保本地一键启动与生产可控覆盖并存。该规范强调安全默认值与可预期覆盖优先级，避免“能跑但不可控”的配置漂移。

## Non-goals

- 不定义具体业务流程
- 不约束前端组件结构

## Requirements

### Requirement: YAML config is validated by schema
系统 MUST 从 YAML 加载配置并以 `config/app.schema.json` 校验结构。

#### Scenario: Invalid YAML config is rejected
- **WHEN** 用户提供的 YAML 配置不满足 `config/app.schema.json`
- **THEN** 系统 SHALL 以明确错误拒绝启动或拒绝加载该配置

### Requirement: Runtime config source of truth is YAML
系统 MUST 以 `config/app.yaml`（+ secrets 插值）作为运行时业务配置的权威来源；配置加载器 MUST NOT 再执行“读取环境变量覆盖配置字段”的二次覆盖步骤。

配置加载器允许读取的环境变量仅限于“配置定位入口”：
- `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`
- `CRYSTALITH_SECRETS_PATH`

**Migration**：将原本通过 env 覆盖的业务字段迁移到 `config/app.yaml`（敏感值放入 `config/secrets.yaml` 或 Docker secrets 目录并以 `${{ secrets.KEY }}` 引用）。

#### Scenario: Legacy env overrides are ignored
- **WHEN** 用户设置了诸如 `DATABASE_URL`、`REDIS_URL`、`OLLAMA_HOST`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等环境变量
- **AND** `config/app.yaml` 为对应字段提供了明确值且未通过 `${{ env.* }}` 引用这些变量
- **THEN** 配置加载器 SHALL 不使用这些环境变量覆盖 YAML 字段
- **AND** 系统 SHALL 仍以 YAML 解析出的配置启动并提供服务

#### Scenario: Config path is selectable via env
- **WHEN** 用户设置 `CRYSTALITH_CONFIG_PATH` 指向一个存在的 YAML 文件
- **THEN** 系统 SHALL 加载该文件作为配置来源（并按 schema 校验）

### Requirement: Secrets are auto-discoverable without env
在未设置 `CRYSTALITH_SECRETS_PATH` 的情况下，系统 MUST 自动尝试加载与 `config/app.yaml` 同目录的 `secrets.yaml`（若存在），并支持 `${{ secrets.KEY }}` 插值。

#### Scenario: Auto-load config/secrets.yaml
- **WHEN** `config/secrets.yaml` 存在且未设置 `CRYSTALITH_SECRETS_PATH`
- **THEN** 系统 SHALL 读取该文件并解析 `${{ secrets.* }}` 引用

### Requirement: Endpoint candidates are supported in YAML
系统 MUST 支持在 YAML 中为可选依赖声明候选端点，并在启动或首次使用时按优先级探测与锁定可用端点，以实现“一份 YAML 跨环境复用”。

#### Scenario: Select first reachable endpoint candidate
- **WHEN** 某可选依赖配置了候选端点列表且其中至少一个端点可达
- **THEN** 系统 SHALL 选择第一个可达端点并将其作为该依赖的实际连接端点

#### Scenario: Fallback when no candidates are reachable
- **WHEN** 某可选依赖配置了候选端点列表但均不可达
- **THEN** 系统 SHALL 按降级策略回退到核心可用模式（例如禁用该增强能力或使用本地/内置实现）

### Requirement: Secrets are not committed in plaintext
示例配置 MUST 不包含明文密钥；密钥应由 `config/secrets.yaml`（不提交到仓库）或其他安全注入方式提供。

#### Scenario: Sample config contains no plaintext secrets
- **WHEN** 用户参考仓库内示例配置进行部署
- **THEN** 示例配置 SHALL 不包含明文密钥，并引导用户使用 `config/secrets.yaml` 或其他安全注入提供密钥

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
