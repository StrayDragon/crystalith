## MODIFIED Requirements

### Requirement: Production stack is runnable from layered prod manifests
`deployments/prod` MUST 提供可一键启动的生产栈配置，且该配置 MUST 将 `frontend` 与 `backend` 定义为核心必选服务；任何附加服务 MUST 通过 profile 或等价组合开关显式启用。
规范术语与 Compose 服务名映射 MUST 固定为：`frontend -> web`，`backend -> api`。

#### Scenario: Deploying core production stack
- **WHEN** 运维使用生产清单在未启用可选 profile 的情况下部署
- **THEN** 系统 SHALL 启动前后端核心服务并保持可选服务默认关闭

### Requirement: Optional offline Ollama composition is supported
生产 compose MUST 支持可选本地 Ollama 组合（overlay 或 `ollama` profile），且在未启用该可选组合时 MUST 允许使用外部 Ollama 或其他 embedding/chat 提供方，不得强制绑定本地 Ollama 容器。

#### Scenario: Using external Ollama without profile
- **WHEN** 用户未启用本地 Ollama 可选组合且配置了外部 Ollama 地址
- **THEN** 系统 SHALL 使用外部地址完成模型调用并保持部署栈有效

### Requirement: Deployment entrypoints are documented
`deployments/README.md` MUST 清晰区分核心最小拓扑与可选增强拓扑，并为每个可选 profile 提供启用条件、依赖说明与验收步骤。

#### Scenario: New operator follows deployment docs
- **WHEN** 新操作者仅按部署文档执行核心启动步骤
- **THEN** 系统 SHALL 在不引入额外服务的情况下可运行并可通过基础健康检查

## ADDED Requirements

### Requirement: Local development entrypoint mirrors composition model
本地开发入口 MUST 与部署入口共享“核心 + 可选 profile”模型，使开发与生产在依赖启停语义上保持一致。

#### Scenario: Local dev with optional profile
- **WHEN** 开发者在本地启用可选 profile
- **THEN** 本地运行形态 SHALL 与部署形态在服务组合与探活行为上保持一致

### Requirement: Compose composition follows merge-first rule
部署组合 MUST 以 `-f` merge（core + optional overlays）作为主路径；`profiles` 可作为可选增强，`include` 仅可用于强隔离模块，且不得引入同名服务/网络/卷冲突。

#### Scenario: Enabling optional overlays with merge
- **WHEN** 用户基于核心清单叠加一个或多个可选 overlay
- **THEN** 系统 SHALL 仅启用被显式选择的可选服务，且核心服务定义保持可预期
