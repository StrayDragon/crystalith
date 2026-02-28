## 1. 基础设施（zh-CN only, locale-ready）

- [x] 1.1 增加轻量 i18n 模块（`zh-CN` 消息字典 + `t()` + 可选 hook），并保持可扩展到多 locale 的结构（本次不做语言切换）。
- [x] 1.2 定义稳定 key 命名规范（domain.path...），并提供 TypeScript 层最小类型约束以避免 key 漏拼。

## 2. 关键路径文案迁移（Phase 1）

- [x] 2.1 迁移 Workspace 核心空态/错误提示（如 onboarding banner、ErrorBoundary、Diagnostics）到 i18n 字典。
- [x] 2.2 迁移 Sources/Chat/Studio 中阻塞用户的关键提示（上传/导出/队列状态等）到 i18n 字典。
- [x] 2.3 清理用户可见的英文泄漏点，确保关键路径无明显中英文混杂的阻塞提示。

## 3. Guardrails（可选）

- [x] 3.1 增加最小约束：关键路径不允许新增硬编码字符串（通过 review 清单或轻量规则；不引入复杂外部平台/流程）。

## 4. Verification

- [x] 4.1 `cd frontend/web && pnpm test`
- [x] 4.2 `cd frontend/web && pnpm run typecheck`
- [x] 4.3 `cd frontend/web && pnpm run build`
- [x] 4.4 手动验收：无语言切换入口；关键路径文案集中且一致；无明显英文泄漏的阻塞提示。
