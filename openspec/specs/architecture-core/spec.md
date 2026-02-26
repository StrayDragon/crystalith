# architecture-core Specification

## Purpose

定义 Crystalith 的前后端基础结构约束：模块切分、依赖方向、入口聚合、共享边界与状态组织。该规范只覆盖结构与边界，不覆盖业务语义。

## Non-goals

- 不定义具体业务 API 字段
- 不约束 UI 视觉与交互细节

## Requirements

### Requirement: Backend follows feature-sliced layout
后端 MUST 使用 `web -> features -> shared` 分层，并在 `features/<feature>/api.py` 作为该 feature 的单一路由入口。

#### Scenario: Add a new backend feature
- **WHEN** 开发者新增一个后端 feature
- **THEN** 该 feature SHALL 以 `features/<feature>/api.py` 作为单一路由入口并遵循 `web -> features -> shared` 分层

### Requirement: Dependency direction is one-way
`features` MUST NOT 依赖 `web`；`shared` MUST NOT 依赖 `features` 或 `web`。仅类型标注可在 `TYPE_CHECKING` 中例外。

#### Scenario: Import layering is enforced
- **WHEN** 代码引入了跨层依赖（如 `shared` 导入 `features`）
- **THEN** 系统 SHALL 视为违规并要求修正（类型标注可在 `TYPE_CHECKING` 中例外）

### Requirement: Router aggregation is centralized
所有后端路由 MUST 在 `crystalith/web` 统一注册，避免多入口隐式依赖链。

#### Scenario: Register a new route
- **WHEN** 开发者增加一个新的 API 路由
- **THEN** 路由 SHALL 在 `crystalith/web` 统一聚合注册而非分散在多个入口

### Requirement: Frontend workspace is domain-sliced
前端工作区 MUST 按 `domains/<domain>/` 组织，每个 domain MUST 有可独立装配的入口组件。

#### Scenario: Add a new frontend domain
- **WHEN** 新增一个 UI domain
- **THEN** 代码 SHALL 放置在 `domains/<domain>/`，并提供可独立装配的入口组件

### Requirement: Frontend app/shared boundaries stay thin
`src/app` 仅负责入口装配，跨 feature 复用 MUST 放到 `src/shared` 或 `features/workspace/shared`。

#### Scenario: Place cross-feature UI reuse
- **WHEN** 需要跨 feature 复用组件或工具
- **THEN** 复用代码 SHALL 放入 `src/shared` 或 `features/workspace/shared`，而非堆积在 `src/app`

### Requirement: Workspace state uses sliced Zustand stores
复杂工作区状态 MUST 按 slice 组织并通过 selector 访问，避免全局重渲染与循环依赖。

#### Scenario: Add a new workspace state slice
- **WHEN** UI 需要新增一类复杂的工作区状态
- **THEN** 状态 SHALL 以 slice 组织并通过 selector 访问以避免全局重渲染与循环依赖
