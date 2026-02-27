## Context

Workspace 已具备模块化画布布局与多域能力（notebooks/sources/sessions/messages/outputs/studio），但缺少“引导式信息架构”：在数据为空或连接异常时，用户无法快速建立正确的操作路径与期望。

后端已提供 `/health` 与 `/health/dependencies`（含可选服务状态、recovery_hint），但前端未将其转化为可见、可操作的产品体验。

## Goals / Non-Goals

**Goals:**
- 为首次进入与常见空态提供确定性的下一步指引（减少学习成本，提升激活率）。
- 将连接状态/可选服务状态从“隐性”变为“可见、可操作、可解释”。
- 保持对熟练用户的低打扰：引导可关闭、可跳过，不改变既有核心路径。

**Non-Goals:**
- 不重做整体 UI 风格或替换现有布局系统（GridStack/ModularCanvas）。
- 不引入新的后端业务能力（优先复用现有健康端点与状态）。
- 不在本变更中增加账号体系、多用户协作等能力。

## Decisions

- **Workspace Readiness 选择器**：在前端建立一个只读的“就绪状态”派生层（基于 connection/notebooks/sources/sessions 的 loading 与空态），将 UI 引导逻辑从 `WorkspaceLayout` 的临时条件分支中抽离出来。
- **引导组件形态**：以轻量的 banner + 空态卡片为主；必要时使用 overlay，但遵守 `workspace-ui-core` 的统一 layer policy（Esc/点击遮罩关闭）。
- **健康信息来源**：默认读取 `/health/dependencies`，将 optional services 的 `status/error_code/recovery_hint` 映射为 UI 诊断条目；避免在前端硬编码可选服务规则。
- **默认笔记本策略**：保留自动创建默认笔记本（生产默认也保持开启），在 UI 上显式提示并提供“改名/删除/新建”快捷入口，避免用户误解。

## Risks / Trade-offs

- [引导层增加条件分支导致复杂度上升] → 使用单一 readiness selector + 组件化渲染，限制入口数量并加测试覆盖。
- [对熟练用户造成打扰] → 引导默认弱提示、可关闭，并在 localStorage 记录“已知晓”状态。
- [健康信息不稳定/不在 OpenAPI 内] → 仍可消费现有端点；如未来需要稳定契约，再拆分出版本化诊断 API 的独立变更。

## Migration Plan

- 无数据迁移。
- 渐进上线：先加入引导与健康入口，保持旧路径可用；出现回归时可快速回滚为“仅提示，不阻断”。

## Open Questions

- （无）
