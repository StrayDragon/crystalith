# add-v2-frontend-eden — 前端 API 层：Elysia eden RPC 替换 OpenAPI 生成链路

## Why

v1 前端通过 @hey-api/openapi-ts 从后端 OpenAPI schema 生成 TypeScript 客户端 → `src/api/generated/`。v2 Elysia 提供 eden RPC，通过 `import type { App } from "@crystalith/server"` + `treaty<App>(url)` 实现端到端类型安全 RPC，免生成、免代码漂移。

## What Changes

- **NEW** `frontend/web/src/api/client.ts` — eden treaty 客户端初始化
- **MODIFIED** `frontend/web/src/features/workspace/domains/*/` — 逐步替换 generated client 调用
- **REMOVED** `frontend/web/openapi.gen.json` (Phase 5)
- **REMOVED** `frontend/web/src/api/generated/` (Phase 5)
- **REMOVED** `@hey-api/openapi-ts` 依赖 (Phase 5)

## Capabilities

- openapi-and-client-generation (spec delta: 前端 API 层从生成迁移到 eden RPC)

## Impact

- **BREAKING**: 前端 API 调用方式从生成 client 函数改为 eden treaty 类型安全 RPC
- 砍掉 `pnpm run api:sync` 整条链（fetch → generate → check）
- 每次 server type 变更前端即时感知（TS 编译报错）
