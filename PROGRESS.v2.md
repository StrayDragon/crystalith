# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

---

## 状态看板

| # | Change | 状态 |
|:--|:---|:---|
| c00 | server-foundation | ✅ DONE |
| c01 | data-layer | ✅ DONE |
| c02 | ai-runtime | ✅ DONE |
| c03 | frontend-eden | ✅ DONE |
| c04 | core-crud | ⬜ TODO |
| c05 | rag-embed | ⬜ TODO |
| c06 | rag-registry | ⬜ TODO |
| c07 | qa-pipeline | ⬜ TODO |
| c08 | research-agent | ⬜ TODO |
| c09 | outputs-generation | ⬜ TODO |
| c10 | models-management | ⬜ TODO |
| c11 | eval-harness | ⬜ TODO |
| c12 | analysis-studio-refine | ⬜ TODO |
| c13 | distribution | ⬜ TODO |
| c14 | cleanup-delivery | ⬜ TODO |

<!-- LEGEND: ✅ DONE | 🔄 WIP | ⬜ TODO | ⏸️ BLOCKED -->

---

## 当前批次

<!-- CURRENT -->
**Phase 2**: c04 + c05 + c06

**前置**: c01 ✅ c02 ✅ c03 ✅

**目标**: core-crud (notebooks/sessions/messages/sources/outputs) + rag-embed (chunker/embedder/embed-strategy) + rag-registry (pluggable strategy registry)

---

## 交接记录

<!-- HANDOFF -->
| 字段 | 值 |
|:---|:---|
| 上次 Agent | pi (Phase 1 batch) |
| 上次操作 | 实现 c01 + c02 + c03: shared Zod schemas (15 files) + Drizzle 20表 + sqlite-vec vectors + AI runtime (providers/tools/stream/middleware/generate-output/tokenizer/config) + OpenAPI 3.1 + AsyncAPI 3.0 + eden treaty client |
| 开放决策 | zod-to-openapi v8 的 extendZodWithOpenApi 必须在 schema 创建前调用 (zod v4 原型时机问题) — 当前用 inline schema 规避，后续如需 named components 需在 shared 包 bootstrap 中调用 |
| 已知问题 | (1) v1→v2 数据迁移脚本 deferred to c14; (2) 前端 generated client 迁移 deferred to core-crud batch; (3) AI runtime live API 调用验证 deferred (需真实 API key) |

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
  openai:    { sdk: '@ai-sdk/openai',             factory: 'createOpenAI' },
  anthropic: { sdk: '@ai-sdk/anthropic',          factory: 'createAnthropic' },
  deepseek:  { sdk: '@ai-sdk/openai',             factory: 'createOpenAI' },
  google:    { sdk: '@ai-sdk/google',             factory: 'createGoogleGenerativeAI' },
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

## Server 结构

```
server/src/
├── server.ts                  # Elysia + export type App
├── openapi.ts, asyncapi.ts    # /openapi.json + /asyncapi.json
├── ai/                        # provider-registry, generate, stream, middleware
├── db/                        # schema (17 表), vectors, migrate, migrate-from-v1
├── rag/                       # chunker, embedder, search, cache, fusion, registry
│   └── strategies/{embed,keyword,hybrid,page-index}.ts
├── features/                  # notebooks, sessions, messages, sources,
│                              # qa, outputs, research, analysis, studio, refine,
│                              # models, tasks, citations, templates, eval
└── shared/                    # epoch, context, concurrency, observability
```

## 关键依赖

| Package | 关联 Change | License |
|:---|:---|:---|
| `elysia` `@elysiajs/eden` `@elysiajs/static` | c00 c03 c13 | MIT |
| `zod@^4` | c01 | MIT |
| `@asteasolutions/zod-to-openapi` | c01 | MIT |
| `drizzle-orm` `drizzle-kit` | c01 | Apache-2.0 |
| `sqlite-vec` | c01 c05 | MIT |
| `ai` `@ai-sdk/openai` `@ai-sdk/anthropic` `@ai-sdk/google` `@ai-sdk/deepseek` `@ai-sdk/openai-compatible` | c02 | Apache-2.0 |
| `gpt-tokenizer` | c02 | MIT |
| `unpdf` | c04 | MIT |
| `cheerio` `@mozilla/readability` | c04 | MIT / Apache-2.0 |

## v1 参考速查

| v1 文件 | 行数 | → v2 Change |
|:---|:---|:---|
| `shared/db/models.py` | ~350 | c01 |
| `shared/types.py` | ~120 | c01 |
| `shared/ai/factory.py` | ~280 | c02 |
| `shared/retrieval/context.py` | 990 | c05 |
| `shared/agents/output_graph.py` | 832 | c09 |
| `shared/agents/search_graph.py` | 149 | c08 |
| `features/research/graph.py` | 567 | c08 |
| `features/qa/api.py` | 370 | c07 |
| `features/sources/api_ingest.py` | ~400 | c04 |

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
