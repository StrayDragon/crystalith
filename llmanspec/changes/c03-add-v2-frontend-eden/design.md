## Approach

Elysia eden RPC 替换 OpenAPI 生成链路。**内部** TypeScript 前端用 eden treaty 获得零代码生成的类型安全 RPC。
**外部** 用户通过 `/openapi.json` → `openapi-generator` 生成 Python/Go/Rust SDK。

### Internal: eden treaty (TypeScript)

```ts
// frontend/web/src/api/client.ts
import { treaty } from '@elysiajs/eden';
import type { App } from '@crystalith/server';

export const api = treaty<App>('http://localhost:8032');

// Usage: type-safe, autocomplete on every path
const notebooks = await api.v2.notebooks.get();
const created = await api.v2.notebooks.post({ name: 'My Notebook' });
```

### External: OpenAPI SDK Generation

Server 通过 `@asteasolutions/zod-to-openapi` serve `/openapi.json`（从 `packages/shared` 的 Zod schema 自动生成）：

```bash
# External users workflow
curl http://localhost:8032/openapi.json > crystalith-openapi.json
openapi-generator-cli generate -i crystalith-openapi.json -g python -o crystalith-py-client
openapi-generator-cli generate -i crystalith-openapi.json -g go -o crystalith-go-client
```

SSOT 路径: `packages/shared/src/schemas/` → Zod → `@asteasolutions/zod-to-openapi` → `/openapi.json` → 外部 SDK

### API Prefix

所有端点使用 `/v2/` 前缀（BREAKING: 不再兼容 `/v1/`）。

### Migration Plan

每个 domain 一个 PR，逐步替换 generated client 调用：
1. notebooks domain
2. sessions domain
3. messages domain
4. sources domain
5. outputs domain
6. analysis/studio/refine/research

全部迁移完成后（Phase 5 / cleanup），删除 `openapi.gen.json`、`src/api/generated/`、`@hey-api/openapi-ts`。
