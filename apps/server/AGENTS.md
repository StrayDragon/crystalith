# apps/server — Bun + Elysia API

Crystalith v2 HTTP server: Elysia + Drizzle (bun:sqlite) + Vercel AI SDK + sqlite-vec.

## Layout

```
src/
├── server.ts              # createApp() + listen; export type App for eden
├── openapi.ts / asyncapi.ts
├── ai/                    # provider registry, generate, stream, middleware, tools
├── db/                    # Drizzle schema, vectors, migrate
├── rag/                   # chunker, embedder, search, cache, strategy registry
├── features/              # domain routers (notebooks, qa, research, sources, …)
└── shared/                # config, queue, semaphore, net/SSRF, extraction, storage
```

Types/schemas: import from `@crystalith/shared` — do not redefine Zod models here.
Config yaml/env: Zod in `shared/config.ts`（合法席位；见根 `AGENTS.md` Zod/Eden 表）.
Web 一等 client 是 Eden（`treaty<App>`）；OpenAPI 是衍生面 — **Eden ≠ Zod**。

## Commands

```bash
bun dev              # --watch on :8032
bun test             # Bun test under this package (unit + may pick up tests/)
bun run typecheck    # tsc --noEmit
bun run db:generate  # drizzle-kit generate
bun run db:migrate   # drizzle-kit migrate
bun run build        # bun build --compile → crystalith-server
```

From repo root:

- `just test` — gate unit/integration: `apps/server/tests/` + `packages/shared/test/`
- `just test-bdd` — Gherkin CRUD subset in `tests/bdd/` (**not** in `just qa`; many domains skipped via `SKIP_FEATURE_DIRS`)
- `just qa` — primary PR gate (see root `AGENTS.md`)
- `just dev-server` — watch server on :8032

## Conventions

- One Elysia router per feature under `features/*/router.ts`
- **日志**：统一走 `shared/logger.ts`（JSON 行、CL_LOG_LEVEL 控制级别）；HTTP 层自动产出
  access log 与 `x-request-id` 关联（onRequest 注入/回显，onError 结构化输出）。
  service 层新代码优先 logger；requestId 深度传播待上下文机制落地后再接
- **鉴权预留（c13）**：Bearer 鉴权落地时 MUST 经 Elysia `.macro({ auth })` 承载（路由级
  `{ auth: true }` 声明），MUST NOT 在各 handler 内手工插鉴权调用；归属校验类横切逻辑同理优先 guard/derive
- OpenAPI: shared Zod → `z.toJSONSchema` in `openapi.ts` (Scalar `/openapi`); `extendZodWithOpenApi` only for `.openapi()` metadata — **no** `@elysiajs/swagger` / `t.*`
- OpenAPI 路由文案：`registerApiDoc` 的 `summary` 用中文业务说明（Scalar 标题仍是 path）；tag 说明维护在 `OPENAPI_TAG_DESCRIPTIONS`；细则见根 `AGENTS.md`「OpenAPI / Scalar 路由文档」
- AsyncAPI（`asyncapi.ts`）SSE 通道/事件描述同样用中文业务说明，与上条同一文风
- AI: AI SDK v7 first（`generateText`/`streamText`/`ToolLoopAgent`/`Output`）；其它编排框架须在 SDD design 论证后引入，且不得另立 ResearchRun 平行过程态
- Config: `config/app.yaml`；API keys 走 `CL_*` env 或 gitignored `.env`（see `config/AGENTS.md`；legacy `config/secret.env` 机制已移除，加载即抛错）
- **Outbound HTTP (non-LLM)**: use `shared/net/outbound-fetch.ts` (`outboundFetch`) — or helpers that wrap it (`fetchWithRedirectGuard`). Do **not** bare-`fetch` search / URL fetch / web extractors. AI SDK providers stay direct unless a future per-provider proxy lands. Global switch: `proxy_settings` in `config/app.yaml`.
- Research prune closure（`collectResearchPruneClosure` / product B）须与 Web Lab `research-lab/model/pruneClosure.collectPruneClosure` 同步；规格见 `llmanspec/changes/update-research-prune-cascade`

## Progress

Package rules defer to root `AGENTS.md` for repo-wide decisions.
