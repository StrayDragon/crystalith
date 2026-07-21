<!-- LLMANSPEC:START -->

# LLMAN 规范驱动开发

本项目使用 llman SDD。阅读 `llmanspec/config.yaml` 了解 SDD 命令行为配置，以及 `llmanspec/AGENTS.md` 获取项目附加规则。

## SDD 流水线

使用 `/llman-sdd-explore` 开始，然后按照 pipeline：`/llman-sdd-propose` → `/llman-sdd-apply` → `/llman-sdd-verify` → `/llman-sdd-archive`。

保留此托管块，便于 `llman sdd init --update` 刷新。
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
│           ├── api/                # eden RPC（一等 client）
│           └── shared/             # Shared UI utilities, Layer system
├── packages/
│   ├── shared/            # Zod schemas + types SSOT
│   │   └── src/schemas/   # notebook, session, message, source, qa, output,
│   │                      # studio, model, etc. (research schemas stubbed / pending rewrite; refine HTTP removed c73)
│   └── crystalith-slidev/ # Slidev integration
├── config/                # Runtime config (app.yaml + secret.env)
├── llmanspec/             # Spec-driven development specs + changes
├── data/                  # Runtime DB + uploads (gitignored)
└── scripts/               # Maintenance scripts
```

## Current State

- ✅ All c00–c62 completed (63 changes); v1 parity confirmed through E2E
- ⏸️ **Deep Research** backend stubbed (501 Not Implemented), pending rewrite
- ✅ Frontend: all output renderers aligned with v1 interactive components
- ✅ c14: `backend/py/` + `api/generated/` deleted；wire 类型走 Eden + `@crystalith/shared`（`shared-types.ts` 已移除）
- ⏸️ **c13** distribution (Tauri / single-binary) — blocked on human auth
- 📦 阶段性收敛台账已归档：`_archive/2026-07-19-ssot-qa-progress.md`；作业法见 `.agents/skills/crystalith-ssot-qa-batches/`

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
- `just test` — server (`apps/server/tests/`) + shared unit/integration tests
- `just test-web` — frontend Vitest CI (`apps/web` `test:ci`)
- `bun typecheck` — typecheck everything
- `just e2e` / `bun run e2e` — Playwright critical browser gate (`@p0`, testid-based)
- `just e2e-install` — install Playwright Chromium (optional; local defaults to system Chrome)
- `just qa` — **primary PR gate**: typecheck + lint + format + schema drift + **server/shared unit** + **web Vitest** + **e2e @p0**
  - **Not in `just qa`**: `just test-bdd` · `just type-aware-lint`
- Env setup: prefer `cp .env.example .env` and `cp config/secret.env.example config/secret.env` (`CL_*` SSOT via `just gen-env-examples`). `just upsert-env-configs` is **legacy**.

Fast path:

- `cd apps/server && bun dev` — Elysia server (port 8032)
- `cd apps/web && bun dev` — Vite (port 3000)
- `just dev-connect server` — attach to Overmind process
- `just dev-quit` — stop Overmind session

## Coding Style

- **TypeScript/React**: 2-space indentation; `PascalCase` components; `useX` hooks; `camelCase` elsewhere
- **Layer System**: Use `apps/web/src/shared/layer/` — never hardcode z-index
- Formatter: `oxfmt`; linter: `oxlint`

### Component / module split（不要为拆而拆）

拆分目标是**降低耦合与认知负担**，不是「文件越小越好」。单处使用、也不形成清晰领域边界的 UI 碎片，优先留在父组件。

| 值得拆                                                | 不必拆                                   |
| ----------------------------------------------------- | ---------------------------------------- |
| 多处复用，或明确即将复用                              | 只用一次的一小段 JSX（尤其约 80 行以下） |
| 纯函数 / utils（易单测）                              | 仅 props 转发、无独立语义的壳组件        |
| 有独立状态边界的 hook（selection / wizard）           | 为 LOC 数字而切碎的展示块                |
| 大块内聚模块（postprocess、SSE helpers、wizard step） | 强依赖父级十几个回调、拆开更难跟读       |

**默认**：能复用或边界清晰再拆；否则内联。神文件可拆 **hook + 少数大步组件**，避免拆成一堆不可复用碎片。

## Architecture Decisions

### Zod SSOT + Eden + OpenAPI（职责分离）

**Eden 与 Zod 不等价，不要二选一。**

```text
packages/shared Zod（路由挂载）
    → Elysia 运行时校验 + 推断 App 类型
    → Eden treaty<App>（web 一等 client，编译期类型，不做 resp 再校验）
    → /openapi.json（衍生面：人类文档 + 未来其他语言 client）
```

| 层                             | 做什么                                                                                  | 不做什么                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/shared/src/schemas/` | HTTP / 跨端合约 SSOT；AI `generateObject` 与 API 同形时也放这里                         | 纯 UI 状态；与 shared **同域异形** 的第二份 schema          |
| `apps/server` 路由             | `body`/`query`/`params`/`response` 挂载 shared Zod → **运行时校验** + 喂给 `App`        | 平行 `z.object` 复制合约；Elysia `t.*`；`@elysiajs/swagger` |
| `apps/server` 配置 yaml/env    | **必留** Root/config Zod（`shared/config.ts` + `app.schema.gen.json` 门禁）             | 把 HTTP 合约塞进 config                                     |
| `apps/server` 内部 AI/tool     | 与对外合约一致 → shared；否则局部 schema，**禁止同名异形**                              | shared 一份、agent 又一份字段不同                           |
| `apps/web`                     | **Eden 推断类型**；标称类型从 `@crystalith/shared`；UI-only 放 `workspace/shared/types` | 平行 wire DTO 文件（已删 `shared-types.ts`）                |
| OpenAPI                        | 由同一份 Zod **实时**导出（Scalar `/openapi`）                                          | hey-api / `api/generated` 作为一等 TS client                |

```
packages/shared/src/schemas/   ← Zod 合约 SSOT
    ├──→ server routes (body: z.*)     ← 运行时校验
    ├──→ typeof App → eden treaty      ← web 一等 client
    └──→ /openapi.json → Scalar        ← 衍生 client / 文档
```

Elysia 1.4+ 原生消费 Zod v4。**禁止**用「只有 TS interface、无路由 schema」冒充合约（无校验、OpenAPI/Eden 质量下降）。

### Schema Descriptions & i18n

- **All** Zod schema `.describe()` / `.openapi({ description })` calls MUST use the
  `desc()` helper from `packages/shared/src/schemas/i18n.ts`.
- **Language**: Chinese (zh-CN) is the authoritative description language.
- **i18n readiness**: The `desc(zh, _key?)` signature reserves an optional
  translation key for future migration. When i18n is enabled, changing the
  backend (typesafe-i18n / i18next / Lingui) requires only modifying `i18n.ts`.
- **Zod → JSON Schema**: `.describe(desc(...))` populates `config/app.schema.gen.json`.
- **Zod → OpenAPI**: `.openapi({ description: desc(...) })` populates Scalar UI.
  Shared schemas load `packages/shared/src/schemas/zod-extend.ts` first so
  `.openapi()` is available at definition time (server `openapi.ts` also extends).
  Route-level examples remain via `registerApiDoc`.
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
- Built-in Eval Benchmark Harness removed in c73 (no UI/CI/CLI consumer)

## v2 Workflow

1. Run `llman sdd list` for active change status
2. Implement in `apps/server/` / `apps/web` / `packages/shared/`
3. See package docs: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`

## Commit Guidelines

- Prefixes: `feat:`, `fix:`, `refactor:`, `doc:`, `dev:`, `misc:`
- Optional scope: `feat(server):`, `fix(frontend):`
- Keep subjects short, imperative, focused on one change

## just qa Tolerance Levels

`just qa`（typecheck + lint + format-check + env/schema drift + **server/shared** tests + **web Vitest** + **e2e @p0**）必须全员通过才算一次成功的 PR。

**门禁组成（与 `justfile` 一致）**：
`check` → `check-env-examples` → `check-app-schema` → `test`（`apps/server/tests/` + `packages/shared/test/`）→ `test-web`（`apps/web` `test:ci`）→ `e2e`。

**门外（相关 PR 请另跑）**：

- `just test-bdd` — server BDD（CRUD 子集；见 `apps/server/tests/bdd/`）
- `just type-aware-lint` — **advisory** type-aware oxlint（未入 qa；测试文件仍有历史债）

不同范围的代码有不同的严格度：

### Tier 0 — 零容忍，必须修复

**业务代码**（`apps/server/src/`、`apps/web/src/features/`、`packages/shared/src/`）中出现以下情况必须直面修复，不得通过 disable 注释、override 或 exclude 绕过：

- **lint error** — 立即修复（指 `just qa` 内的非 type-aware `oxlint`）
- **lint warning** — 具体分析，优先重构代码消除 warning；仅在极少数工具误报（如 oxlint 的 `no-unexpected-multiline` vs Eden Treaty 链式调用）时允许 inline disable
- **tests failure** — 必须修复 **门禁内** 的失败（server/shared unit + web Vitest + e2e @p0）；BDD 不在 `just qa` 内但仍应在相关 PR 自行跑绿

### Tier 1 — 可忽略（谨慎使用）

以下范围允许 `just qa` 中部分检查不通过，但应保持接近零警告：

- **测试代码**（`**/*.test.ts`、`**/*.spec.ts`、`**/test-utils/`）— lint warn/error 可接受，tests 本身仍须通过
- **临时脚本**（`scripts/`、`apps/web/scripts/`、`packages/*/scripts/`）— lint 问题可忽略
- **配置文件 / 构建产物** — 不参与 lint 检查
- **测试 mock / stub** — 存在重复类、宽松类型可接受
- **`just type-aware-lint`** — 允许失败直至债清；不阻塞 `just qa`

### 例外处理原则

1. **先尝试重构消除 warning**（提取变量、简化条件、拆分函数）
2. **若重构成本过高或引入更大风险**，在 PR 描述中说明原因后允许 inline disable
3. **绝不允许**新增全局 rule override 来忽略 warning
4. 已存在的 override（如 `.oxlintrc.json` 中 workspace 的 `eqeqeq: off`）需在新代码中保持一致性

## Agent-Specific Instructions

- SDD workflow: `/llman-sdd-*` skills; conventions in `llmanspec/config.yaml`
- Design decisions: `llmanspec/changes/`
- Package-level rules: `apps/server/AGENTS.md`, `apps/web/AGENTS.md`, `config/AGENTS.md`
