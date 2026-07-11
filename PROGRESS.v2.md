# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

## 状态看板

| #   | Change                 | 状态                                                                                         |
| :-- | :--------------------- | :------------------------------------------------------------------------------------------- |
| c00 | server-foundation      | ✅ DONE                                                                                      |
| c01 | data-layer             | ✅ DONE                                                                                      |
| c02 | ai-runtime             | ✅ DONE                                                                                      |
| c03 | frontend-eden          | ✅ DONE                                                                                      |
| c04 | core-crud              | ✅ DONE                                                                                      |
| c05 | rag-embed              | ✅ DONE                                                                                      |
| c06 | rag-registry           | ✅ DONE                                                                                      |
| c07 | qa-pipeline            | ✅ DONE                                                                                      |
| c08 | research-agent         | ✅ DONE                                                                                      |
| c09 | outputs-generation     | ✅ DONE                                                                                      |
| c10 | models-management      | ✅ DONE                                                                                      |
| c11 | eval-harness           | ✅ DONE                                                                                      |
| c12 | analysis-studio-refine | ✅ DONE                                                                                      |
| c15 | bdd-tests              | ✅ DONE                                                                                      |
| c16 | rag-foundations        | ✅ DONE                                                                                      |
| c17 | qa-citations           | ✅ DONE                                                                                      |
| c18 | source-dedup-safety    | ✅ DONE                                                                                      |
| c19 | task-queue             | ✅ DONE (Semaphore + TaskQueue + crash-recovery)                                             |
| c20 | outputs-refine         | ✅ DONE                                                                                      |
| c21 | web-extractors         | ✅ DONE                                                                                      |
| c22 | research-agent         | ✅ DONE (parity via c24-B + c37; ToolLoopAgent/toolApproval 仍为延迟改进，见 c24 未勾 tasks) |
| c23 | studio-analysis        | ✅ DONE                                                                                      |
| c24 | pipeline-integration   | ✅ DONE (WS-A✅ / WS-B✅ / WS-C✅)                                                           |
| c25 | ssrf-config            | ✅ DONE (本会话)                                                                             |
| c26 | citation-context       | ✅ DONE (本会话)                                                                             |
| c27 | outputs-rag            | ✅ DONE (本会话)                                                                             |
| c28 | analysis-vector        | ✅ DONE (前agent)                                                                            |
| c29 | refine-revert          | ✅ DONE (前agent)                                                                            |
| c30 | sync-embedding         | ✅ DONE (前agent)                                                                            |
| c31 | qa-noevidence          | ✅ DONE (本会话)                                                                             |
| c32 | studio-persist         | ✅ DONE (本会话)                                                                             |
| c33 | source-extras          | ✅ DONE (本会话)                                                                             |
| c34 | sessions-convert       | ✅ DONE (本会话)                                                                             |
| c35 | frontend-migration     | ✅ DONE                                                                                      |
| c36 | align-qa-pipeline      | ✅ DONE (确定性检索/no-evidence 5reason/export/confidence/source_ids)                        |
| c37 | align-research-agent   | ✅ DONE (resume推断/skip推进/finish生成report/delete/SSE命名事件)                            |
| c38 | align-outputs-pipeline | ✅ DONE (source_ids RAG接通/citation mapping/postprocess/export markdown)                    |
| c39 | align-sources-sessions | ✅ DONE (竞态修复/dedup默认prompt/tags校验/link模式/QA向量/sessions补全)                     |
| c40 | align-shared-infra     | ✅ DONE (config typed/retry Retry-After/searchVectors source_ids)                            |
| c41 | ts-upgrade             | ✅ DONE (TS ^5→^7, Go-native tsc, tsconfig unified)                                          |
| c13 | distribution           | ⏸️ BLOCKED (等人工授权) 🔒 需要人工授权                                                      |
| c14 | cleanup-delivery       | ⏸️ BLOCKED (等人工授权) 🔒 需要人工授权                                                      |

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

> ⚠️ **历史审计快照（2026-07-10）** — 下列完成度/备注反映当时对拍，**已被 c24–c40 + 三轮复核覆盖**。
> 当前真实缺口以 **「当前批次 / 第三轮复核」** 与 **GAP-BOARD 状态** 为准，勿用本表驱动实现。
> 完成度图例（快照当时）: ✅ 对齐 | 🟡 部分对齐 | 🔴 实质性偏移/缺失

| #   | 功能域                | v1行数 | v2行数 | 完成度(快照) | 备注(2026-07-10 当时)                               |
| :-- | :-------------------- | -----: | -----: | :----------: | :-------------------------------------------------- |
| 1   | notebooks             |    257 |    135 |      ✅      | 端点齐全; v2 有 eden bug(`id`/`nid`)                |
| 2   | sessions              |    675 |    200 |      🟡      | 缺 GET 单个 + convert-to-output → 后由 c34/c39 处理 |
| 3   | messages              |    216 |    124 |      ✅      |                                                     |
| 4   | citations             |    136 |     37 |      🔴      | echo 端点; /context 缺失 → c26                      |
| 5   | **QA pipeline**       |  1,311 |    552 |      🟡      | 后由 c31/c36 对齐                                   |
| 6   | **research agent**    |  2,834 |    925 |      🟡      | 后由 c24-B/c37 对齐；ToolLoopAgent 仍延迟           |
| 7   | outputs               |  1,023 |    437 |      🟡      | 后由 c27/c38 对齐                                   |
| 8   | **refine**            |    321 |    138 |      🔴      | 后由 c29 回退对齐 v1                                |
| 9   | **studio**            |  1,686 |    344 |      🟡      | 后由 c32/c23 处理落盘与端点                         |
| 10  | **analysis**          |    427 |    698 |      🔴      | 后由 c28 向量策略；第三轮仍有 relations P0          |
| 11  | commands              |     75 |     64 |      ✅      |                                                     |
| 12  | models mgmt           |    112 |     55 |      🟡      | 缺 GET 单个等细节见第三轮 P1                        |
| 13  | templates             |    332 |    120 |      ✅      | v2独占 CRUD                                         |
| 14  | prompt presets        |    268 |    111 |      ✅      | v2独占 CRUD                                         |
| 15  | sources CRUD+ingest   |  2,867 |    979 |      🟡      | 后由 c30/c33/c39 处理                               |
| 16  | **source connectors** |  1,272 |    195 |    🟡15%     | **仍开放** → G14 / c13                              |
| 17  | tasks/queue           |    595 |    531 |      ✅      |                                                     |
| 18  | workspace             |    274 |     63 |      ✅      |                                                     |
| 19  | **eval harness**      |      0 |    598 |      ✅      | v2独占                                              |

### shared 基础设施对比

> 同上：2026-07-10 快照。Config/SSRF → c25；向量 SELECT → c28。以 CURRENT 为准。

| 模块                     | v1行数 | v2行数 |                      覆盖度(快照)                      |
| :----------------------- | -----: | -----: | :----------------------------------------------------: |
| AI (provider/retry)      | ~1,800 |   ~430 |                           ✅                           |
| DB (models/ORM)          | ~1,200 |   ~796 |     ✅ (v2 21表非20: strategy_configs 在 registry)     |
| RAG (embed/search/cache) | ~1,300 | ~1,200 | ✅ (v2更丰富: multi-query/diversity/hybrid/page-index) |
| Config                   | ~2,500 |   ~226 |            快照🔴 → 后由 c25/c40 消费更多段            |
| Web-extractors           | ~1,100 |   ~350 |             ✅ jina/firecrawl/readability              |
| Vector store             |   ~900 |    117 |               快照⚠️ → c28 处理向量取回                |
| Parsers                  | ~1,200 |    150 |      🟡 PDF+HTML+text 核心✅; 缺 csv/audio/video       |
| Net (SSRF/URL)           |   ~220 |   ~180 |                快照🟡 → c25 接通白名单                 |
| Plugins                  |   ~900 |      0 |                      ⬜ 留待 c13                       |

### 前端迁移状态 (apps/web)

> **2026-07-11 更新**: c35 完成后运行时以 eden 为主；`api/generated/` 仍有类型-only 引用，**删除推迟到 c14**。

| 层面                            | 状态                                           |
| :------------------------------ | :--------------------------------------------- |
| eden 脚手架 (`api/eden.ts`)     | ✅                                             |
| 旧生成客户端 (`api/generated/`) | 🟡 残留类型 import（~18 处）；c14 迁类型后删除 |
| 功能域 API                      | ✅ c35：多数域已迁 eden；细节见第三轮 P1       |
| typecheck (web)                 | 🟡 ~22–23 pre-existing errors                  |
| 可用性                          | workspace + AI 域走 v2；残留兼容差异见 CURRENT |

### 关键结论（快照 2026-07-10 → 后续消化）

1. **代码量3.4:1** — 仍成立；"代码少"≠"行为对齐" 仍成立
2. ~~19 个端点静默缺失~~ → 多数由 c26–c34 / c36–c40 补齐；残留见第三轮 P1/P2
3. ~~research resume 失效~~ → c24-B / c37
4. ~~refine 换产品~~ → c29
5. ~~analysis 向量降级~~ → c28；第三轮仍有 relations P0
6. ~~前端只迁 ~13%~~ → c35；generated 类型清理 → c14
7. ~~异步 embedding 竞态~~ → c30 / c39
8. ~~studio 无落盘~~ → c32
9. **v2独占**: eval harness + templates/prompt-presets CRUD + RAG strategies registry
10. **仍开放**: G14 source-connectors（c13）；c13/c14 等人授权；第三轮 P0/P1

## 当前批次

<!-- CURRENT -->

**2026-07-11 代码复核 + P0/Studio/Connectors 修复（不采信旧文档总结）。**

### 复核结论（相对 PROGRESS 乐观表述的修正）

旧 CURRENT 写「仅 1 个 P0 + 多数 P2」**不成立**。对照 `backend/py` 源码复核后，核心 AI 域仍有多处用户可见断裂；本会话已修一批，仍有残留。

### 本会话已修（P0 + Studio/Connectors）

| 域                | 修复                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **QA**            | 空 `source_ids` → `no_sources`；stream 持久化 citations；export `inArray` 全量 sources                   |
| **Research HITL** | `waitForApproval` 识别 modify/skip/finish；modify 应用新 plan；finish 不再被 agent 覆盖 report           |
| **Analysis**      | 主字段返回 snake_case chunk-level `relations`/`contradictions`（对齐 v1 + 前端）                         |
| **Studio**        | 强制 `source_ids`；`getContext` 按 source 过滤；AI markdown 同步 outputs；UI/队列改 v2 POST（弃 v1 SSE） |
| **Connectors**    | 实现 snapshot / sync-check / apply / import-scope + 文件系统扫描；UI 迁 eden v2                          |

### 仍开放（未在本会话清零）

#### P1（实质偏离）

- QA：notebook / source_ids 归属校验仍弱
- Research：`inferResumeState` 与 v1 仍有分歧；`cleanupExpiredLocks` 无调用；SSE `waiting` 时机
- Outputs：convert-to-source 缺 `bumpSourcesEpoch`；归属可选；citation 未嵌回 content tree
- Sources：link 模式不 embed；`/search` 仍是 RAG placeholder（非 v1 web search graph）；re-embed status 生命周期
- Refine：`chunk_index` 0-based vs v1 1-based
- Messages list 默认 limit 20（v1=200）

#### P2 / 架构债

- Parsers：无专用 CSV/audio/video（CSV→text）
- Plugin host 缺失（connectors/studio 硬编码）
- AI SDK：仍无 `ToolLoopAgent` / `toolApproval`（research 继续 DB 轮询 HITL）
- c13 distribution / c14 cleanup — 等人工授权
- web typecheck 残留 errors；`api/generated/` 类型残留 → c14

**当前状态**:

- Server test: **209 pass / 2 fail**（同前：research 网络 + URL 超时，非本会话回归）
- 下一阶段建议: 清 P1 行为债 → 再授权 c13/c14

### GAP-BOARD 更新

- G14 source-connectors：**本会话实现最小可用同步管线**（filesystem Obsidian/local-directory）。完整插件生态仍属 c13 范畴。
- Studio 前后端契约断裂：**本会话已迁 v2**。

## GAP-BOARD — v1 行为对齐提案规划

> 全面复核(2026-07-10)产出。每个 gap 对照 v1 行为,标注覆盖提案与优先级。
> **原则: 一个一个做,不跳过,完整对齐 v1 行为契约。**
> 优先级: P0 = 功能不可用/数据错误 | P1 = 行为实质偏离 | P2 = 体验降级

| Gap | 域                 | 偏移描述                                                  | v1 参考                                   | 提案                                      | 优先级 | 状态                            |
| :-- | :----------------- | :-------------------------------------------------------- | :---------------------------------------- | :---------------------------------------- | :----- | :------------------------------ |
| G1  | refine             | 🔴 换产品:纯文本变换器→应对齐为 citation-aware RAG 摘要器 | `refine/api.py`                           | **c29** ✅                                | P0     | ✅ DONE                         |
| G2  | analysis           | 🔴 clustering/correlation 向量KNN降级为关键词TF           | `analysis/clustering.py`+`correlation.py` | **c28 ✅**                                | P0     | ✅ DONE                         |
| G3  | sources-embedding  | 🔴 异步embedding竞态:ready时向量未写入                    | `api_ingest.py:847-884`(同步)             | **c30** ✅                                | P0     | ✅ DONE                         |
| G4  | research-resume    | 🔴 /resume 从头重跑,丢失累积结果                          | `graph.py:_build_state_from_session`      | **c24-B ✅**                              | P0     | ✅ DONE                         |
| G5  | research-export    | 🔴 /export 是JSON dump,不创建source                       | `api.py:1245-1469`                        | **c24-B ✅**                              | P0     | ✅ DONE                         |
| G6  | research-hitl      | 🟡 HITL忽略modify/skip,只用approve                        | `graph.py:354-409`                        | **c24-B ✅** + 2026-07-11 HITL 修复       | P1     | ✅ DONE                         |
| G7  | outputs-rag        | 🟡 无RAG检索(全chunk dump)+无citations                    | `output_graph.py`                         | **c27 ✅**                                | P0     | ✅ DONE                         |
| G8  | citations-context  | 🔴 邻域证据审查缺失                                       | `citations/api.py`                        | **c26 ✅**                                | P1     | ✅ DONE                         |
| G9  | qa-noevidence      | 🟡 5个no-evidence reason仅产出1个                         | `service.py:62-69`                        | **c31 ✅** (新建)                         | P1     | ✅ DONE                         |
| G10 | studio-persist     | 🟡 Slidev无文件系统落盘(预览不可用)                       | `studio/storage.py`                       | **c32 ✅**                                | P1     | ✅ DONE                         |
| G11 | studio-endpoints   | 🟡 缺4端点(草稿编辑+HITL手动改outline/markdown)           | `studio/api.py`                           | **c32 ✅** (合并)                         | P1     | ✅ DONE                         |
| G12 | sources-endpoints  | 🟡 缺3端点(summary/per-source-qa/qa-to-source)            | `sources/api.py`+`qa/api.py`              | **c33 ✅**                                | P1     | ✅ DONE                         |
| G13 | sessions-endpoints | 🟡 缺2端点(GET单个+convert-to-output)                     | `sessions/api.py`                         | **c34 ✅**                                | P2     | ✅ DONE                         |
| G14 | source-connectors  | 🟡 sync是TODO stub,缺snapshot/apply/import-scope          | `source_connectors/api.py`                | **2026-07-11 最小管线**                   | P2     | ✅ 最小可用（插件生态仍属 c13） |
| G15 | ssrf-config        | 🟡 白名单字段死代码(config不解析)                         | `config.py`                               | **c25** ✅                                | P2     | ✅ DONE                         |
| G16 | frontend           | ✅ 前端 API 迁移完成 (19/21 域, typecheck 207→23 ↓89%)    | (整个前端)                                | **c35** ✅ + Studio/Connectors 本会话补迁 | P0     | ✅ DONE                         |

### GAP-BOARD 状态总结

**16/16 主 gap 清零或最小可用**（G14 文件系统管线已落地；完整插件 host 仍属 c13）。

> ⚠️ **对拍说明**: 早期 ✅ 曾表示「端点存在」而非「行为对齐」。c36–c40 + 2026-07-11 复核修了多处伪对齐。
> `llman sdd list`: 部分 change tasks.md 可能仍未勾选/未 archive——**不要仅凭本表 archive**。

| 上次 Agent | 代码复核 + P0/Studio/Connectors 修复 + PROGRESS 纠偏 |
| 上次操作 | **fix**: QA source_ids/stream citations/export；Research HITL modify/skip/finish；Analysis snake_case edges；Studio source_ids+UI v2；Connectors snapshot/sync/apply + UI v2。**doc**: 重写 CURRENT，纠正「仅1个P0」乐观结论。 |
| 开放决策 | (1) **Auth**: 本地免鉴权 + 回环绑定（c13）。(2) **React**: 暂锁18.2.0。(3) **c13/c14 等人工授权**。(4) 残留 P1 是否继续修 vs 推迟。(5) SDD archive 卫生。 |
| 已知问题 | **🟡 P1**: QA 归属校验；Research resume/locks/SSE；Outputs bumpSourcesEpoch；Sources link/search；Refine chunk_index；messages limit。**🟡 P2**: parsers/plugins/ToolLoopAgent。**🟡**: web typecheck；`api/generated/` → c14。 |
| 质量门禁 | `bun test` (server) → 209 pass / 2 fail（网络超时，非本会话回归）。 |

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

| AI SDK v7 能力                      | 替代                              | 现状                                                                                     |
| :---------------------------------- | :-------------------------------- | :--------------------------------------------------------------------------------------- |
| `ToolLoopAgent`                     | Pi agent-core、自建 Agent runtime | 🟡 research 仍可用 DB 轮询 HITL；切 toolApproval 为延迟改进（c24 未勾 tasks / post-c13） |
| `WorkflowAgent` + Workflow Patterns | Mastra workflows、LangGraph.js    | ⬜ 未使用                                                                                |
| `toolApproval: 'user-approval'`     | 手写 HITL、DB 轮询                | 🟡 **当前 research 用 DB 轮询**；事件驱动为可选改进，非 v1 parity 阻塞                   |
| `generateObject({ schema: Zod })`   | pydantic-ai `output_type`         | ✅ 已用                                                                                  |
| `streamText` / `fullStream`         | 手写 SSE 轮询                     | ✅ 已用                                                                                  |

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
- ❌ 重新调研已有结论的领域（先查 PROGRESS.v2.md；过时的 GAP-REPORT 已删除）

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
