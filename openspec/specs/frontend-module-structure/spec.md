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

#### Scenario: 各功能域可独立注册为 widget
- **WHEN** 模块化布局需要注册 widget
- **THEN** 每个功能域 MUST 导出可独立渲染的 widget 入口组件
- **AND** widget 入口组件封装该域的所有交互逻辑

### Requirement: GridStack 桥接层
系统 MUST 提供 GridStack 与 React 的桥接层，管理 widget 的生命周期、DOM 同步和 portal 渲染。

#### Scenario: Widget 注册与渲染
- **WHEN** 一个 widget 被添加到画布
- **THEN** 桥接层 MUST 在 GridStack 创建的 DOM 容器中通过 React Portal 渲染对应的 React 组件
- **AND** React 组件的生命周期与 GridStack widget 生命周期同步

#### Scenario: Widget 移除与清理
- **WHEN** 一个 widget 从画布移除
- **THEN** 桥接层 MUST 清理对应的 React Portal 和组件状态

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
- **THEN** 必须运行 E2E 测试（`cd frontend/web && pnpm test:e2e`）并通过

### Requirement: 共享骨架屏组件
系统 MUST 在 `src/shared/` 中提供统一的骨架屏组件库（SkeletonLine、SkeletonCard、SkeletonList），供所有 feature 复用。

#### Scenario: feature 使用共享骨架屏
- **WHEN** 任一 feature 需要展示加载状态
- **THEN** 使用 `src/shared/` 中的骨架屏组件
- **AND** 不在 feature 内部维护独立的骨架屏实现

### Requirement: Zustand Store Architecture
前端 SHALL 使用 Zustand 进行工作区状态管理，替代 React Context + useReducer。状态 MUST 按领域拆分为独立的 slice（notebooks, sessions, sources, messages, outputs, research, ui）。

#### Scenario: 细粒度状态订阅
- **WHEN** source 列表发生变化
- **THEN** 仅订阅 sources slice 的组件重渲染，其他面板不受影响

#### Scenario: Domain hook 接口不变
- **WHEN** 组件调用 useNotebooks() hook
- **THEN** 返回与迁移前相同的接口（notebooks 列表、CRUD 方法等）

#### Scenario: 跨 slice 状态引用
- **WHEN** sessions slice 需要引用当前 active notebook id
- **THEN** 通过 store.getState() 或 selector 组合访问，不引入循环依赖

### Requirement: Container/presentation split for complex domain panels
系统 MUST 将复杂 domain panel 的副作用逻辑（数据请求、轮询、取消、重试、状态机）集中在 domain hooks（例如 `useSources`、`useResearch`）中，并将展示逻辑拆为可复用的展示组件，使 UI 组件在给定 props 时尽量保持纯渲染。

#### Scenario: 网络副作用集中在 hook
- **WHEN** 某个 domain panel 需要发起请求并维护加载/错误/分页等状态
- **THEN** 请求与状态管理逻辑位于 domain hook 内
- **AND** 展示组件通过 props 接收数据与回调，不直接在组件体内发起请求

#### Scenario: 大组件可渐进拆分
- **WHEN** 一个 panel/布局组件增长到包含多个可复用 UI 片段（列表、详情、工具条、空状态）
- **THEN** 这些 UI 片段被拆分为独立组件并放入该 domain 的 components 目录
- **AND** 拆分不改变对外导出的 panel 组件接口
