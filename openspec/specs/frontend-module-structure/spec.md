# frontend-module-structure Specification

## Purpose
TBD - created by archiving change refactor-frontend-layout-260129. Update Purpose after archive.
## Requirements
### Requirement: Workspace domain slicing
系统 MUST 在 `frontend/web/src/features/workspace/domains/<domain>/` 内组织 workspace 子域代码，并将与该子域相关的组件、hooks、api、types 聚合在同一域内。

#### Scenario: 新增 workspace 子域
- **WHEN** 新增一个 workspace 子功能（如 sources/chat/studio/research/graph）
- **THEN** 该子域代码 MUST 放入 `features/workspace/domains/<domain>/`
- **AND** 不得散落在 `features/workspace` 顶层

### Requirement: Domain naming alignment
系统 MUST 使 workspace 子域名称尽量与后端 feature 命名一致，以降低跨端理解成本。

#### Scenario: 映射 workspace chat 到后端 messages
- **WHEN** 前端需要承载对话相关功能
- **THEN** 子域名称 MUST 使用 `messages`（与后端一致）
- **AND** 现有 `chat` 相关组件归入 `domains/messages`

### Requirement: Refine domain isolation
系统 MUST 将 refine 相关功能归属到 `features/workspace/domains/refine/`，避免与 outputs 产生隐式耦合。

#### Scenario: 迁移 refine UI 逻辑
- **WHEN** 前端需要组织 refine 的 UI/状态/交互
- **THEN** 相关组件与 hooks MUST 放入 `domains/refine/`
- **AND** outputs 仅保留与输出展示/队列相关的内容

### Requirement: Workspace shared boundary
系统 MUST 将 workspace 内部跨域共享逻辑放在 `features/workspace/shared/`，并避免子域之间的直接运行时导入。

#### Scenario: 子域依赖共享逻辑
- **WHEN** 一个子域需要复用 workspace 内部逻辑或 UI
- **THEN** 该复用内容 MUST 放入 `features/workspace/shared/`
- **AND** 其他子域通过 `features/workspace/shared/` 引用

### Requirement: App entrypoint isolation
系统 MUST 保持 `frontend/web/src/app` 仅负责应用入口与全局 Provider 装配，业务逻辑位于 features 中。

#### Scenario: 添加全局能力
- **WHEN** 新增全局 Provider 或应用级配置
- **THEN** 代码 MUST 放入 `src/app/`
- **AND** 不得在 `src/app/` 内引入具体业务逻辑实现

### Requirement: Cross-feature shared modules
系统 MUST 将跨 feature 复用的 UI、hooks、types 放入 `frontend/web/src/shared/`。

#### Scenario: 跨 feature 复用组件
- **WHEN** 一个组件被多个 feature 复用
- **THEN** 该组件 MUST 位于 `src/shared/`
- **AND** feature 内部不再维护重复实现

### Requirement: Core logic unit tests
系统 MUST 为 workspace 核心逻辑（reducer、关键 hooks、关键 utils）提供 Vitest 单测覆盖，以降低结构重构风险。

#### Scenario: 修改 workspace reducer
- **WHEN** 对 workspace reducer 或关键 hooks/utils 进行修改
- **THEN** 必须存在对应的单测覆盖其关键行为与边界场景

### Requirement: Live workspace E2E baseline
系统 MUST 维护 workspace 关键流程的 live E2E 覆盖，并将其作为结构重构的验证入口。

#### Scenario: 结构重构验证
- **WHEN** 迁移 workspace 子域或调整目录结构
- **THEN** 必须运行 `./scripts/run-e2e.sh` 并通过
