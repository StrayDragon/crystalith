---
depends_on:
  - c68-align-openapi-and-pagination
---

## Why

Zod v4 + 现有 `zod-to-openapi` / `createApp()` 全量文档生成曾出现 **stack overflow / hang**，导致 Scalar `/openapi` 与 `/openapi.json` 不可信或不可用。c68 以「路由挂载 Zod + registerApiDoc」为验收，生成管线仍是债。

## What Changes

- **修复或替换** OpenAPI 文档生成管线，使 `generateOpenApiDocument()`（或等价）在加载全部 router 后稳定产出 `/openapi.json`。
- **门禁**：可选脚本/测试断言关键 path 存在且无生成崩溃（不恢复 `api/generated` 一等 client）。
- **非目标**：不改 Eden 一等 client 策略；不引入 hey-api。

## Capabilities

- `openapi-and-client-generation`

## Impact

- `apps/server/src/openapi.ts`、`server.ts` OpenAPI 插件
- 可能升级/替换 `@asteasolutions/zod-to-openapi` 或改为从 Elysia 路由元数据导出
- CI/本地访问 `/openapi` 冒烟
