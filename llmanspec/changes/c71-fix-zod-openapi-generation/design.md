## 决策

1. **优先修生成管线**，保留 Scalar；失败则评估 Elysia 原生 OpenAPI 导出，但仍由 shared Zod 驱动字段。
2. **禁止** 恢复 `api/generated/` 作为一等 TS client。
3. 验收以「进程内生成不崩溃 + 关键 path 出现在文档」为准。

## 非目标

- 分页/嵌套/SSE 行为（c68–c70）
- 完美覆盖每一个内部 eval 路由的示例
