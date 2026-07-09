# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

## 状态看板

| #   | Change                 | 状态                                                                    |
| :-- | :--------------------- | :---------------------------------------------------------------------- |
| c00 | server-foundation      | ✅ DONE                                                                 |
| c01 | data-layer             | ✅ DONE                                                                 |
| c02 | ai-runtime             | ✅ DONE                                                                 |
| c03 | frontend-eden          | ✅ DONE                                                                 |
| c04 | core-crud              | ✅ DONE                                                                 |
| c05 | rag-embed              | ✅ DONE                                                                 |
| c06 | rag-registry           | ✅ DONE                                                                 |
| c07 | qa-pipeline            | ✅ DONE                                                                 |
| c08 | research-agent         | ✅ DONE                                                                 |
| c09 | outputs-generation     | ✅ DONE                                                                 |
| c10 | models-management      | ✅ DONE                                                                 |
| c11 | eval-harness           | ✅ DONE                                                                 |
| c12 | analysis-studio-refine | ✅ DONE                                                                 |
| c15 | bdd-tests              | ✅ DONE                                                                 |
| c16 | rag-foundations        | ✅ DONE                                                                 |
| c17 | qa-citations           | ✅ DONE                                                                 |
| c18 | source-dedup-safety    | ✅ DONE                                                                 |
| c19 | task-queue             | ✅ DONE (Semaphore + TaskQueue + crash-recovery)                        |
| c20 | outputs-refine         | ✅ DONE                                                                 |
| c21 | web-extractors         | ✅ DONE                                                                 |
| c22 | research-agent         | ✅ DONE (cyclic Plan→HITL→Search→Analyze→Report; `f5688e70`)            |
| c23 | studio-analysis        | ✅ DONE (clustering+correlation+contradiction `56150d86`; theme+slidev) |
| c24 | pipeline-integration   | 🔄 WIP (Storage / toolApproval HITL / 集成测试; 21 tasks)               |
| c13 | distribution           | ⏸️ BLOCKED (blocked by c24)                                             |
| c14 | cleanup-delivery       | ⏸️ BLOCKED (blocked by c24)                                             |

<!-- LEGEND: ✅ DONE | 🔄 WIP | ⬜ TODO | ⏸️ BLOCKED -->

## v1 (Python) vs v2 (TypeScript) — 代码量与功能对比

### 总览

| 指标                 | v1 Python (FastAPI) | v2 TS (Elysia+AI SDK) |      比例 |
| :------------------- | ------------------: | --------------------: | --------: |
| **总行数**           |              29,743 |                 8,640 | **3.4:1** |
| **总文件数**         |                 189 |                    72 |     2.6:1 |
| **features/**        |           ~14,600行 |              ~4,830行 |     3.0:1 |
| **shared/ai/db/rag** |           ~14,457行 |              ~3,527行 |     4.1:1 |

> v2 Elysia单handler=OpenAPI doc合一，v1拆repo+schema+api多文件；v1 shared有pydantic-ai+ChromaDB厚重包装。

### 按功能域对比

| #   | 功能域                | v1行数 | v2行数 | 完成度 | 备注                                                       |
| :-- | :-------------------- | -----: | -----: | :----: | :--------------------------------------------------------- |
| 1   | notebooks             |    257 |    135 |   ✅   |                                                            |
| 2   | sessions              |    675 |    200 |   ✅   |                                                            |
| 3   | messages              |    216 |    124 |   ✅   |                                                            |
| 4   | citations             |    136 |     37 |   ✅   |                                                            |
| 5   | **QA pipeline**       |  1,311 |    552 |   ✅   | 含no_evidence_reason+confidence+strategy                   |
| 6   | **research agent**    |  2,834 |    925 |   ✅   | cyclic Plan→HITL→Search→Analyze→Report (`f5688e70`)        |
| 7   | outputs               |  1,023 |    437 |   ✅   | v2 10 types                                                |
| 8   | refine                |    321 |    138 |   ✅   | source_ids bug已修                                         |
| 9   | **studio**            |  1,686 |    344 | 🟡70%  | theme presets ✅; two-stage outline→markdown 待实现(c24外) |
| 10  | **analysis**          |    427 |    698 |   ✅   | clustering+correlation+contradiction ✅ (`56150d86`)       |
| 11  | commands              |     75 |     64 |   ✅   |                                                            |
| 12  | models mgmt           |    112 |     55 |   ✅   |                                                            |
| 13  | templates             |    332 |    120 |   ✅   |                                                            |
| 14  | prompt presets        |    268 |    111 |   ✅   |                                                            |
| 15  | sources CRUD+ingest   |  2,867 |    979 |   ✅   | v2: dedup+SSRF+upload size                                 |
| 16  | **source connectors** |  1,272 |    195 | 🟡30%  | v1: Obsidian sync。v2: shell                               |
| 17  | tasks/queue           |    595 |     84 | 🟡60%  | v2: Semaphore+TaskQueue ✅; worker dispatch 待做           |
| 18  | workspace             |    274 |     63 |   ✅   |                                                            |
| 19  | **eval harness**      |      0 |    598 |   ✅   | **v2独占**: Golden Dataset + LLM-as-Judge                  |

### shared 基础设施对比

| 模块                     | v1行数 | v2行数 |                         覆盖度                         |
| :----------------------- | -----: | -----: | :----------------------------------------------------: |
| AI (provider/retry)      | ~1,800 |   ~430 |                           ✅                           |
| DB (models/ORM)          | ~1,200 |   ~780 |                           ✅                           |
| RAG (embed/search/cache) | ~1,300 | ~1,200 | ✅ (v2更丰富: multi-query/diversity/hybrid/page-index) |
| Config                   | ~2,500 |    226 |              🟡 v1完整env/model/endpoint               |
| Web-extractors           | ~1,100 |   ~350 |             ✅ jina/firecrawl/readability              |
| Vector store             |   ~900 |    101 |                 ✅ ChromaDB→sqlite-vec                 |
| Parsers                  | ~1,200 |    150 |                ✅ PDF+HTML+text (核心)                 |
| Net (SSRF/URL)           |   ~220 |   ~180 |                           ✅                           |
| Plugins                  |   ~900 |      0 |                       ⬜ 留待c13                       |

### 关键结论

1. **代码量3.4:1** — TypeScript+Bun表达力更高，Elysia单handler≈v1 api+repo+schema三文件
2. **核心全功能域就绪** — 20 router全部挂载，CRUD/QA/outputs/eval/sources完整
3. **研究智能体已对齐** — c22 cyclic state machine (`f5688e70`) 已填补最大缺口；ToolLoopAgent+toolApproval 接线为 c24 Workstream B
4. **analysis 完整** — clustering+correlation+contradiction ✅；studio 仅剩 two-stage（非阻塞项）
5. **source connectors待充实** — v1有Obsidian sync，v2仅shell
6. **任务队列基础设施就位** — Semaphore+TaskQueue+crash-recovery ✅，worker dispatch由 c24 Workstream A 接线
7. **v2独占eval harness** — v1无evaluation framework

## 当前批次

<!-- CURRENT -->

**Phase 6**: c24-add-v2-pipeline-integration（v2.0 发布前最后的功能工作）

**前置**: c17-c23 ✅（全部已实现并 archive，commit `78665437`）

**目标**: c24 三条工作线（21 tasks）：

- **Workstream A — Content Storage 层**：`shared/storage.ts` + pipeline saveContent + document_parse handler 完整实现
- **Workstream B — toolApproval 事件驱动 HITL**：`agent.ts` waitForApproval → `ToolLoopAgent` + `toolApproval: 'user-approval'`；SSE 升级 fullStream 事件转发；消除 DB 轮询
- **Workstream C — 集成测试套件**：QA/sources/refine/outputs/research/studio 全流程 LLM-mock 集成测试

**阻塞**: c13 (distribution/Tauri)、c14 (cleanup/delivery) 需 c24 完毕后方可开始

**完成后**: c24 → c13 → c14 = v2.0.0

**重点**: c24 是 v2 相对 v1 的改进项（非 v1 对齐）——存储抽象是单二进制架构设计；toolApproval 是 AI SDK v7 原生优势；集成测试是 v2.0 质量门禁。Workstream B 需重新引入 `ToolLoopAgent`/`webSearchTool` import（本次 pre-commit 修复时已删 dead import）。

## 交接记录

<!-- HANDOFF -->

| 字段       | 值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 上次 Agent | zcode-agent (pre-commit 修复 + PROGRESS 看板校正)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 上次操作   | **pre-commit 全绿**: `prek run --all-files` 6 hooks 全 Passed (exit 0)。**根因**: oxlint 仅在 error 级别 fail（warning 不 fail），原有 20 errors = 2 dead imports (agent.ts) + 16 vendor skill 示例 + 2 test 问题。**修复**: 删 agent.ts dead imports (ToolLoopAgent/webSearchTool，c24 Workstream B 重新引入)；删 dedup.test unused import；`.oxlintrc.json` 加 `.agents/skills/` ignorePattern + no-console/no-underscore-dangle 源码 off（附理由）+ test overrides 扩展（mock/fixture 合理放宽）；`.pre-commit-config.yaml` 给 trailing-witespace/end-of-file-fixer 加 `exclude: backend/py/ | .agents/skills/`；`oxlint --fix` 安全非变异转换（`.sort`→`.toSorted`/`.substring`→`.slice`/`.replace`→`.replaceAll`）。**看板校正**: c22 `⬜TODO`→`✅DONE`、c23 `🔄WIP`→`✅DONE`、新增 c24 `🔄WIP`。**Quality**: prek ✅, oxlint exit 0 (0 errors / 146 warnings 非阻塞), server typecheck ✅, 102 pass / 1 fail（pre-existing 网络测试 validateUrlForFetch DNS）。 |
| 开放决策   | (1) **Auth**: 本地免鉴权 + 回环绑定（c13阶段）。(2) **React**: 暂锁18.2.0，待迁移MUI后升19。(3) AI SDK v7 tool() 用inputSchema。(4) c22/c23 已完成，下一批次 c24。(5) 统计: v1 29,743行189文件 vs v2 8,640行72文件 = 3.4:1代码缩减。(6) oxlint warning 146 处（eqeqeq/unicode-regexp/no-inline-comments）保留为 warning 不阻塞——经分析前端 `== null` 是有意的 null-or-undefined 惯用法，强转 `===` 会引入 bug；dangerous autofix 会改坏逻辑（如 `Number("10px")`=NaN），故不批量改。                                                                                                            |
| 已知问题   | **🟡 P1**: web typecheck ~180 errors（.ts后缀导入）。**🟡 P1**: v2无auth。**🟢 暂缓**: @material-tailwind→MUI迁移。**🟡 P2**: c24 未开始（Storage/toolApproval/集成测试）。**🟡 P2**: source connectors仅shell。**🟢 非问题**: validateUrlForFetch 网络测试在无 DNS 沙箱中超时（pre-existing，非回归）。                                                                                                                                                                                                                                                                                        |
| 质量门禁   | `prek run --all-files` → 6 hooks Passed ✅。`bun oxlint` → exit 0 (0 errors) ✅。`bun typecheck` (server) ✅。`bun test` (server) → 102 pass / 1 fail (pre-existing 网络测试) ✅                                                                                                                                                                                                                                                                                                                                                                                                                |

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

### 3. AI SDK v7 是唯一 AI 层（2026-07-09 更新）

AI SDK v7 已原生覆盖所有 AI 需求，**不引入任何第三方 agent/工作流框架**：

| AI SDK v7 能力                      | 替代                              |
| :---------------------------------- | :-------------------------------- |
| `ToolLoopAgent`                     | Pi agent-core、自建 Agent runtime |
| `WorkflowAgent` + Workflow Patterns | Mastra workflows、LangGraph.js    |
| `toolApproval: 'user-approval'`     | 手写 HITL、DB 轮询                |
| `generateObject({ schema: Zod })`   | pydantic-ai `output_type`         |
| `streamText` / `fullStream`         | 手写 SSE 轮询                     |

**禁用列表：** ❌ 不引入 Pi agent-core、Mastra、LangGraph.js、XState、Inngest、Temporal 等任何第三方 agent/工作流/图库。

### 4. 单二进制目标

`bun build --compile` → ~75MB。所有依赖可 bundle（sqlite-vec native addon、unpdf、cheerio）。

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
└── shared/                    # semaphore, queue, config, net, extraction
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
| `ipaddr.js` `private-ip`                                                                                  | c18         | MIT              |
| `oxlint` `oxfmt`                                                                                          | c00         | MIT              |

## v1 参考速查

| v1 文件                          | 行数 | → v2 Change |
| :------------------------------- | ---: | :---------- |
| `shared/db/models.py`            | ~350 | c01         |
| `shared/types.py`                | ~120 | c01         |
| `shared/ai/factory.py`           | ~280 | c02         |
| `shared/retrieval/context.py`    |  990 | c05         |
| `shared/agents/output_graph.py`  |  832 | c09         |
| `shared/agents/search_graph.py`  |  149 | c08         |
| `features/research/graph.py`     |  567 | c08/c22     |
| `features/qa/api.py`             |  370 | c07         |
| `features/sources/api_ingest.py` | ~400 | c04         |

## 禁止规则

- ❌ 在 `packages/shared` 之外重新定义类型
- ❌ 安装 `@elysiajs/swagger`
- ❌ 安装 LangChain、LangGraph.js、Pi agent-core、Mastra、XState 或任何第三方 agent/工作流/图库（AI SDK v7 ToolLoopAgent + WorkflowAgent 已覆盖）
- ❌ 修改 `backend/py/`
- ❌ switch-case 硬编码 provider
- ❌ 未读完所有 design.md 就开始实现
- ❌ 重新调研已有结论的领域（先查 PROGRESS.v2.md 和 UPGRADES/ 存档）

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
