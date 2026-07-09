# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

---

## 状态看板

| #   | Change                 | 状态                             |
| :-- | :--------------------- | :------------------------------- |
| c00 | server-foundation      | ✅ DONE                          |
| c01 | data-layer             | ✅ DONE                          |
| c02 | ai-runtime             | ✅ DONE                          |
| c03 | frontend-eden          | ✅ DONE                          |
| c04 | core-crud              | ✅ DONE                          |
| c05 | rag-embed              | ✅ DONE                          |
| c06 | rag-registry           | ✅ DONE                          |
| c07 | qa-pipeline            | ✅ DONE                          |
| c08 | research-agent         | ✅ DONE                          |
| c09 | outputs-generation     | ✅ DONE                          |
| c10 | models-management      | ✅ DONE                          |
| c11 | eval-harness           | ✅ DONE                          |
| c12 | analysis-studio-refine | ✅ DONE                          |
| c15 | bdd-tests              | ✅ DONE                          |
| c16 | rag-foundations        | ✅ DONE                          |
| c17 | qa-citations           | ⬜ TODO                          |
| c18 | source-dedup-safety    | ⬜ TODO                          |
| c19 | task-queue             | ⬜ TODO (semaphore+queue 未落盘) |
| c20 | outputs-refine         | ⬜ TODO                          |
| c21 | web-extractors         | ⬜ TODO                          |
| c22 | research-agent         | ⬜ TODO                          |
| c23 | studio-analysis        | ⬜ TODO                          |
| c13 | distribution           | ⏸️ BLOCKED (blocked by c17-c23)  |
| c14 | cleanup-delivery       | ⏸️ BLOCKED (blocked by c17-c23)  |

<!-- LEGEND: ✅ DONE | 🔄 WIP | ⬜ TODO | ⏸️ BLOCKED -->

---

## 当前批次

<!-- CURRENT -->

**Phase 5**: c17-c23 v1→v2 行为对齐迁移线

**前置**: c16 ✅ (rag-foundations 已提交)

**目标**: 8 个 spec/proposal 对 c16 依赖的 v2 补齐。c17-c23 并行可做（c16 是唯一共同前置）。

**阻塞**: c13, c14 需 c17-c23 全部完毕后方可开始

---

## 交接记录

<!-- HANDOFF -->

| 字段       | 值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 上次 Agent | zcode-agent (接管修复)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 上次操作   | **接手分析 + 修复提交**: (1) 分析 3 个 JSONL session 完整脉络 — c16 已完成并提交，c19 semaphore+queue 创建但未落盘，本次 unstaged QA 增强未提交。(2) P0 修复: `handler.ts:101` — `ne(sources.status, 'deleted')` 类型错误（enum 只有 processing\|ready\|failed，无 deleted），移除条件并清理未使用 `and`/`ne` 导入。(3) 质量门禁: server typecheck ✅ 0 err, `bun lint` ✅ 0 err/206 warn, `bun test` ✅ 58 pass/0 fail。(4) 提交: `d97d452a feat(qa): add confidence scores, strategy passthrough, and hydrated citations` — 5 files, +162/-40。(5) PROGRESS.v2.md 更新: 反映 c15/c16 实际完成状态 + c17-c23 迁移线作为当前批次。 |
| 开放决策   | (1) **Auth**: v2 缺失 auth 层，方向 = 本地免鉴权 + 回环绑定（c13 阶段）。(2) **React 版本**: 暂锁 react@18.2.0 对齐 @material-tailwind 子树，待迁移 MUI 后升回 19。(3) AI SDK v7 `tool()` 用 `inputSchema`。(4) c17-c23 流水线: QA confidence/strategy 增强已合入，后续并行推进 7 个 migration changes。                                                                                                                                                                                                                                                                                                                           |
| 已知问题   | **🟡 P1 - 既存债务**: web typecheck ~180 错误（`.ts` 后缀导入），server 侧 0 错误。**🟡 P1**: v2 无 auth。**🟢 暂缓**: @material-tailwind→MUI 迁移 + React 升回 19。**🟡 P2**: c19 task-queue `semaphore.ts`/`queue.ts` 需要从零实现（上次 Agent 写入未落盘）。                                                                                                                                                                                                                                                                                                                                                                    |
| 质量门禁   | `bun lint --quiet` → 0 errors / 206 warnings。`bun typecheck` (server) ✅。**server `bun test` 58 pass / 0 fail** ✅（9 files: 2 db + 4 tokenizer + 5 config + 21 BDD + 26 rag）。web typecheck ~180 既存错误（非本次引入）。                                                                                                                                                                                                                                                                                                                                                                                                      |

---

---

## 项目 Layout (v2 final)

```
crystalith/
├── apps/
│   ├── server/               # Bun + Elysia (Phase 0 scaffold done)
│   │   ├── src/
│   │   │   ├── server.ts           # Entry: Elysia HTTP server
│   │   │   ├── features/           # Business domains (notebooks, qa, sources, ...)
│   │   │   ├── shared/             # Cross-cutting (db, ai, config, vector, utils)
│   │   │   └── db/                 # Drizzle schema + migrations
│   │   ├── drizzle/                # Migration SQL (committed)
│   │   └── test/                   # Bun test
│   └── web/                 # Vite + React + TypeScript SPA
│       └── src/
│           ├── features/workspace/ # Main workspace UI
│           ├── api/                # API client layer (eden RPC)
│           └── shared/             # Shared UI utilities, Layer system
├── packages/
│   ├── shared/              # Zod schemas + types SSOT
│   └── crystalith-slidev/   # Slidev integration package
├── backend/py/              # 🔒 v1 Python reference SSOT — do NOT modify
├── config/                  # Runtime config (app.yaml + secret.env)
├── data/                    # Runtime DB + uploads (gitignored)
├── llmanspec/               # Spec-driven development specs + changes
└── scripts/                 # Maintenance scripts
```

---

## 架构决策

### 1. Zod SSOT

所有类型定义唯一来源：`packages/shared/src/schemas/`。
Elysia 1.4+ 通过 StandardSchemaV1 协议原生消费 Zod v4。
**禁用** `@elysiajs/swagger`（TypeBox 生态），**禁用** Elysia 内置 `t.*`。
OpenAPI 由 `@asteasolutions/zod-to-openapi` 生成 → `GET /openapi.json`。

```
packages/shared/src/schemas/   ← 唯一源
    ├──→ server routes (body: z.*)
    ├──→ eden treaty (treaty<App>)
    └──→ /openapi.json → 外部 SDK
```

### 2. 配置驱动 Provider Registry

白名单映射 + 动态 `import()`，禁止 switch-case 硬编码。

```ts
const KNOWN: Record<string, { sdk: string; factory: string }> = {
  openai: { sdk: '@ai-sdk/openai', factory: 'createOpenAI' },
  anthropic: { sdk: '@ai-sdk/anthropic', factory: 'createAnthropic' },
  deepseek: { sdk: '@ai-sdk/openai', factory: 'createOpenAI' },
  google: { sdk: '@ai-sdk/google', factory: 'createGoogleGenerativeAI' },
  'openai-compatible': { sdk: '@ai-sdk/openai-compatible', factory: 'createOpenAICompatible' },
};
// resolveModel(config) → dynamic import → LanguageModelV1
```

90% provider 走 `openai-compatible`。`config/app.yaml` 写 `provider: "openai"` 即可。

### 3. 禁用 Graph Library

pydantic-graph → async function chain + async generator。
不引入 LangChain、LangGraph 等。

### 4. 单二进制目标

`bun build --compile` → ~75MB。所有依赖可 bundle（sqlite-vec native addon、unpdf、cheerio）。

---

## 依赖图

```
c00 ✅
 ├── c01 (data-layer) ──────┬── c04 (core-crud) ──┬── c06 (rag-registry) ──┬── c11 (eval)
 ├── c02 (ai-runtime) ──────┤                     │                        │
 └── c03 (frontend-eden)     ├── c05 (rag-embed) ──┤                        │
                             │                     ├── c07 (qa-pipeline)    │
                             │                     ├── c08 (research)       │
                             │                     ├── c09 (outputs)        │
                             │                     ├── c10 (models)         │
                             │                     └── c12 (analysis/studio/refine)
                             │
                             └── c13 (distribution) ── c14 (cleanup)
```

---

## Shared Package 结构

```
packages/shared/src/
├── index.ts
├── schemas/
│   ├── common.ts              # ErrorEnvelope, Pagination, Citation
│   ├── notebook.ts, session.ts, message.ts, source.ts
│   ├── qa.ts, output.ts       # FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING
│   ├── research.ts, analysis.ts, studio.ts, refine.ts
│   ├── model.ts               # ModelConfig, ProviderConfig
│   ├── template.ts, task.ts
│   └── streaming/{qa-stream,research-progress}.ts
└── types/index.ts             # z.infer<>
```

## Server 结构 (v2 current)

```
apps/server/src/
├── server.ts                  # Elysia + export type App
├── openapi.ts, asyncapi.ts    # /openapi.json + /asyncapi.json
├── ai/                        # provider-registry, generate, stream, middleware
├── db/                        # schema (20 表), vectors, migrate, migrate-from-v1
├── rag/                       # chunker, embedder, search, cache, fusion, registry
│   └── strategies/{embed,keyword,hybrid,page-index}.ts
├── features/                  # notebooks, sessions, messages, sources,
│                              # qa, citations, research, outputs,
│                              # models, tasks, templates, eval
└── shared/                    # epoch, context, concurrency, observability
```

## 关键依赖

| Package                                                                                                   | 关联 Change | License          |
| :-------------------------------------------------------------------------------------------------------- | :---------- | :--------------- |
| `elysia` `@elysiajs/eden` `@elysiajs/static`                                                              | c00 c03 c13 | MIT              |
| `zod@^4`                                                                                                  | c01         | MIT              |
| `@asteasolutions/zod-to-openapi`                                                                          | c01         | MIT              |
| `drizzle-orm` `drizzle-kit`                                                                               | c01         | Apache-2.0       |
| `sqlite-vec`                                                                                              | c01 c05     | MIT              |
| `ai` `@ai-sdk/openai` `@ai-sdk/anthropic` `@ai-sdk/google` `@ai-sdk/deepseek` `@ai-sdk/openai-compatible` | c02         | Apache-2.0       |
| `gpt-tokenizer`                                                                                           | c02         | MIT              |
| `unpdf`                                                                                                   | c04         | MIT              |
| `cheerio` `@mozilla/readability`                                                                          | c04         | MIT / Apache-2.0 |
| `oxlint` `oxfmt`                                                                                          | c00         | MIT              |

## v1 参考速查

| v1 文件                          | 行数 | → v2 Change |
| :------------------------------- | :--- | :---------- |
| `shared/db/models.py`            | ~350 | c01         |
| `shared/types.py`                | ~120 | c01         |
| `shared/ai/factory.py`           | ~280 | c02         |
| `shared/retrieval/context.py`    | 990  | c05         |
| `shared/agents/output_graph.py`  | 832  | c09         |
| `shared/agents/search_graph.py`  | 149  | c08         |
| `features/research/graph.py`     | 567  | c08         |
| `features/qa/api.py`             | 370  | c07         |
| `features/sources/api_ingest.py` | ~400 | c04         |

---

## 禁止规则

- ❌ 在 `packages/shared` 之外重新定义类型
- ❌ 安装 `@elysiajs/swagger`
- ❌ 安装 LangChain 或任何 graph library
- ❌ 修改 `backend/py/`
- ❌ switch-case 硬编码 provider
- ❌ 未读完所有 design.md 就开始实现

---

## Agent 执行流程

引用此文件后：按以下步骤自动执行。

1. 读取 Status Board，定位 `<!-- CURRENT -->` 批次
2. 读取当前批次所有 change 的 `design.md` + `proposal.md` + `tasks.md`
3. 读取 v1 Reference Map 中对应 Python 文件
4. **批量实现**整个批次（非逐个 change）
5. `bun test` + `bun typecheck` 验证
6. 更新 Status Board（`✅`/`🔄`/`⬜`）
7. 更新 Handoff Notes（Agent、操作摘要、决策、已知问题）
8. 移动 `<!-- CURRENT -->` 到下一批次
