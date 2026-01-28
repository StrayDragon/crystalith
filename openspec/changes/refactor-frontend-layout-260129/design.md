## Context
- 现有前端仅有 `features/workspace` 一个顶层 feature，且内部聚合了 sources/chat/studio/research/graph 等多域功能。
- 关键组件与 hooks 文件体量偏大，边界模糊，修改成本与回归风险上升。
- E2E 覆盖需支撑长耗时流程，作为结构重构的回归保障。
- 核心逻辑（reducer/hooks/utils）缺少单测，重构时回归风险放大。
- 项目已引入 Playwright 与 `frontend/web/e2e/`，具备扩展基础。

## Goals / Non-Goals
- Goals:
  - 在不改变对外 UI 行为的前提下，按 workspace 子域拆分组织结构，并与后端域名尽量对齐以减少认知偏差。
  - 先建立可靠的 live E2E 基线，作为结构迁移的安全网。
  - 为核心逻辑补齐 Vitest 单测，降低重构回归风险。
  - 采用“小步迁移 + 每步验证”，避免大爆炸式改动。
- Non-Goals:
  - 不新增业务功能或改变现有 UI 语义。
  - 不引入新的前端框架或状态管理体系（如 Redux）。
  - 不强制套用后端的严格三层依赖模式，只吸收其“边界清晰”的原则。

## Decisions
- Decision: 选择 A 路径：保持顶层 `features/workspace`，在内部引入 `domains/<domain>/` 与 `shared/`。
  - 原因：当前仅 workspace 页面入口，直接上升到多 feature 会增加迁移成本与风险。
- Decision: 子域命名尽量与后端一致（notebooks/sessions/messages/analysis/sources/outputs/refine/studio/research），前端 chat 归属 messages 域。
- Decision: refine 独立为 `domains/refine`，与后端 feature 对齐，避免与 outputs 产生隐式耦合。
- Decision: E2E 使用 Playwright（已有），采用 live-only 流程作为重构验证入口。
  - 原因：要求真实行为验证，避免 mock 与真实处理偏差。
- Decision: 核心逻辑单测使用 Vitest（已有），优先覆盖 reducer、关键 hooks 与核心 utils。
- Decision: 不保留兼容 re-export 或旧路径别名。
  - 原因：避免长期维护双路径与隐式依赖，确保结构清晰。
- Decision: E2E 稳定性策略优先使用 API mock + expect.poll + 明确超时配置。

## Alternatives considered
- 直接将 workspace 拆成顶层多个 features（B 路径）。
  - 缺点：当前仅单入口场景下收益有限，迁移成本与风险更高。
- 切换 Cypress 等 E2E 框架。
  - 缺点：已引入 Playwright，迁移成本高且无明显收益。

## Risks / Trade-offs
- 风险：结构迁移导致 import 断裂或 UI 回归。
  - 缓解：先补齐 E2E 基线；每个子域迁移后跑 E2E。
- 风险：live E2E 耗时更长且对环境依赖更高。
  - 缓解：使用 `./scripts/run-e2e.sh` 统一拉起环境，采用 expect.poll 与更长 timeout。
- 风险：长耗时流程导致 E2E 不稳定。
  - 缓解：默认使用 mock；live 仅在必要时运行并配置更长超时。

## Migration Plan
1. **E2E 基线阶段**：扩展 Playwright 测试覆盖关键流程（live-only）；整理等待策略与稳定选择器。
2. **单测基线阶段**：为 reducer、核心 hooks、关键 utils 增加 Vitest 覆盖。
3. **Workspace 结构拆分**：建立 `domains/` 与 `shared/` 结构，按子域逐步迁移（notebooks → sessions → messages → analysis → sources → outputs → refine → studio → research）。
4. **清理与验证**：移除旧路径，统一 import；每阶段执行 E2E + 单测；最终全量验证。

## Component Extraction Candidates (调研结果)
- **Dialog Header 模式**：`SessionDetailDialog.tsx`、`SourceDetailDialog.tsx`、`SlidesStudioDialog.tsx`、`StudioToolsGrid.tsx`、`StudioPanel.tsx` 内部均有“图标 + 标题/副标题 + 右侧操作”布局，可抽为 `WorkspaceDialogHeader`。
- **Fullscreen + Close 操作**：`SourceDetailDialog.tsx`、`SessionDetailDialog.tsx`、`SlidesStudioDialog.tsx` 存在相似的全屏切换与关闭按钮组合，可抽为可复用 action 组。
- **Overlay Dialog Shell**：`ResearchDetailPanel.tsx`、`AddSearchResultDialog.tsx` 使用自定义 overlay 容器，结构相近，可抽为 `WorkspaceOverlayDialog`（保留 z-index 控制）。
- **Empty/Loading State**：`SessionDetailDialog.tsx`、`SourceDetailDialog.tsx`、`StudioToolsGrid.tsx` 等存在重复的空/加载态结构，可抽为 `WorkspaceEmptyState`/`WorkspaceLoadingState`。

## Open Questions
- workspace 内部哪些组件应抽离为共享 UI（例如 dialog header/empty state/toolbar）？
