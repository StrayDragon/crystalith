## Why

- 当前 Workspace 的能力面很全（Sources/Chat/Studio/画布布局/快捷键），但“第一次进入”缺少明确的下一步指引：用户经常面对空列表/空对话而不知道该做什么。
- 连接失败、可选服务降级等状态虽然在后端可探测，但前端缺少“可见且可操作”的健康提示，导致体验不确定、排障成本高。

## What Changes

- 增加 Workspace 引导式空状态：按“未连接/无笔记本/无来源/无会话/可开始生成”分层给出下一步 CTA（创建笔记本、导入来源、开始会话、打开 Studio）。
- 增强顶部栏与全局层（overlay）策略：提供统一的“健康/诊断入口”和可发现的快捷键帮助（含 Ctrl+K 命令面板入口）。
- 将当前“自动创建默认笔记本”的行为产品化：明确展示发生了什么、为什么这样做，并允许用户手动创建/切换。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace-ui-core`: 增加首次进入/空状态的全局 UX 基线、健康提示与核心入口的可发现性要求。

## Impact

- Frontend: `frontend/web/src/features/workspace` 的布局与 header 增加“引导/健康”层；命令面板补齐核心动作。
- Backend: 不强依赖新增 API（优先复用 `/health` 与 `/health/dependencies`）；如需更稳定的诊断契约，后续可在独立变更中版本化。
- Docs: 补充“第一次使用”与常见失败态提示（与部署/配置文档互链）。
