<!-- LLMANSPEC:START -->

# LLMAN Spec-Driven Development

This project uses llman SDD. Read `llmanspec/config.yaml` for SDD command behavior configuration, and `llmanspec/AGENTS.md` for additional project-specific rules.

## SDD Pipeline

Use `/llman-sdd-explore` to get started, then follow the pipeline: `/llman-sdd-propose` → `/llman-sdd-apply` → `/llman-sdd-verify` → `/llman-sdd-archive`.

Keep this managed block so `llman sdd init --update` can refresh it.
<!-- LLMANSPEC:END -->

# Crystalith v2 — AI Agent Guidelines

> Bun + TypeScript rewrite (Elysia + React). **v1 Python SSOT (`backend/py/`) has been removed as of c14** — all behavior is now parity-confirmed in TypeScript.
> **Status**: c00–c62 all DONE, c14 DONE, c13 BLOCKED (distribution).

## Project Structure

```
crystalith/
├── apps/
│   ├── server/           # Bun + Elysia + Drizzle + AI SDK + sqlite-vec
│   │   └── src/
│   │       ├── server.ts           # Entry: Elysia HTTP server
│   │       ├── features/           # Business domains
│   │       ├── ai/                 # Provider registry, generate, stream
│   │       ├── rag/                # Chunk/embed/search + strategy registry
│   │       ├── shared/             # Config, queue, net, extraction
│   │       └── db/                 # Drizzle schema + migrations
│   └── web/               # Vite + React + TypeScript SPA
│       └── src/
│           ├── features/workspace/ # Main workspace UI
│           ├── api/                # eden RPC; types in shared-types.ts
│           └── shared/             # Shared UI utilities, Layer system
├── packages/
│   ├── shared/            # Zod schemas + types SSOT
│   │   └── src/schemas/   # notebook, session, message, source, qa, output,
│   │                      # research, analysis, studio, refine, model, etc.
│   └── crystalith-slidev/ # Slidev integration
├── config/                # Runtime config (app.yaml + secret.env)
├── llmanspec/             # Spec-driven development specs + changes
├── data/                  # Runtime DB + uploads (gitignored)
└── scripts/               # Maintenance scripts
```

## Current State

- ✅ All c00–c62 completed (63 changes); v1 parity confirmed through E2E
- ✅ Frontend: all output renderers aligned with v1 interactive components
- ✅ c14: `backend/py/` + `api/generated/` deleted, types migrated to `shared-types.ts`
- ⏸️ **c13** distribution (Tauri / single-binary) — blocked on human auth

## v2 Stack

| Role                 | Technology                                              |
| -------------------- | ------------------------------------------------------- |
| Runtime              | **Bun** (single binary, bun:sqlite built-in)            |
| Web Framework        | **Elysia** (eden RPC — zero-codegen type-safe client)   |
| ORM                  | **Drizzle ORM** (bun-sqlite driver)                     |
| AI Runtime           | **Vercel AI SDK v7** (`ai` + `@ai-sdk/*`)               |
| Schema Validation    | **Zod** (shared frontend/backend via `packages/shared`) |
| Vector Store         | **sqlite-vec** (in-process, same DB file)               |
| PDF Parsing          | **unpdf**                                               |
| Template Engine      | **Nunjucks** (frontend)                                 |
| Desktop Distribution | **Tauri v2** + Bun sidecar (c13)                        |

## Build, Test, and Development Commands

From repo root:

- `bun install` — install all dependencies
- `bun dev` / `just dev` — Overmind (`Procfile`: server + web + slidev)
- `bun run dev:server` / `just dev-server` — server only (:8032)
- `bun run dev:web` / `just dev-web` — Vite only (:3000)
- `bun test` — run server tests
- `bun typecheck` — typecheck everything

Fast path:

- `cd apps/server && bun dev` — Elysia server (port 8032)
- `cd apps/web && bun dev` — Vite (port 3000)
- `just dev-connect server` — attach to Overmind process
- `just dev-quit` — stop Overmind session

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System**: Use `apps/web/src/shared/layer/` — never hardcode z-index
- Formatter: `oxfmt`; linter: `oxlint`

## Architecture Decisions

### Zod SSOT

All types: `packages/shared/src/schemas/`. Elysia 1.4+ consumes Zod v4 natively.
**No** `@elysiajs/swagger`, **no** Elysia `t.*`. OpenAPI via `@asteasolutions/zod-to-openapi`, Scalar UI at `/openapi`.

```
packages/shared/src/schemas/   ← SSOT
    ├──→ server routes (body: z.*)
    ├──→ eden treaty (treaty<App>)
    └──→ /openapi.json → Scalar UI
```

### Schema Descriptions & i18n

- **All** Zod schema `.describe()` / `.openapi({ description })` calls MUST use the
  `desc()` helper from `packages/shared/src/schemas/i18n.ts`.
- **Language**: Chinese (zh-CN) is the authoritative description language.
- **i18n readiness**: The `desc(zh, _key?)` signature reserves an optional
  translation key for future migration. When i18n is enabled, changing the
  backend (typesafe-i18n / i18next / Lingui) requires only modifying `i18n.ts`.
- **Zod → JSON Schema**: `.describe(desc(...))` populates `config/app.schema.gen.json`.
- **Zod → OpenAPI**: `.openapi({ description: desc(...) })` populates Scalar UI.
  Config-level schemas (config.ts) MAY use `.describe()` alone;
  API-level schemas (packages/shared/src/schemas/) SHOULD use
  `.openapi({ description: desc(...), example: ... })` for richer docs.

### AI SDK v7 Only

- `generateObject({ schema: Zod })` ✅ | `streamText` / `fullStream` ✅
- `ToolLoopAgent` — 🟡 Post-c13
- **Banned**: Pi agent-core, Mastra, LangGraph.js, XState, Inngest, Temporal

### Single Binary

`bun build --compile` → ~75MB. All deps bundled (sqlite-vec, unpdf, cheerio).

### RAG Strategies

Pluggable registry: Embed, BM25, Hybrid, Page Index. GraphRAG / HyDE / Self-RAG deferred.

### Provider Registry

Whitelist + dynamic `import()`, no switch-case. 90% of providers go through `openai-compatible`.

### Other

- React 18.2.0 locked
- Rivu dropped (message-embedded JSON components instead of server state machine)
- Built-in Eval Benchmark Harness (Golden Dataset + LLM-as-Judge)

## v2 Workflow

1. Run `llman sdd list` for active change status
2. See `_E2E.md` for E2E test patterns and known issues
3. Implement in `apps/server/` / `apps/web` / `packages/shared/`
4. See package docs: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## just qa Tolerance Levels

`just qa`（typecheck + lint + format-check + test）必须全员通过才算一次成功的 PR。不同范围的代码有不同的严格度：

### Tier 0 — 零容忍，必须修复

**业务代码**（`apps/server/src/`、`apps/web/src/features/`、`packages/shared/src/`）中出现以下情况必须直面修复，不得通过 disable 注释、override 或 exclude 绕过：

- **lint error** — 立即修复
- **lint warning** — 具体分析，优先重构代码消除 warning；仅在极少数工具误报（如 oxlint 的 `no-unexpected-multiline` vs Eden Treaty 链式调用）时允许 inline disable
- **tests failure** — 必须修复；可能是代码回归或测试本身过时，需同步更新

### Tier 1 — 可忽略（谨慎使用）

以下范围允许 `just qa` 中部分检查不通过，但应保持接近零警告：

- **测试代码**（`**/*.test.ts`、`**/*.spec.ts`、`**/test-utils/`）— lint warn/error 可接受，tests 本身仍须通过
- **临时脚本**（`scripts/`、`apps/web/scripts/`、`packages/*/scripts/`）— lint 问题可忽略
- **配置文件 / 构建产物** — 不参与 lint 检查
- **测试 mock / stub** — 存在重复类、宽松类型可接受

### 例外处理原则

1. **先尝试重构消除 warning**（提取变量、简化条件、拆分函数）
2. **若重构成本过高或引入更大风险**，在 PR 描述中说明原因后允许 inline disable
3. **绝不允许**新增全局 rule override 来忽略 warning
4. 已存在的 override（如 `.oxlintrc.json` 中 workspace 的 `eqeqeq: off`）需在新代码中保持一致性

## Agent-Specific Instructions

- SDD workflow: `/llman-sdd-*` skills; conventions in `llmanspec/config.yaml`
- Design decisions: `llmanspec/changes/`
- Package-level rules: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`
