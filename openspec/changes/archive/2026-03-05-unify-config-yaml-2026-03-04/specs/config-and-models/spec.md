## ADDED Requirements

### Requirement: Runtime config source of truth is YAML
系统 MUST 以 `config/app.yaml`（+ secrets 插值）作为运行时业务配置的权威来源；配置加载器 MUST NOT 再执行“读取环境变量覆盖配置字段”的二次覆盖步骤。

配置加载器允许读取的环境变量仅限于“配置定位入口”：
- `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`
- `CRYSTALITH_SECRETS_PATH`

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

## MODIFIED Requirements

### Requirement: Probe and discovery settings are configurable
可选服务探活与自动发现参数 MUST 可通过 `config/app.yaml` 调整，以适配“服务后启动”与自托管网络拓扑；不应依赖业务 env overrides 作为常规配置通道。

#### Scenario: Optional service starts after backend
- **WHEN** 后端已启动后可选服务才启动
- **THEN** 系统 SHALL 在后续探活周期中发现服务恢复并更新可用状态

## REMOVED Requirements

### Requirement: Environment overrides are supported
**Reason**：业务 env overrides 造成配置漂移、迁移困难与排障成本上升，与“YAML 单一真相”目标冲突。

**Migration**：将原本通过 env 覆盖的业务字段迁移到 `config/app.yaml`（敏感值放入 `config/secrets.yaml` 或 Docker secrets 目录并以 `${{ secrets.KEY }}` 引用）。仅保留 `CRYSTALITH_CONFIG_PATH/CRYSTALITH_CONFIG_DIR` 与 `CRYSTALITH_SECRETS_PATH` 作为定位入口。

### Requirement: Optional service env naming is consistent
**Reason**：`.env.example` 不再承载运行时业务配置；可选依赖的配置应集中在 YAML 中，以 schema 约束与示例自解释。

**Migration**：将可选依赖的启用、端点与探活参数迁移到 `config/app.yaml`；`.env.example` 仅保留端口、镜像与构建相关静态参数。
