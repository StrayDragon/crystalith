## 1. Shared SSOT

- [x] 1.1 将 `CitationSchema` 改为 camelCase；更新 `packages/shared` 测试与导出类型
- [x] 1.2 确认 OpenAPI/eden 随 schema 更新（typecheck）

验证：`cd packages/shared && bun test`

## 2. Server emitters

- [x] 2.1 QA retrieve/hydrate/handler、messages、outputs、refine、citations context 等所有 Citation 输出改为 camelCase
- [x] 2.2 更新 server 单测 / 集成测中的 citation 字段断言

验证：`cd apps/server && bun test test/qa test/citations test/refine test/outputs`

## 3. Web UI unify

- [x] 3.1 UI `Citation`：`sourceTitle` → `sourceName`；更新 CitationsControl/Popover/Mark、Chat、WorkspaceLayout、utils
- [x] 3.2 删除 snake→camel 映射；`normalizeCitation` 仅保留缺省/数值规范化（或内联简化）
- [x] 3.3 更新相关前端测试

验证：`cd apps/web && bunx vitest run src/features/workspace/shared src/features/workspace/domains/messages/useChat.test.tsx`

## 4. 门禁

- [x] 4.1 `bun typecheck`（或仓库等价命令）通过
- [x] 4.2 `llman sdd validate c64-citation-wire-camelcase --strict --no-interactive`
