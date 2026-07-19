## 决策

1. **Phase 1 只做归属硬化，不做路径嵌套**：继续使用扁平 `/v2/sources/:id?notebookId=` 等形态；嵌套 `/v2/notebooks/:nid/...` 留到后续 BREAKING phase，避免与 c13/Eden 路径树大迁移耦合。
2. **跨本一律 404**：不返回 403，避免泄露「资源存在但不属于你」。
3. **Auth 仍 defer 到 c13**：本变更在单租户本地前提下补齐 notebook 边界；c13 鉴权应复用同一归属校验，而不是另起一套。

## 迁移与回滚

- **迁移**：前端与任何脚本/测试客户端必须带 `notebookId`；省略 → 400/404。
- **回滚**：恢复可选 `notebookId` 与旧错误映射；无 DB 迁移。

## 非目标

- OpenAPI 全量重生成 / 分页统一 / SSE 动词统一（后续 phase）
- 实现 JWT / API key
