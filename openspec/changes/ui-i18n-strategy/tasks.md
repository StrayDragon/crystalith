## 1. 语言策略与基础设施

- [ ] 1.1 明确支持的 locale 列表与默认规则（浏览器语言 → fallback），并在前端实现可复用的 locale 解析与持久化（localStorage）。
- [ ] 1.2 增加轻量 i18n 模块（消息字典 + `t()` + hook），并定义稳定 key 命名规范。

## 2. Workspace 入口与切换

- [ ] 2.1 在 Workspace Header（或设置菜单）增加语言切换入口，切换后立即生效且刷新后保持。

## 3. 关键路径文案迁移（Phase 1）

- [ ] 3.1 迁移 Workspace 核心空态/错误提示（如 onboarding banner、连接失败、诊断入口）到 i18n 字典。
- [ ] 3.2 迁移 Sources/Chat/Studio 中阻塞用户的关键提示（上传/导出/队列状态等）到 i18n 字典。
- [ ] 3.3 补齐英文翻译并建立最小术语一致性（Notebook/Source/Session 等）。

## 4. Guardrails（可选）

- [ ] 4.1 增加最小约束：关键路径不允许新增硬编码中文字符串（通过 review 清单或轻量 lint 规则）。

## 5. Verification

- [ ] 5.1 `cd frontend/web && pnpm test`
- [ ] 5.2 `cd frontend/web && pnpm run typecheck`
- [ ] 5.3 `cd frontend/web && pnpm run build`
- [ ] 5.4 手动验收：切换语言后关键路径文案统一且刷新后保持；无明显中英文混杂的阻塞提示。
