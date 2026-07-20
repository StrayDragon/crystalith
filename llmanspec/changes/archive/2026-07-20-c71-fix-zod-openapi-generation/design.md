## 决策

1. **优先修生成管线**，保留 Scalar；失败则评估 Elysia 原生 OpenAPI 导出，但仍由 shared Zod 驱动字段。
2. **禁止** 恢复 `api/generated/` 作为一等 TS client。
3. 验收以「进程内生成不崩溃 + 关键 path 出现在文档」为准。

## 落地（apply）

根因：`OpenApiGeneratorV31` 在 Zod v4 上于 `isNullableSchema`（`safeParse(null)`）对全量 router schema 栈溢出。

绕过：`registerApiDoc` 用 Zod 原生 `z.toJSONSchema(..., { target: 'openapi-3.0', unrepresentable: 'any' })` 转 JSON Schema，自行组装 OpenAPI 3.1；仍用 `extendZodWithOpenApi` 仅服务 schema 上的 `.openapi()` 元数据。门禁：`apps/server/test/openapi-generation.test.ts`。

## 非目标

- 分页/嵌套/SSE 行为（c68–c70）
- 完美覆盖每一个内部 eval 路由的示例
