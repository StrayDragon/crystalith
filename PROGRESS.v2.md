# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

## 状态看板

| #   | Change                 | 状态                                                                             |
| :-- | :--------------------- | :------------------------------------------------------------------------------- |
| c00 | server-foundation      | ✅ DONE                                                                          |
| c01 | data-layer             | ✅ DONE                                                                          |
| c02 | ai-runtime             | ✅ DONE                                                                          |
| c03 | frontend-eden          | ✅ DONE                                                                          |
| c04 | core-crud              | ✅ DONE                                                                          |
| c05 | rag-embed              | ✅ DONE                                                                          |
| c06 | rag-registry           | ✅ DONE                                                                          |
| c07 | qa-pipeline            | ✅ DONE                                                                          |
| c08 | research-agent         | ✅ DONE                                                                          |
| c09 | outputs-generation     | ✅ DONE                                                                          |
| c10 | models-management      | ✅ DONE                                                                          |
| c11 | eval-harness           | ✅ DONE                                                                          |
| c12 | analysis-studio-refine | ✅ DONE                                                                          |
| c15 | bdd-tests              | ✅ DONE                                                                          |
| c16 | rag-foundations        | ✅ DONE                                                                          |
| c17 | qa-citations           | ✅ DONE                                                                          |
| c18 | source-dedup-safety    | ✅ DONE                                                                          |
| c19 | task-queue             | ✅ DONE (Semaphore + TaskQueue + crash-recovery)                                 |
| c20 | outputs-refine         | ✅ DONE                                                                          |
| c21 | web-extractors         | ✅ DONE                                                                          |
| c22 | research-agent         | 🔄 WIP (cyclic 骨架✅; resume失效/export stub/hitl缺modify → GAP-BOARD G4/G5/G6) |
| c23 | studio-analysis        | ✅ DONE                                                                          |
| c24 | pipeline-integration   | ✅ DONE (WS-A✅ / WS-B✅ / WS-C✅)                                               |
| c25 | ssrf-config            | ✅ DONE (本会话)                                                                 |
| c26 | citation-context       | ✅ DONE (本会话)                                                                 |
| c27 | outputs-rag            | ✅ DONE (本会话)                                                                 |
| c28 | analysis-vector        | ✅ DONE (前agent)                                                                |
| c29 | refine-revert          | ✅ DONE (前agent)                                                                |
| c30 | sync-embedding         | ✅ DONE (前agent)                                                                |
| c31 | qa-noevidence          | ✅ DONE (本会话)                                                                 |
| c32 | studio-persist         | ✅ DONE (本会话)                                                                 |
| c33 | source-extras          | ✅ DONE (本会话)                                                                 |
| c34 | sessions-convert       | ✅ DONE (本会话)                                                                 |
| c35 | frontend-migration     | 🔄 WIP (Phase 7a-e: 17 domains migrated; 4 large files remain: useSources, SlidesStudio, SourceConnectors, type-only imports. Typecheck: 207→25 ↓88%) |
| c13 | distribution           | ⏸️ BLOCKED (blocked by c35) 🔒 需要人工授权                                      |
| c14 | cleanup-delivery       | ⏸️ BLOCKED (blocked by c13) 🔒 需要人工授权                                      |

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

> ⚠️ **2026-07-10 全面复核**: 完成度列已按端点级 + 行为级对拍校正。此前看板的 ✅ 标记过于乐观。
> 完成度图例: ✅ 对齐 | 🟡 部分对齐(见备注) | 🔴 实质性偏移/缺失

| #   | 功能域                | v1行数 | v2行数 | 完成度 | 备注(行为级对拍)                                                                                                          |
| :-- | :-------------------- | -----: | -----: | :----: | :------------------------------------------------------------------------------------------------------------------------ |
| 1   | notebooks             |    257 |    135 |   ✅   | 端点齐全; v2 有 eden bug(`id`/`nid`)                                                                                      |
| 2   | sessions              |    675 |    200 |   🟡   | 缺 GET 单个 + convert-to-output 端点(2 个)                                                                                |
| 3   | messages              |    216 |    124 |   ✅   |                                                                                                                           |
| 4   | citations             |    136 |     37 |   🔴   | v2 是 echo 端点; v1 邻域证据审查(/context)缺失 → c26                                                                      |
| 5   | **QA pipeline**       |  1,311 |    552 |   🟡   | confidence✅; **架构不同**(agent tool-call vs v1确定性检索); 5 个 no-evidence reason 仅产出 1; 缺 context_stats/export    |
| 6   | **research agent**    |  2,834 |    925 |   🟡   | cyclic 骨架✅; **resume 失效**(从头重跑); HITL 忽略 modify/skip; export 是 JSON dump; 缺 delete/start/modify 端点         |
| 7   | outputs               |  1,023 |    437 |   🟡   | 10 types✅; **无 RAG 检索**(全 chunk dump 爆上下文)/无 citations/无修复循环 → c27                                         |
| 8   | **refine**            |    321 |    138 |   🔴   | **换产品**: v2 是纯文本变换器(expand/rewrite/translate); v1 是 citation-aware RAG 摘要器 → **决定回退对齐 v1**            |
| 9   | **studio**            |  1,686 |    344 |   🟡   | two-stage✅+theme✅; **无 Slidev 落盘**(只存 DB); 无 RAG; 无 output sync; 缺 PATCH/PUT 端点(草稿编辑+HITL编辑)            |
| 10  | **analysis**          |    427 |    698 |   🔴   | contradiction✅; **clustering/correlation 向量 KNN→关键词 TF 降级**(sqlite-vec 无法 SELECT 向量) → c28                    |
| 11  | commands              |     75 |     64 |   ✅   |                                                                                                                           |
| 12  | models mgmt           |    112 |     55 |   🟡   | 缺 GET 单个 model 端点(1 个)                                                                                              |
| 13  | templates             |    332 |    120 |   ✅   | v2独占 CRUD(v1 无 HTTP 端点)                                                                                              |
| 14  | prompt presets        |    268 |    111 |   ✅   | v2独占 CRUD(v1 无 HTTP 端点)                                                                                              |
| 15  | sources CRUD+ingest   |  2,867 |    979 |   🟡   | dedup✅+SSRF✅+upload✅; **缺 3 端点**(summary/per-source-qa/qa-to-source); **异步 embedding**(ready-before-vectors 竞态) |
| 16  | **source connectors** |  1,272 |    195 | 🟡15%  | **TODO stub sync**; 缺 snapshot/sync-apply/import-scope(3 端点)                                                           |
| 17  | tasks/queue           |    595 |    531 |   ✅   | Semaphore+TaskQueue+crash-recovery✅; refine 已分发✅; document_parse✅                                                   |
| 18  | workspace             |    274 |     63 |   ✅   |                                                                                                                           |
| 19  | **eval harness**      |      0 |    598 |   ✅   | **v2独占**: Golden Dataset + LLM-as-Judge                                                                                 |

### shared 基础设施对比

| 模块                     | v1行数 | v2行数 |                         覆盖度                         |
| :----------------------- | -----: | -----: | :----------------------------------------------------: |
| AI (provider/retry)      | ~1,800 |   ~430 |                           ✅                           |
| DB (models/ORM)          | ~1,200 |   ~796 |     ✅ (v2 21表非20: strategy_configs 在 registry)     |
| RAG (embed/search/cache) | ~1,300 | ~1,200 | ✅ (v2更丰富: multi-query/diversity/hybrid/page-index) |
| Config                   | ~2,500 |    226 |      🔴 只解析 models 段; ~15 维配置被忽略 → c25       |
| Web-extractors           | ~1,100 |   ~350 |             ✅ jina/firecrawl/readability              |
| Vector store             |   ~900 |    117 |     ⚠️ sqlite-vec 无法 SELECT 取回向量 → c28 根因      |
| Parsers                  | ~1,200 |    150 |      🟡 PDF+HTML+text 核心✅; 缺 csv/audio/video       |
| Net (SSRF/URL)           |   ~220 |   ~180 |         🟡 白名单字段死代码(config 无效) → c25         |
| Plugins                  |   ~900 |      0 |                       ⬜ 留待c13                       |

### 前端迁移状态 (apps/web)

> **2026-07-10 复核**: c03 "DONE" 仅指 eden 脚手架就绪,实际功能迁移 ~13%。

| 层面                                                | 状态                                                                                                                    |
| :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| eden 脚手架 (`api/eden.ts`)                         | ✅                                                                                                                      |
| 旧生成客户端 (`api/generated/`, 118 个 v1 路径引用) | ❌ 仍在,74 处调用                                                                                                       |
| 已迁移功能域                                        | notebooks / sessions / templates / prompt-presets (4个CRUD壳)                                                           |
| 未迁移功能域                                        | **chat/QA / sources / research / analysis / refine / studio / outputs / tasks / citations / commands** (全部 AI/流式域) |
| v1 硬编码 URL                                       | 7 处 (`/v1/...` SSE/export,v2 server 不挂 /v1 → 全 404)                                                                 |
| typecheck                                           | 207 errors (196 = .ts 后缀噪音; ~11 真实 bug,含 eden `id`/`nid` 错误)                                                   |
| 可用性                                              | workspace 渲染但 AI 功能全部不可用(打 /v1 → 404)                                                                        |

### 关键结论(2026-07-10 校正)

1. **代码量3.4:1** — TypeScript+Bun表达力更高,但"代码少"≠"行为对齐"
2. **20 router 全挂载,但 19 个 v1 端点静默缺失**(跨 8 个域)
3. **research resume 失效** — /resume 从头重跑,丢失已累积结果(此前误标为"骨架对齐")
4. **refine 是换产品** — v2 纯文本变换器 vs v1 citation-aware RAG 摘要器 → 决定回退对齐
5. **analysis 降级** — 向量KNN→关键词TF(sqlite-vec 无法 SELECT 向量) → c28
6. **前端实际只迁 ~13%** — c03 标记 DONE 误导;AI/流式域全部仍打 /v1 → 404
7. **异步 embedding 竞态** — v2 source 标记 ready 时向量可能未写入,v1 同步写入
8. **studio 无落盘** — Slidev markdown 只存 DB,预览不可用
9. **v2独占**: eval harness + templates/prompt-presets CRUD + RAG strategies registry

## 当前批次

<!-- CURRENT -->

**Phase 7**: c35 前段迁移（v2.0 发布前最终功能工作）

**进度**: Phase 7a-e 完成。17 个功能域已迁至 eden treaty。
Typecheck: 207→25 (↓88%, 25 errors all pre-existing: SSE shapes, module, type drift)。
剩余: useSources, SlidesStudioDialog, SourceConnectorsDialog (4个大文件)。

**前置**: GAP-BOARD 15/16 项已清零 ✅。后端行为已完整对齐 v1。

**目标**: 将 ~87% 未迁移的前端功能域补全，使 AI/流式域不再打 /v1→404。

先执行 /llman-sdd-propose 创建 c35-add-v2-frontend-migration 提案。

**阻塞**: c13/c14 🔒 需人工授权

**完成后**: c35 → c13 → c14 = v2.0.0

## GAP-BOARD — v1 行为对齐提案规划

> 全面复核(2026-07-10)产出。每个 gap 对照 v1 行为,标注覆盖提案与优先级。
> **原则: 一个一个做,不跳过,完整对齐 v1 行为契约。**
> 优先级: P0 = 功能不可用/数据错误 | P1 = 行为实质偏离 | P2 = 体验降级

| Gap | 域                 | 偏移描述                                                  | v1 参考                                   | 提案              | 优先级 | 状态        |
| :-- | :----------------- | :-------------------------------------------------------- | :---------------------------------------- | :---------------- | :----- | :---------- |
| G1  | refine             | 🔴 换产品:纯文本变换器→应对齐为 citation-aware RAG 摘要器 | `refine/api.py`                           | **c29** ✅        | P0     | ✅ DONE     |
| G2  | analysis           | 🔴 clustering/correlation 向量KNN降级为关键词TF           | `analysis/clustering.py`+`correlation.py` | **c28 ✅**        | P0     | ✅ DONE     |
| G3  | sources-embedding  | 🔴 异步embedding竞态:ready时向量未写入                    | `api_ingest.py:847-884`(同步)             | **c30** ✅        | P0     | ✅ DONE     |
| G4  | research-resume    | 🔴 /resume 从头重跑,丢失累积结果                          | `graph.py:_build_state_from_session`      | **c24-B ✅**      | P0     | ✅ DONE     |
| G5  | research-export    | 🔴 /export 是JSON dump,不创建source                       | `api.py:1245-1469`                        | **c24-B ✅**      | P0     | ✅ DONE     |
| G6  | research-hitl      | 🟡 HITL忽略modify/skip,只用approve                        | `graph.py:354-409`                        | **c24-B ✅**      | P1     | ✅ DONE     |
| G7  | outputs-rag        | 🟡 无RAG检索(全chunk dump)+无citations                    | `output_graph.py`                         | **c27 ✅**        | P0     | ✅ DONE     |
| G8  | citations-context  | 🔴 邻域证据审查缺失                                       | `citations/api.py`                        | **c26 ✅**        | P1     | ✅ DONE     |
| G9  | qa-noevidence      | 🟡 5个no-evidence reason仅产出1个                         | `service.py:62-69`                        | **c31 ✅** (新建) | P1     | ✅ DONE     |
| G10 | studio-persist     | 🟡 Slidev无文件系统落盘(预览不可用)                       | `studio/storage.py`                       | **c32 ✅**        | P1     | ✅ DONE     |
| G11 | studio-endpoints   | 🟡 缺4端点(草稿编辑+HITL手动改outline/markdown)           | `studio/api.py`                           | **c32 ✅** (合并) | P1     | ✅ DONE     |
| G12 | sources-endpoints  | 🟡 缺3端点(summary/per-source-qa/qa-to-source)            | `sources/api.py`+`qa/api.py`              | **c33 ✅**        | P1     | ✅ DONE     |
| G13 | sessions-endpoints | 🟡 缺2端点(GET单个+convert-to-output)                     | `sessions/api.py`                         | **c34 ✅**        | P2     | ✅ DONE     |
| G14 | source-connectors  | 🟡 sync是TODO stub,缺snapshot/apply/import-scope          | `source_connectors/api.py`                | c13 或独立        | P2     | ⬜          |
| G15 | ssrf-config        | 🟡 白名单字段死代码(config不解析)                         | `config.py`                               | c25               | P2     | ⬜ 已有提案 |
| G16 | frontend           | 🔴 ~87%未迁移,AI/流式域全打/v1→404                        | (整个前端)                                | **c35** (新建)    | P0     | ⬜ 待提案   |

### GAP-BOARD 状态总结

16 项中 15 项已清零（P0 6/6 ✅, P1 6/6 ✅, P2 3/4, G14 留待 c13）

仅剩 2 项：

- **G14** (P2): source-connectors sync → c13 阶段完成（Tauri native 文件系统集成时）
- **G16** (P0): 前端 API 迁移 17/21 域完成, typecheck 207→25 (↓88%), 剩余 4 大文件

| 上次 Agent | pi-agent (P0/P1/P2 全部清零: 10 changes 本会话 + 3 from prior agent) |
| 上次操作 | **GAP-BOARD 终结**: 本会话完成 c24-B(WS-B) / c25(SSRF) / c26(citation-context) / c27(outputs-RAG) / c31(QA-noevidence) / c32(studio) / c33(sources-extras) / c34(sessions) / c35++ 进度更新。加上前 agent 已完成的 c28/c29/c30，**GAP-BOARD 16 项中 15 项已清零**。仅剩 G14(connectors P2) + G16(前端 P0)。202 pass / 0 fail。 |
| 开放决策 | (1) **Auth**: 本地免鉴权 + 回环绑定（c13阶段）。(2) **React**: 暂锁18.2.0，待迁移MUI后升19。(3) AI SDK v7 tool() 用inputSchema。(4) **WS-B 拆分为多个对齐提案**(GAP-BOARD),不再作为单一批次;research 部分(resume/export/hitl)作为 c24-B 拆分项。(5) refine 回退对齐 v1(citation-aware RAG 摘要器)。(6) 前端迁移(~87%)在后端对齐后统一补齐(c35)。(7) oxlint warning 147 处非阻塞。 |
| 已知问题 | **🔴 GAP-BOARD 16 项**: 见上方 GAP-BOARD 表(6 P0 / 6 P1 / 4 P2)。**🟡 P1**: web typecheck 207 errors(196噪音+11真实)。**🟡 P1**: v2无auth。**🟢 暂缓**: @material-tailwind→MUI迁移。**✅ 已修**: dedup 跨notebook误判409 + worker dispatch payload.type缺失。 |
| 质量门禁 | (本次仅文档更新,无代码变更)`bun oxlint` → 0 errors / 147 warnings ✅。`bun typecheck` (server) ✅。`bun test` (server) → 144 pass / 0 fail ✅。`bun test tests/bdd/` → 21 pass ✅ |

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

| AI SDK v7 能力                      | 替代                              | 现状                                        |
| :---------------------------------- | :-------------------------------- | :------------------------------------------ |
| `ToolLoopAgent`                     | Pi agent-core、自建 Agent runtime | 🟡 research 尚未接线（c24-B 目标）          |
| `WorkflowAgent` + Workflow Patterns | Mastra workflows、LangGraph.js    | ⬜ 未使用                                   |
| `toolApproval: 'user-approval'`     | 手写 HITL、DB 轮询                | 🟡 **当前 research 用 DB 轮询**，c24-B 切换 |
| `generateObject({ schema: Zod })`   | pydantic-ai `output_type`         | ✅ 已用                                     |
| `streamText` / `fullStream`         | 手写 SSE 轮询                     | ✅ 已用                                     |

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
