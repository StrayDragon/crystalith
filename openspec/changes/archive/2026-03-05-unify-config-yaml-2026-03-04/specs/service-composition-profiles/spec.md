## ADDED Requirements

### Requirement: Optional composition does not depend on env injection
当用户通过 compose overlay/profile 启用可选子服务时，系统 MUST 不依赖向核心服务（例如 `api`）注入业务 env 才能完成装配；核心服务 MUST 通过 `config/app.yaml` 的配置与端点选择机制连接可选子服务。

#### Scenario: Enable optional overlay without api env wiring
- **WHEN** 用户启用某个可选 overlay/profile（例如 redis/storage/searxng/ollama）
- **THEN** 系统 SHALL 在不需要额外业务 env 注入的情况下完成连接或降级
- **AND** 核心路由保持可用

### Requirement: Composition diagnostics show selected endpoints
系统 MUST 在组合诊断输出（例如 `/health/dependencies`）中展示：
- 可选子服务是否启用
- 探活状态与恢复提示
- 实际选用的连接端点（若已锁定）

#### Scenario: Operator inspects optional dependency status
- **WHEN** 运维查询 `/health/dependencies`
- **THEN** 输出 SHALL 包含可选依赖的 enabled/status/endpoint（或未锁定原因）与 recovery_hint
