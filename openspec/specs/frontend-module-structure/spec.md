# frontend-module-structure Specification

## Purpose

定义 Crystalith 前端（Vite + React + TypeScript）**模块组织与边界规则**，重点覆盖：workspace domains 切分、GridStack↔React 桥接、Zustand store slice 边界、以及 shared 目录分层。

本 spec 只约束“结构/边界/依赖方向”，不规定视觉风格与交互细节：跨域 UX 原语见 `workspace-ux-system/spec.md`；测试与 CI 门槛见 `ci-cd/spec.md`。

## Related specs

- `workspace-ui/spec.md`
- `modular-canvas-layout/spec.md`
- `workspace-ux-system/spec.md`
- `frontend-api-client/spec.md`
- `ci-cd/spec.md`

## Requirements
### Requirement: Workspace domain slicing
系统 MUST 在 `frontend/web/src/features/workspace/domains/<domain>/` 内组织 workspace 子域代码，并将该子域相关的组件、hooks、api、types 聚合在同一域内（避免散落在 `features/workspace` 顶层）。

每个 domain MUST 导出可独立渲染的 widget 入口组件，用于模块化布局注册；该入口组件封装该域的交互逻辑（数据请求/副作用/状态机）。

### Requirement: Workspace domain naming stays aligned cross-stack
系统 SHOULD 使 workspace domain 命名与后端 feature 命名一致以降低跨端理解成本；对话域 MUST 使用 `domains/messages`（而非 `chat`）。

### Requirement: GridStack ↔ React bridge exists
系统 MUST 提供 GridStack 与 React 的桥接层：在 GridStack widget DOM 容器中以 React Portal 渲染组件，并在 widget 移除时清理 portal 与相关状态（生命周期与 GridStack 同步）。

### Requirement: Workspace shared boundary is explicit
系统 MUST 将 workspace 内部跨域共享逻辑放入 `frontend/web/src/features/workspace/shared/`，并避免 domains 之间的直接运行时导入（跨域复用应经由 shared 目录或 API 抽象完成）。

### Requirement: App and shared layers stay thin
系统 MUST 保持 `frontend/web/src/app/` 仅负责入口与全局 Provider 装配，不承载具体业务逻辑；跨 feature 复用的 UI/hooks/types MUST 放入 `frontend/web/src/shared/`。

### Requirement: Workspace state uses Zustand slices
工作区状态管理 SHALL 使用 Zustand；状态 MUST 按领域拆分为独立 slice（至少包含 notebooks/sessions/sources/messages/outputs/research/ui），并通过 selector/`store.getState()` 组合访问跨 slice 状态，避免循环依赖与全局重渲染。

### Requirement: Container/presentation split is enforced for complex panels
复杂 domain panel 的副作用（请求/轮询/取消/重试）MUST 收敛在 domain hooks（如 `useSources`、`useResearch`）中；展示组件尽量保持“给定 props 即纯渲染”，并可渐进拆分为 `components/` 下的可复用片段而不改变对外入口接口。
