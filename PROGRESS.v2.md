# Crystalith v2 — 实现进度追踪

> Agent-only. 引用此文件即自动接管当前批次。

## 状态看板

| #   | Change                               | 状态                                                                                                                                |
| :-- | :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| c00 | server-foundation                    | ✅ DONE                                                                                                                             |
| c01 | data-layer                           | ✅ DONE                                                                                                                             |
| c02 | ai-runtime                           | ✅ DONE                                                                                                                             |
| c03 | frontend-eden                        | ✅ DONE                                                                                                                             |
| c04 | core-crud                            | ✅ DONE                                                                                                                             |
| c05 | rag-embed                            | ✅ DONE                                                                                                                             |
| c06 | rag-registry                         | ✅ DONE                                                                                                                             |
| c07 | qa-pipeline                          | ✅ DONE                                                                                                                             |
| c08 | research-agent                       | ✅ DONE                                                                                                                             |
| c09 | outputs-generation                   | ✅ DONE                                                                                                                             |
| c10 | models-management                    | ✅ DONE                                                                                                                             |
| c11 | eval-harness                         | ✅ DONE                                                                                                                             |
| c12 | analysis-studio-refine               | ✅ DONE                                                                                                                             |
| c15 | bdd-tests                            | ✅ DONE                                                                                                                             |
| c16 | rag-foundations                      | ✅ DONE                                                                                                                             |
| c17 | qa-citations                         | ✅ DONE                                                                                                                             |
| c18 | source-dedup-safety                  | ✅ DONE                                                                                                                             |
| c19 | task-queue                           | ✅ DONE (Semaphore + TaskQueue + crash-recovery)                                                                                    |
| c20 | outputs-refine                       | ✅ DONE                                                                                                                             |
| c21 | web-extractors                       | ✅ DONE                                                                                                                             |
| c22 | research-agent                       | ✅ DONE (parity via c24-B + c37; ToolLoopAgent/toolApproval 仍为延迟改进，见 c24 未勾 tasks)                                        |
| c23 | studio-analysis                      | ✅ DONE                                                                                                                             |
| c24 | pipeline-integration                 | ✅ DONE (WS-A✅ / WS-B✅ / WS-C✅)                                                                                                  |
| c25 | ssrf-config                          | ✅ DONE (本会话)                                                                                                                    |
| c26 | citation-context                     | ✅ DONE (本会话)                                                                                                                    |
| c27 | outputs-rag                          | ✅ DONE (本会话)                                                                                                                    |
| c28 | analysis-vector                      | ✅ DONE (前agent)                                                                                                                   |
| c29 | refine-revert                        | ✅ DONE (前agent)                                                                                                                   |
| c30 | sync-embedding                       | ✅ DONE (前agent)                                                                                                                   |
| c31 | qa-noevidence                        | ✅ DONE (本会话)                                                                                                                    |
| c32 | studio-persist                       | ✅ DONE (本会话)                                                                                                                    |
| c33 | source-extras                        | ✅ DONE (本会话)                                                                                                                    |
| c34 | sessions-convert                     | ✅ DONE (本会话)                                                                                                                    |
| c35 | frontend-migration                   | ✅ DONE                                                                                                                             |
| c36 | align-qa-pipeline                    | ✅ DONE (确定性检索/no-evidence 5reason/export/confidence/source_ids)                                                               |
| c37 | align-research-agent                 | ✅ DONE (resume推断/skip推进/finish生成report/delete/SSE命名事件)                                                                   |
| c38 | align-outputs-pipeline               | ✅ DONE (source_ids RAG接通/citation mapping/postprocess/export markdown)                                                           |
| c39 | align-sources-sessions               | ✅ DONE (竞态修复/dedup默认prompt/tags校验/link模式/QA向量/sessions补全)                                                            |
| c40 | align-shared-infra                   | ✅ DONE (config typed/retry Retry-After/searchVectors source_ids)                                                                   |
| c41 | ts-upgrade                           | ✅ DONE (TS ^5→^7, Go-native tsc, tsconfig unified)                                                                                 |
| c42 | outputs-contract                     | ✅ DONE (OutputRead契约/citation树映射持久化/RAG失败传播/字段级postprocess/错误码)                                                  |
| c43 | studio-sse-rag                       | ✅ DONE (SSE流式端点/ragRegistry接入/drafts-latest/stale清理/preview/frontmatter确定性)                                             |
| c44 | sources-search-extract               | ✅ DONE (web search真实现/extractors完整响应/dedup配置门控/re-embed强制FAILED/400+归属)                                             |
| c45 | qa-context-citations                 | ✅ DONE (ContextStats字段对齐/inline citation兜底/low_similarity空citations/prompt指令)                                             |
| c46 | parsers-research                     | ✅ DONE (CSV markdown-table parser/report富prompt/AI失败fallback/lock续期/dedup增强)                                                |
| c47 | analysis-relations-knn               | ✅ DONE (本会话: relations 回归 KNN/score=1-distance/topics去ghost/RelationType→shared)                                             |
| c48 | qa-determinism-export                | ✅ DONE (本会话: multiQuery确定性/stats preset/ContextStats真token/export page·para+sources)                                        |
| c49 | research-dedup-report-sse            | ✅ DONE (本会话: 跨迭代dedup/双report 6段prompt/SSE status·thinking/resume plan/note STRUCTURED)                                    |
| c50 | outputs-slides-guard                 | ✅ DONE (本会话: SLIDES 400守卫/source_id校验/citation sanitize/LLM repair loop)                                                    |
| c51 | studio-response-shape                | ✅ DONE (本会话: serializeSlide字段/SSE done·trace_id·toolcall/outputId FK/stale清理)                                               |
| c52 | models-sessions-parity               | ✅ DONE (本会话: providers envelope/provider过滤/default顶层/message_ids/convert文本格式)                                           |
| c53 | sources-citations-contract           | ✅ DONE (本会话: qa-to-source多轮/tag per-item/CSV转义/citations路径BREAKING/connector校验)                                         |
| c54 | error-envelope-contextstats-shared   | ✅ DONE (2026-07-13: sendError helper+ErrorCode映射/6 router改造/ContextStats→shared Zod SSOT; +3 reqs archived)                    |
| c55 | context-window-real-compression      | ✅ DONE (2026-07-13: truncateToTokenBudget移植v1 _truncate_blocks/QA Step12真实截断; +1 req archived)                               |
| c56 | studio-config-and-workspace-schema   | ✅ DONE (2026-07-13: generation_config区间展开/frontmatter v1 6-key/preference→retrieval/workspace config_schema; +3 reqs archived) |
| c57 | sources-safety-and-diagnostics       | ✅ DONE (2P0+4P1: notebook归属校验/connector dedup门控/batch results/reembed清字段/ingestion 4-stage诊断/tag缓存失效)              |
| c58 | research-feedback-loop-and-state     | ✅ DONE (5P1: suggested_queries反馈环/锁周期续期/finish真fallback/stream auto-resume/skip→analyze)                                  |
| c59 | outputs-fallback-and-postprocess     | ✅ DONE (3P1: fallback标题用prompt/postprocess嵌套回填/_postprocessed无条件设)                                                      |
| c60 | qa-contextstats-accounting           | ✅ DONE (2P1: system_tokens真实计数/max_tokens读配置)                                                                               |
| c61 | templates-presets-builtin-protection | ✅ DONE (2P1: templates is_builtin保护/presets trigger唯一性+builtin冲突)                                                          |
| c62 | sources-extractors-shape-from-url    | ✅ DONE (2P1: extractors响应字段对齐/default按可用性/from-url extractor+mode枚举)                                                   |
| c63 | adapt-frontend-v2-contracts          | 🔄 PROPOSED (前端适配: sources notebook_id query/ErrorEnvelope统一解析/陈旧类型清理; extractors/SSE/OutputRead审计确认已对齐)       |
| c13 | distribution                         | ⏸️ BLOCKED (等人工授权) 🔒 需要人工授权                                                                                             |
| c14 | cleanup-delivery                     | ⏸️ BLOCKED (等人工授权) 🔒 需要人工授权                                                                                             |

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

| #   | 功能域                | v1行数 | v2行数 | 完成度(快照) | 备注(2026-07-10 当时)                                       |
| :-- | :-------------------- | -----: | -----: | :----------: | :---------------------------------------------------------- |
| 1   | notebooks             |    257 |    135 |      ✅      | 端点齐全; v2 有 eden bug(`id`/`nid`)                        |
| 2   | sessions              |    675 |    200 |      🟡      | 缺 GET 单个 + convert-to-output → 后由 c34/c39 处理         |
| 3   | messages              |    216 |    124 |      ✅      |                                                             |
| 4   | citations             |    136 |     37 |      🔴      | echo 端点; /context 缺失 → c26                              |
| 5   | **QA pipeline**       |  1,311 |    552 |      🟡      | 后由 c31/c36 对齐                                           |
| 6   | **research agent**    |  2,834 |    925 |      🟡      | 后由 c24-B/c37 对齐；ToolLoopAgent 仍延迟                   |
| 7   | outputs               |  1,023 |    437 |      🟡      | 后由 c27/c38 对齐                                           |
| 8   | **refine**            |    321 |    138 |      🔴      | 后由 c29 回退对齐 v1                                        |
| 9   | **studio**            |  1,686 |    344 |      🟡      | 后由 c32/c23 处理落盘与端点                                 |
| 10  | **analysis**          |    427 |    698 |      🔴      | 后由 c28 向量策略；relations P0 由 c47 解决 (KNN+score语义) |
| 11  | commands              |     75 |     64 |      ✅      |                                                             |
| 12  | models mgmt           |    112 |     55 |      🟡      | 缺 GET 单个等细节见第三轮 P1                                |
| 13  | templates             |    332 |    120 |      ✅      | v2独占 CRUD                                                 |
| 14  | prompt presets        |    268 |    111 |      ✅      | v2独占 CRUD                                                 |
| 15  | sources CRUD+ingest   |  2,867 |    979 |      🟡      | 后由 c30/c33/c39 处理                                       |
| 16  | **source connectors** |  1,272 |    195 |    🟡15%     | **仍开放** → G14 / c13                                      |
| 17  | tasks/queue           |    595 |    531 |      ✅      |                                                             |
| 18  | workspace             |    274 |     63 |      ✅      |                                                             |
| 19  | **eval harness**      |      0 |    598 |      ✅      | v2独占                                                      |

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

**2026-07-14 第八轮：c57–c62 正式 change 化 + 全部实现（第七轮审计的 2 P0 + ~18 P1 清零）。**

### 复核方法

承接第七轮深度审计的 2 P0 + ~20 P1 清单，按域分组为 6 个独立 SDD change（c57–c62），逐个 apply 实现 + 测试 + commit。plugins host 及其连带项（trafilatura/browserless extractors、audio/video parsers、外部 connector）确认为桌面版出范围，不 change 化。

### 本会话产出

| Change  | 域                | P0 | P1 | 内容                                                                                                  | 状态             |
| ------- | ----------------- | -- | -- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| **c57** | sources+connectors| 2  | 4  | notebook归属校验(4路由)/connector dedup门控/batch per-item results/reembed清字段/ingestion 4-stage诊断/tag缓存失效 | ✅ DONE `b3e911bd` |
| **c58** | research          | 0  | 5  | suggested_queries反馈环/锁周期续期/finish真fallback(非哨兵)/stream auto-resume/skip→analyze            | ✅ DONE `dd2677f7` |
| **c59** | outputs           | 0  | 3  | fallback标题用prompt(非error.message)/postprocess嵌套回填(per-type)/_postprocessed无条件设            | ✅ DONE `06aa6724` |
| **c60** | qa                | 0  | 2  | ContextStats system_tokens真实计数(非0)/max_tokens读配置(非硬编码8000)                                | ✅ DONE `c59487af` |
| **c61** | templates+presets | 0  | 2  | templates is_builtin保护(不可改删)/presets trigger唯一性+builtin冲突检查                              | ✅ DONE `5660e928` |
| **c62** | sources           | 0  | 2  | extractors响应字段对齐v1/default按可用性计算/from-url extractor参数+mode枚举校验                      | ✅ DONE `4c291e68` |

### 实现要点

- **c57**: 单 source 路由用 `?notebook_id=` query 校验（非路径嵌套，降低前端 BREAKING）；4-stage 诊断用 PARSE_ERROR/EMBEDDING_FAILED/VECTOR_STORE_FAILED/INGESTION_FAILED + recoveryHint
- **c58**: `synthesizeFallbackReport()` 从结果合成有意义中文报告替代哨兵字符串；锁续期用 `setInterval(300s)` + try/finally；skip 分支先 analyze 再 continue
- **c59**: `generateFallbackContent` 加 `prompt` 参数（截断 200）；`ensureMinimumContentFields` 做 per-type 嵌套 `{text, citations:[1]}` 回填；`markPostprocessed` 无条件设
- **c60**: `system_tokens = countTokens(systemPrompt)`；`maxTokens` 从 `getContextWindowSettings().max_tokens` 读
- **c61**: builtin template PATCH/DELETE 返回 409；presets `checkTriggerConflict()` 查 builtin + custom 重复
- **c62**: `ExtractorMetadata` 加 type/enabled/description/requires_service；`getDefaultExtractor()` 按可用性；from-url 加 extractor/mode 枚举/snippet

### 质量门禁

- Server test: **281 pass / 0 fail**（较第七轮 257→281，+24 新测试：c57×3 + c58×4 + c59×10 + c60×4 + c62×3）
- Server typecheck: **✅ pass**
- oxlint: server 0 error（web 预存 lint error 后置）
- SDD: c57–c62 全部 validate ✅；tasks 全勾（除 oxlint task 标注 web 后置）
- Active changes: c57–c62 待 archive（实现完成，spec delta 待合并）

### 下一步

**启动 bun dev 前后端联调实验**——所有 P0/P1 已清零，核心流水线（retrieval/QA/research/outputs/studio/sources）足够稳定。联调可验证：
1. 前端 SSE + OutputRead + ErrorEnvelope + config_schema 契约适配
2. sources `?notebook_id=` query 传递（前端调用需加此参数）
3. extractors 响应新字段消费
4. 实际 AI 调用质量（fallback / postprocess / research 反馈环）

联调后可逐个 `llman-sdd-archive` 归档 c57–c62。

---

**2026-07-13 第七轮：v1↔v2 全域深度行为审计 + plugins host 设计决策（纯审计，无代码改动）。**

v1 用 `shared/plugins/`（1091 行 PluginRegistry + 6 类插件接口：AIProvider/Parser/OutputType/SlidesWorkflow/WebExtractor/SourceConnector）实现插件扩展；v2 是**单体架构**（所有 parsers/extractors/output-types/slides/connectors 硬编码在 core）。经评估，v2 单体设计**有意为之**（单二进制桌面分发、sqlite-vec 内嵌、无第三方扩展需求），plugins host **不作为 v1 parity 缺口追踪**。

影响：以下原 P1 项**降级为"桌面版出范围"**，不再追踪：

- trafilatura / browserless extractors（v2 用 readability + jina + firecrawl 替代）
- audio / video / transcription parsers（v1 core 也没有，靠 plugin）
- 外部 source connector 加载（v2 内建 obsidian + local-directory 2 项，够用）
- AI provider 插件（v2 用 provider registry 动态 import）

### 审计结论

**端点对齐：基本完成**。v1 82 个注册端点中 81 个有 v2 对应（仅 `/research/:id/start` 缺失，且为 v2 设计选择——create 即自动 spawn）。v2 另有 ~15 个独占端点（eval 域、templates/prompt-presets CRUD、各种 list/types/providers 端点）。

**行为对齐：核心流水线强，细节偏差多**。c42–c56 修复基本属实，但发现：

| 类别         | 数量  | 说明                                                                                                                                                         |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 新 P0        | 2     | connector dedup 不按配置门控；单 source 路由不做 notebook 归属校验（隔离问题）                                                                               |
| 新 P1        | ~20   | research 状态机细节(5)、sources 诊断/缓存/批量(6)、outputs fallback/postprocess(3)、qa ContextStats(2)、templates/prompt-presets 保护(2)、shared 基础设施(2) |
| c42–c56 验证 | 28 项 | 全部通过（含 c47 KNN、c48 multiQuery、c50 SLIDES 守卫、c51 SSE、c56 config_schema）                                                                          |

**架构差距（已关闭/重分类）**：~~plugins host~~ → 设计决策，移出范围；config 段落未解析 → 多数 c13 延后或桌面版出范围；cache provider（Redis）/ per-stage 并发限流 → 桌面版出范围。

### 强对齐领域（无需进一步工作）

AI retry 中间件（最忠实移植）、SSRF/net 安全（v2 甚至超出 v1，额外阻塞 CGNAT/广播）、output_graph 5 节点流水线、analysis 聚类/相关/矛盾、QA 核心流水线、refine（c29）、studio c56、epoch 检索缓存、db schema（v2 超集 +4 eval 表）、eval harness（v2 独占且领先）。

### 新发现 P0（建议立即修，非 c13 范围）

1. **connector dedup 配置门控**：`source-connectors/sync.ts:203-215` 总是无条件 dedup；v1 `source_connectors/api.py:898,1070` 用 `if settings.source_ingestion.dedup.enabled:` 门控。配置关闭 dedup 时 v2 错误复用已有 source。
2. **单 source 路由不做 notebook 归属校验**：`GET/DELETE/POST /sources/:id`（router.ts:289,313,540）、`GET /sources/:id/chunks`（521）不验证 source 属于调用者 notebook。v1 嵌在 `/notebooks/{nid}/sources/...` 下并校验。**跨 notebook 访问风险**。

### 新发现 P1（按域分组，可独立修）

- **research**：`suggested_queries` 反馈环断裂（agent.ts:107 不传 analyze 的 suggestedQueries，v1 graph.py:170-171 传入）；锁续期按迭代非周期（agent.ts:428 vs v1 api.py:885-899 每 300s 后台续期）；`/finish` 可能持久化哨兵 `'(report generation failed)'`（router.ts:519，v1 总生成真实 fallback report graph.py:811-823）；SSE `/stream` 不自动 resume 卡住会话（v1 api.py:972-983 检测锁过期触发 resume）；skip 跳过 Analyze 步骤（agent.ts:484-489 vs graph.py:364）
- **sources**：batch 缺 per-item `results` 数组（router.ts:624,664-669 vs api_schemas.py:111-126）；re-embed 不清 `errorCode`/`recoveryHint`（router.ts:549-553）；ingestion 失败诊断降级（pipeline.ts:168，2 stage vs v1 4 stage + recovery_hint + last_error_at）；tags 不失效 sources 缓存（从不调 bumpSourcesEpoch，v1 每次都调）；extractors 响应形状偏离（`name` vs `type`，extractor 集合 readability/jina/firecrawl vs trafilatura/jina/firecrawl/browserless）；from-url 丢 `extractor` 参数和 `mode` 枚举校验
- **outputs**：fallback 用 `error.message` 作可见标题（pipeline.ts:385 vs v1 用 prompt）；postprocess 回填过浅（pipeline.ts:261-310 vs output_postprocess.py:102-189 嵌套回填）；`_postprocessed` 标记条件设 vs v1 无条件设（pipeline.ts:615-616 vs output_postprocess.py:377）
- **qa**：ContextStats `system_tokens` 恒 0（retrieve-and-judge.ts:118,265）；`max_tokens` 硬编码 8000 而非读配置（retrieve-and-judge.ts:108）
- **templates/prompt-presets**：builtin 保护缺失（templates/router.ts:89-118 不守 is_builtin）；trigger 唯一性/builtin 冲突检查缺失（prompt-presets/router.ts:62-101）

### 质量门禁（无代码改动，沿用第六轮基线）

- Server test: 257 pass / 0 fail
- Server typecheck: ✅ pass
- oxlint: 0 error（210 warnings 后置）
- SDD: 仅剩 c13/c14 active（BLOCKED 等人工授权）

### 建议下一步

**启动前后端本地开发模式联调实验**（`bun dev`），以运行时行为验证剩余 P1 的真实影响，并推进前端对 SSE + OutputRead + ErrorEnvelope + config_schema 契约的适配。代码层修复可在实验后按域批量处理（research/sources/outputs 各成一组）；2 个新 P0 建议优先修（隔离/dedup 正确性）。

---

**2026-07-13 第六轮：v1↔v2 差距审计后续 — 5 个 quick 修复 + c56 full SDD 提案/实现/归档。**

### 复核方法

承接第五轮差距审计报告的优先级 1+2（不含 c13/c14）。用 `llman-sdd-quick` skill 判定每项修复路径：无契约改动 → quick；违反既有 MUST → quick（补齐）；新增/改契约 → full SDD。c56 因 workspace `/tools/:id/config` 返回 config_schema 是 r20 MUST 契约改动，走 full SDD。

### 本会话产出

| 类型     | 内容                                                                                                                                           | 提交                  | 状态               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| quick    | **P1-12** server listen 默认绑 127.0.0.1（CL_SERVER_HOST env 覆盖；v1 `_DEFAULT_LISTEN_HOST` parity；c13 前网络安全守卫）                      | `26117fbf`            | ✅                 |
| quick    | **P0-1** `/finish` 报告写入竞态：abort 运行中 agent 后再 fire-and-forget 生成报告（复用 /cancel abort 模式；agent 不再覆写终态）               | `26117fbf`            | ✅                 |
| quick    | **P0-2** research SSE `search_result` 事件：executeSearches 每条结果插 `search_result` step；deriveNamedEvent 转发（对齐共享 schema union）    | `26117fbf`            | ✅                 |
| quick    | **P0-3** SSRF per-hop 重定向校验：`fetchWithRedirectGuard` 用 `redirect:'manual'` 逐跳 `validateUrlForFetch`（v1 trafilatura parity）          | `26117fbf`            | ✅                 |
| quick    | **P1-6** outputs export 引用子集：`collectCitedCitations` 遍历 content 树只列 cited chunks；markdown 行补 chunk/page/para（v1 api.py:452-461） | `26117fbf`            | ✅                 |
| full SDD | **c56** studio generation_config 真实解读 + workspace config_schema 契约落地（config.ts 移植 v1 195 行 + theme 6-key + preference→retrieval）  | `7e96d2f6`/`abdfb64c` | ✅ DONE + archived |

### c56 实现详情（已归档）

- **`packages/shared/schemas/studio.ts`**：+`SlideGenerationConfigSchema` +`ConfigOptionSchema` +`ThemePresetOptionSchema` +`SlidesConfigSchemaSchema`（PluginConfigSchema parity）
- **`apps/server/src/features/studio/config.ts`**（新文件 ~260 行）：逐字移植 v1 `slides/config.py` — `QUANTITY_RANGES`/`DENSITY_BULLETS`/`STRUCTURE_TEMPLATES`/`AUDIENCE_HINTS`/`TONE_HINTS`/`LANGUAGE_HINTS`/`THEME_PRESET_TEMPLATES`(6-key)/7 个 `*_OPTIONS` 列表/resolve 帮助函数/`buildSlidesConfigSchema()`/`resolveRetrievalTuning(preference)`
- **`theme-presets.ts`**（重写）：THEME_PRESETS 改用 v1 6-key 结构（theme 恒 `default` + colorSchema + fonts{sans,serif,mono} + transition + background + class）；`buildFrontmatter(preset, title?, override?)` 支持 override 绕过 preset + title 注入
- **`service.ts`**：`buildConfigHints` 移植 v1 requirement_lines（中文 + 区间展开，不再拼原始 token）；`generateOutline` 接入 config hints（此前完全不读）；`getContext` 读 preference 映射 topK/minScore（quality→12/0.1, speed→6/0.22, 无→8/0.2）
- **`workspace/router.ts`**：`/tools` SLIDES tool 加 `config_schema`；`/tools/:id/config` 返回完整 SlidesConfigSchema（r20/r21 parity）
- archive：+3 reqs 合并到 `workspace-api-contract`(+1) + `studio-slides-workflow`(+2)；`--skip-specs` 因 staleness base-ref 环境限制，delta 手动合并后 39/39 specs ✅

### 质量门禁

- Server test: **257 pass / 0 fail**（较第五轮 218→257，+39 新测试：8 redirect-guard + 7 citation-walker + 23 studio-config + 1 search_result step type）
- Server typecheck: **✅ pass**
- oxlint: **0 error**（210 warnings 后置；本会话修了 2 个预存 eqeqpack error 解锁 lint hook）
- SDD: c56 **archived**（+3 reqs 合并）；39/39 specs ✅
- 仅剩 c13/c14 active（BLOCKED 等人工授权）

---

**2026-07-13 第五轮：v1↔v2 差距深度审计 + quick-path 修复 + c54/c55 提案并实现+归档。**

### 复核方法

对照 `backend/py` SSOT 逐域审计端点（v1 82 / v2 118）、行为语义偏差与架构债，发现端点对齐已基本完成；真正残留集中在 3 类：① c13/c14 收尾（阻塞中）；② 几处行为偏差；③ 架构债。用 `llman-sdd-quick` skill 判定每项修复路径（quick vs full SDD），按 spec-defined MUST 违规分流。

### 本会话产出

| 类型     | 内容                                                                                                                                                   | 提交                  | 状态               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------ |
| quick    | `/finish` 同步→异步（v1 BackgroundTasks parity；report 后台 fire-and-forget）                                                                          | `0cc8c0b1`            | ✅                 |
| quick    | citation hydration 去重 → 共享 `hydrateCitations`（qa/refine/outputs；`HydrateOptions` 保行为一致）                                                    | `0cc8c0b1`            | ✅                 |
| quick    | PROGRESS 同步（移除 2 项已完成 stale 条目）+ 8 个预存 oxlint error 清零                                                                                | `0cc8c0b1`            | ✅                 |
| full SDD | **c54** 错误信封统一执行 + ContextStats→shared（+3 reqs；`shared/errors.ts` sendError+ErrorCode 映射；6 router 改造；`packages/shared/schemas/qa.ts`） | `3ac9f3a4`/`fdcc8808` | ✅ DONE + archived |
| full SDD | **c55** context-window 真实截断（+1 req；`truncateToTokenBudget` 移植 v1 `_truncate_blocks`；QA Step12 实际截断非仅标志）                              | `1b28adeb`/`8c6299ba` | ✅ DONE + archived |

### 质量门禁

- Server test: **218 pass / 1 fail**（research 网络 timeout，非回归，隔离通过；较上轮 209→218 +9 新测试）
- Server typecheck: **✅ pass**
- oxlint: **0 error**（修了 8 个预存 correctness error）
- SDD: c54 + c55 **archived**（+4 reqs 合并到 3 个 capability spec）；39/39 specs ✅
- 仅剩 c13/c14 active（BLOCKED 等人工授权）

---

**2026-07-12 第四轮深度复核 + c47–c53 提案 + c47/c48/c49/c50/c51/c52/c53 全部实现+归档。1 P0 (analysis relations) + 30×P1 (全部 7 域) 清零。第四轮完成。**

### 复核方法

派出 8 个并行 Explore agent 对照 `backend/py` SSOT 逐域复核 v2 实现，然后**亲自抽样验证 6 个最关键 P0/P1 声明**（全部属实）。核对 PROGRESS 多处标 ✅ 但 tasks over-reported 或 c45/c46 自陈 deferral 的真实情况。

### 核对结论

**原报告"已修复"中真正对齐的** ✅:

- refine (c29) 核心 citation-aware RAG 真对齐
- sources 同步 embedding 竞态 (G3 P0) 真修了（`pipeline.ts:144-157` await + ready-after-embed）
- source-connectors (G14) 实为**完整移植**（非"最小管线"）—— sync/snapshot/apply/import-scope 全在
- outputs OutputRead 契约/citation 树映射/RAG 失败传播 真对齐

**发现的真实偏离**: 1 P0 + ~20 P1 跨 7 域。

### 本会话产出

| Change  | 域                | 严重度 | 内容                                                                                                   | 状态               |
| ------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------ |
| **c47** | analysis          | **P0** | relations 回归 KNN（暴力cosine→searchVectors）+ score=1-distance + topics去ghost + RelationType→shared | ✅ DONE + archived |
| **c48** | qa                | 5×P1   | multiQuery确定性 + stats preset + ContextStats真token + export page/para + sources shape               | ✅ DONE + archived |
| **c49** | research          | 5×P1   | 跨迭代dedup + 双report 6段prompt统一 + SSE status/thinking + resume plan + note STRUCTURED             | ✅ DONE + archived |
| **c50** | outputs           | 4×P1   | SLIDES 400守卫 + source_id校验 + citation sanitize + LLM repair loop                                   | ✅ DONE + archived |
| **c51** | studio            | 5×P1   | serializeSlide字段 + SSE done·trace_id·toolcall + outputId FK + stale清理                              | ✅ DONE + archived |
| **c52** | models+sessions   | 5×P1   | providers envelope + provider过滤 + default顶层 + message_ids + convert文本                            | ✅ DONE + archived |
| **c53** | sources+citations | 6×P1   | qa-to-source多轮 + tag per-item + CSV转义 + citations路径BREAKING + connector校验                      | ✅ DONE + archived |

### c47 实现详情（P0，已归档）

- `correlation.ts` 重写：内存暴力 pairwise cosine → per-entry `searchVectors` KNN；`score = 1 - hit.distance`（v1 chroma 语义）；`Relation` 类型用 `@crystalith/shared` 的 `RelationType`
- `router.ts`：调用点改 `await detectRelations(entries, nid, db())`；移除 `chunk_ids:[]` 幽灵 topic 注入，改放 `narrative.topics`
- `test/analysis/correlation.test.ts` 重写为真实 DB 集成测试（用 `vec_chunks` 索引，6 测试全过）
- archive：+3 requirements 合并到 `knowledge-curation-and-freshness` spec

### c48 实现详情（5×P1，已归档）

- `retrieve-and-judge.ts`: `multiQuery: true` → `false`（确定性单 embed，对齐 v1 service.py:319-327）；ContextStats 改用 `countTokens`（gpt-tokenizer）真实计数 + `compressed = totalTokens > maxTokens`
- `presets.ts`: 新增 `stats` preset（STATS_SYSTEM_PROMPT verbatim 移植 v1 presets.py:59-66）+ StatsChart/StatsTable 类型 + `parseStatsPresetOutput`（v1 presets.py:67-83）
- `handler.ts`: `preset` 线程化；stats 路径在 generateQaDirect 与 streamQa 都实现（生成→parse→fallback_markdown 作答；流式按 240-char chunk，对齐 v1 api.py:457-504）
- `router.ts` export: citation 行补 page/para + Notebook ID 行；JSON sources meta 改 {source_id, source_name, mime_type, parser_type} + notebook-scoped + cited-but-deleted fallback + 顶层 notebook_id
- archive：+4 requirements 合并到 `generation-presets-and-constraints` (3) + `retrieval-and-cache` (1)

### 质量门禁

- Server test: **209 pass / 2 fail**（research 网络 + URL 超时，非回归，与基线一致）
- Server typecheck: **✅ pass**
- SDD: c47 + c48 **archived**（+7 reqs 合并）；c49–c53 提案 valid（0 failures）；validate-all → 55 passed / 0 failed
- 下一阶段: 逐个实现 c49–c53（无 inter-dependencies，可独立 apply）

### GAP-BOARD 更新

- analysis relations P0（PROGRESS 长期标注"第三轮仍有 relations P0"）由 c47 清零
- c46 "未做"区的 5 项（export note 类型/finish 后台/waiting 心跳等）正式追踪到 c49
- c45/c46 自陈 deferral 的 stats preset / ContextStats 真token 由 c48 清零
- 残留 P1 现分散在 c49–c53 正式追踪，不再是"后置项"

---

**2026-07-11 第三轮深度复核 + c42–c46 实现 + 验证审计 + QA 架构审查。全部 8 P0 清零，28/28 验证通过，7/7 HIGH 架构修复完成。**

### 复核方法

使用 ai-sdk + elysiajs 库 skill，派出 5 个并行 Explore agent 对照 `backend/py` 源码逐域复核。
发现 8 个 P0（用户可见契约断裂）+ 约 20 个 P1（行为实质偏离），按功能域分组为 5 个 SDD change。

### 本会话实现（c42–c46）

| Change  | 域               | P0 修复                                                                       | P1 修复                                                                                     |
| ------- | ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **c42** | Outputs          | POST 返回 OutputRead 契约；citations 递归映射进 content 树并持久化            | RAG 失败传播；字段级 postprocess；export citations 字段补全；错误码 503/422/400             |
| **c43** | Studio           | SSE 流式端点（outline/markdown stream）；getContext 接入 ragRegistry          | drafts/latest；stale-RUNNING 清理；preview 文件；generation_config 解释；frontmatter 确定性 |
| **c44** | Sources          | /search 接入真 web search（SearXNG）；/extractors 完整 ExtractorsListResponse | dedup 配置门控；re-embed 强制 FAILED；summary/QA 400+归属；connector 不可用 409             |
| **c45** | QA               | ContextStats 字段名对齐 v1（total_tokens 等 + compressed）                    | inline citation 兜底；low_similarity 空 citations；/prompt: 指令解析                        |
| **c46** | Parsers+Research | CSV 专用 parser（markdown-table 分块）                                        | report 6 段富 prompt；AI 失败 fallback；lock 续期；search dedup 增强                        |

### SDD 归档状态

c42–c46 已全部 archive（`llman sdd archive run`），spec deltas 合并到 11 个 capability specs（+31 requirements）。
39/39 specs 验证通过。c42–c46 不再出现在 active changes 列表中。

### 验证审计（3 个并行 Explore agent 对照源码逐项验证）

28 项验证中 25 项直接通过，3 项有偏差——**已全部修复**（commit `d3ffdd7c`）：

| 偏差                                                          | 严重度 | 修复                                                                                 |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| MINDMAP fallback 用 `title` 而非 v1 的 `label` 键（渲染 bug） | 中     | 改为 `label`；完整重写 fallback 对齐 v1 `output_graph.py:198-287`                    |
| Fallback 缺 `citations:[]` + 用 raw errorMsg                  | 中     | 所有叶子加 `citations: []`；用友好提示 `"⚠️ AI 模型生成失败..."`                     |
| 错误码用字符串匹配（fragile）                                 | 中     | 改用 AI SDK typed exceptions（`TypeValidationError`→422, `NoSuchModelError`→503 等） |
| CSV 缺 `csv_row_start/end` metadata                           | 低     | parser 返回 `pages[]`；pipeline 优先用 pages 而非 `chunkText`                        |
| `/prompt:` regex 大小写不一致                                 | 低     | 对齐 v1: `[a-z0-9_-]{1,32}` + case-insensitive + `toLowerCase()`                     |

### QA 架构审查（cl-codebase-cleanup skill + 3 个并行 Explore agent）

使用 cl-codebase-cleanup skill 的 7 类代码债务框架审查 c42–c46 新代码。
发现 7 个 HIGH + 12 个 MEDIUM + 18 个 LOW——**7 个 HIGH 已全部修复**（commit `2fa63263`）：

| #   | 问题                                                   | 严重度 | 修复                                                                            | 新模块                        |
| --- | ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------- | ----------------------------- |
| H1  | `/search` 不传 host → 永远返回空结果（**功能 bug**）   | HIGH   | `searchWeb` 默认调 `getSearxngHost()`；`webSearchTool.execute` 委托 `searchWeb` | `web-search.ts`               |
| H2  | extractors 硬编码在 router + 读错配置源(env vs config) | HIGH   | `listExtractorMetadata()` 在 factory.ts，用 extractor 的 `isAvailable(config)`  | `factory.ts`                  |
| H3  | connector 409 抛 plain object 非 Error                 | HIGH   | `ConnectorUnavailableError extends Error`                                       | `source-connectors/router.ts` |
| H4  | agent.ts ↔ router.ts 循环依赖                          | HIGH   | lock 函数提取到独立模块                                                         | **`research/lock.ts`**        |
| H5  | 两个 SSE 端点 ~90% 重复                                | HIGH   | `createSseResponse()` 共享 headers/busy guard/error handling                    | **`studio/service.ts`**       |
| H6  | POST 与 SSE 重复生成逻辑                               | HIGH   | `generateOutline()`/`generateMarkdown()` 共享核心；router 643→~190 行           | `studio/service.ts`           |
| H7  | non-streaming /qa 生成 SSE 再解析回来（脆弱）          | HIGH   | `generateQaDirect()` 用 `generateText` 直接返回                                 | `qa/handler.ts`               |

**MEDIUM 未修（可后置）**：citation hydration 重复 3 处；ContextStats 未定义在 shared；错误 envelope 不一致；streamNoEvidence 不走 ensureInlineCitations；dedup 块重复；batch re-embed 跳过 FAILED 门控；SLIDES 缺 postprocess case。

### 仍开放（后置项）

> 2026-07-13 第五轮更新：c54/c55 + quick-path 修复全部落地，已知问题清单大幅缩减。

- ✅ **已完成（本会话）**：~~context window 压缩~~ → **c55** DONE（QA Step12 真实截断）；~~错误 envelope 不统一~~ → **c54** DONE（sendError helper + 6 router）；~~`/finish` 同步阻塞~~ → quick DONE（异步 fire-and-forget）；~~citation hydration 去重~~ → quick DONE（`hydrateCitations` 共享）；~~ContextStats→shared~~ → **c54** DONE（`packages/shared/schemas/qa.ts`）
- ✅ **历史已完成（核对确认）**：~~stats preset~~ c48；~~export note STRUCTURED~~ c49；~~waiting SSE 心跳~~ c37
- **仍开放 P1/P2**：SLIDES postprocess case；audio/video parsers；plugin host；ToolLoopAgent 迁移；batch DELETE 方法（BREAKING，留 c14）
- **阻塞中**：c13/c14 等人授权；web typecheck；`api/generated/` → c14

**当前状态**:

- Server test: **218 pass / 1 fail**（research 网络 timeout，非回归；隔离通过）
- Server typecheck: **✅ pass**
- oxlint: **0 error**（correctness rules；214 warnings 后置）
- SDD: c54 + c55 **archived**（+4 reqs 合并），39/39 specs ✅
- 仅剩 c13/c14 active（BLOCKED 等人工授权）
- 下一阶段建议: c13 授权（单二进制 + Tauri）；前端适配 SSE + OutputRead/ErrorEnvelope 契约；SLIDES postprocess；P2 架构债

### GAP-BOARD 更新

- 全部 8 个 P0 已清零（c42–c46）
- P1 已全部清零：~~stats preset~~ c48 / ~~export note~~ c49 / ~~waiting 心跳~~ c37 / ~~context compression~~ c55 / ~~error envelope~~ c54 / ~~/finish 异步~~ quick / ~~citation hydration 去重~~ quick
- G14 source-connectors：最小可用管线 + c44 补充 409/schema 校验
- 残留仅 P2（SLIDES postprocess / audio-video parsers / plugin host / ToolLoopAgent）+ c13/c14 阻塞

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
> c42–c46 已 archived，验证审计 28/28 通过（含修复）。

| 上次 Agent | 第八轮 c57–c62 change 化 + 全部实现（2 P0 + ~18 P1 清零，准备联调） |
| 上次操作 | **SDD propose + apply**: c57–c62 共 6 个 change 全部实现并 commit（b3e911bd/dd2677f7/06aa6724/c59487af/5660e928/4c291e68）。**+24 新测试**（c57×3/c58×4/c59×10/c60×4/c62×3）。Server 281 pass / 0 fail。 |
| 开放决策 | (1) **启动 bun dev 联调**（所有 P0/P1 清零，核心流水线稳定）。(2) **前端适配**: sources `?notebook_id=` query；extractors 新字段；SSE/OutputRead/ErrorEnvelope/config_schema 契约。(3) 联调后逐个 archive c57–c62。(4) **plugins host 移出 v2 范围**（第七轮决策）。(5) **Auth**: 本地免鉴权 + 回环绑定（c13）。(6) **c13/c14 等人工授权**。 |
| 已知问题 | **🟡 P2 后置**: ToolLoopAgent 迁移；batch DELETE（BREAKING，留 c14）；research thinking 事件 taxonomy；research export include_results/metadata；studio/outputs SSE 字段名/toolcall 差异；outputs RAG multi-query 调优；research per-result iteration 溯源。(2 P0 + ~18 P1 已清零)。**🟡 阻塞**: c13/c14 等人授权；web typecheck；`api/generated/` → c14。 |
| 质量门禁 | `bun test` (server) → **281 pass / 0 fail**（+24 新测试）。`bun typecheck` (server) → ✅ pass。`bun oxlint` (server) → 0 error（web 预存 lint error 后置）。c57–c62 全部 validate ✅，待 archive。Active: c57–c62（待 archive）+ c13/c14。 |

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
