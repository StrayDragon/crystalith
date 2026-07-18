## 1. Server nested routes + alias

- [ ] 1.1 新增 `/v2/notebooks/:nid/{outputs,research,qa,refine,studio/slides,sources}` canonical handlers（复用现有业务逻辑）
- [ ] 1.2 扁平路径改为 thin alias（转发或同 handler），文档标 Deprecation
- [ ] 1.3 OpenAPI registerApiDoc 登记新路径；旧路径标 deprecated

验证：`cd apps/server && bun test`

## 2. Frontend Eden 迁移

- [ ] 2.1 所有 notebook-scoped 调用改嵌套 path
- [ ] 2.2 更新 Vitest / e2e 对路径的假设

验证：相关 web test + `just e2e`（或 `just qa`）

## 3. 门禁

- [ ] 3.1 `llman sdd validate c69-nest-notebook-scoped-paths --strict --no-interactive`
- [ ] 3.2 `just qa`
