# 任务：简化前端 API 客户端

- [x] 1. 审计 `frontend/web/src/api/client.ts` 中的手写端点并分类：
      - 生成 SDK 已覆盖（可删除）
      - OpenAPI 缺失（需要手写模块或补齐 OpenAPI）
      - 流式/SSE（需特殊处理）
- [x] 2. 确定最终方案（A/B/C）并记录结论。
- [x] 3. 若采用方案 A 或 B：创建最小手写模块与统一错误处理；配置生成客户端。（本次无需新增手写模块，已通过 `api/setup.ts` 统一配置/错误处理）
- [x] 4. 更新业务代码导入，改为直接使用生成 SDK 或新手写模块。
- [x] 5. 更新测试与 mock 路径以匹配新的导入方式。
- [x] 6. 如涉及 OpenAPI 变更，执行 `pnpm run api:generate`；确认 `just sdk-gen` 保持一致。（本次未改 OpenAPI）
- [x] 7. 运行 `pnpm test`（前端）或最小范围的相关测试验证。（已运行）
