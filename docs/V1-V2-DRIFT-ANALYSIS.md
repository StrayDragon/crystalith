# v1 (Python) ↔ v2 (TypeScript) 实现深度对比分析报告

> 生成于 2026-07-09。目的：c13 (分发) / c14 (清理) 合并 PR 前的行为对齐审计。
> 方法：三个并行只读 agent 分别深挖 v1 AI 流水线 / v2 AI 流水线 / 数据+源+RAG，人工复核全部高风险结论（均附 `file:line`，关键 bug 已独立 grep 验证）。
> 范围：`backend/py/` (v1, FastAPI + pydantic-ai + ChromaDB) vs `apps/server/src/` (v2, Elysia + AI SDK + sqlite-vec)。

---

## TL;DR — 一句话结论

**数据层 100% 对齐（v2 是 v1 的严格超集），但行为层有显著漂移：v2 在 7 个 AI 域里有 5 个是"骨架就位、内核缺失"的实现——路由都在，但关键的检索/任务/多轮/引用逻辑要么是 stub、要么有 bug、要么根本没接线。** 其中 **3 个是会导致前端功能异常的真实缺陷**（必须 PR 前修），其余是功能缺口（可记为后续 change，但需明确决策）。

> 注：之前 `7daa9ca0 fix: v1→v2 对照补漏` 做的是**路由/endpoint 层**对齐（v2 ≥ v1 82 endpoints）。本次是**实现层**对齐——发现 endpoint 都在 ≠ 行为一致。

---

## 🔴 P0 — 真实缺陷（建议 PR 前修，否则前端功能异常）

### P0-1. QA 引用永远为空（引用映射 bug）

**现象**：`POST /v2/qa` 和 `/qa/stream` 返回的 `citations` 永远是 `[]`。

**根因**：`features/qa/handler.ts:94` 声明 `const retrievedChunks = []`，但内联 `retrieveSources` 工具的 `execute` 返回结果后**没有任何代码把结果 push 进 retrievedChunks**。`citationsResolver: () => resolveCitations(retrievedChunks)`（`handler.ts:113`）拿到的是空数组。

**验证**：已 grep 确认 `retrievedChunks` 在 `handler.ts` 内只有声明、无写入点。

**影响**：前端问答界面无法显示"证据来源/引用块"——这是 Crystalith 的核心 RAG 卖点。v1 的 `service.py:79` 有完整的引用解析 + 置信度计算。

**对照 v1**：v1 `qa/service.py:274` 的 `run_qa_pipeline` 把检索到的 chunk 完整映射成 `Citation{source_id, source_name, chunk_id, chunk_index(1-based), page_number, snippet[:200], score}`。

**修复方向**：要么在 `streamQaResponse` 的 fullStream 里捕获 tool 结果回填 `retrievedChunks`，要么复用已存在但**未被导入**的 `ai/tools/retrieve-sources.ts:28`（它正确 hydrate 了 `source_name`）。

---

### P0-2. `tasks` 表从未被写入（任务系统是死表）

**现象**：`tasks` 表（`db/schema.ts:459`）存在，`GET /v2/tasks/:id` 和 `/cancel` 能读，但**全代码库没有任何 `insert(tasks)`**（已 grep `features/` 和 `src/` 全空）。

**影响**：

- refine / outputs / research / 源摄取都是**同步执行**，不创建任务记录。
- 前端如果有"任务进度轮询"逻辑（`GET /v2/tasks/:id`），永远查不到任务→要么一直空转、要么报 404。
- `tasks.type` 枚举是 `['refine','document_parse']`，但 refine 是同步返回、document_parse（源摄取）是 fire-and-forget，都不写表。

**对照 v1**：v1 有完整 `TaskQueue`（`features/tasks/queue.py:184`，PriorityQueue + semaphore，并发 3）+ `_execute_refine` worker（`worker.py`）。`POST /refine` 是"入队 → wait_for_completion → 返回"，409 on CANCELLED。

**决策点**：v2 是否要任务系统？若要，需在 refine/摄取处补 `insert(tasks)` + 状态机；若不要，应删 `tasks` 表和 `/tasks` 路由避免误导。这是**架构决策**，不是简单 bug。

---

### P0-3. RAG min_score 过滤方向反转 + 默认不过滤

**现象**：`rag/embed-strategy.ts:72` `minScore` 默认 `0`，过滤条件是 `h.distance >= minScore`。

**根因**：sqlite-vec 返回的 `distance` 是**距离**（0=相同，越大越远）。v2 直接拿距离当分数比 `>=`：

- 默认 `minScore=0` → `distance >= 0` 恒真 → **完全不过滤**，top_k 里全是低相关结果。
- 若传非零 minScore → 方向反了（距离越小越好，应该是 `distance <= threshold`）。

**对照 v1**：v1 `chroma.py:136` 把距离转成 `score = 1 - distance`（相似度，越大越好），再 `score >= min_score(0.2)`。语义正确。

**影响**：检索质量劣化——要么噪声过多（默认），要么过滤反逻辑。这是所有依赖 EmbedStrategy 的域（QA/outputs/refine/analysis）的共同地基问题。

**修复**：在 `embed-strategy.ts` 把 distance→similarity 转换补上（`score = 1 - distance`），过滤改 `score >= minScore`，默认 `minScore=0.2` 对齐 v1。

---

## 🟡 P1 — 功能缺口（需明确"做或不做"的决策）

### P1-1. QA 硬编码 EmbedStrategy，忽略 per-notebook RAG 策略

**现象**：`features/qa/handler.ts:11,31` 直接 `new EmbedStrategy()`，不经过 `ragRegistry`。

**影响**：用户在 `POST /notebooks/:id/strategies` 配的 hybrid/keyword/page-index 策略**对 QA 完全失效**。`QaStreamRequestSchema` 里声明了 `strategy_id` 字段但从不读取。

**讽刺点**：v2 花力气建了 4 个策略 + registry + per-notebook 配置（这是 v1 没有的新能力），但核心消费方（QA）绕过了它。

---

### P1-2. Research 多轮循环、SSE 进度、HITL 全是空壳

**现象**（`features/research/router.ts`）：

- **无多轮**：`runResearchAgent`（`:239`）单次 `streamText`，**没传 `maxSteps`/`stopWhen`**（注释 `:11` 说有，grep 证实代码里没有）。`currentIteration`/`aggregatedResults`/`researchSteps` 表从不写入。
- **无 SSE 进度**：没有 `/research/:id/stream` 端点。`asyncapi.ts` 和 `shared/research-progress.ts` 定义了完整事件契约（plan_ready/search_result/analysis/thinking…），但无人实现。进度只能轮询 `GET /:id`。
- **HITL 是状态标志 no-op**：approve/modify/skip/finish 只改 DB status，**不中断/不门控**运行中的 agent（无 AbortController）。cancel 改 status 但后台 streamText 继续。
- **路由/文档不符**：OpenAPI 写 `/stop`（`router.ts:58`），实际注册 `/cancel`（`router.ts:172`）。

**对照 v1**：v1 是完整的 pydantic-graph 状态机（5 节点，`graph.py:877`），`WaitForApproval` 轮询 DB 10 分钟，`AnalyzeResults` 的 `need_more_search AND iteration < max_iterations` 控制循环，DB-polling SSE（1s/3600 次/30s heartbeat），锁管理（`LOCK_TIMEOUT=600s`）。

**决策点**：v2 要不要复刻 v1 的完整研究 agent？这是 Crystalith 最复杂的功能（v1 ~2500 行）。当前 v2 ~400 行只是"单轮 streamText + webSearch 工具"。

---

### P1-3. 源去重（dedup）整个缺失

**现象**：`sources.dedup_key` 列存在但**从不计算/写入**。无 `dedup_action` 参数，无 409 路径。

**对照 v1**：v1 upload 算 `upload:sha256:<sha256(raw)>`，url 算 `url:sha256:<canonical_url>`，支持 `dedup_action=prompt(409)/reuse(200)/create_new`，由 `source_ingestion.dedup.enabled`（默认 False）开关。

**影响**：重复上传不拦截，存储膨胀；前端收不到 409 提示。

---

### P1-4. 分块参数漂移（影响检索召回）

| 参数       | v1                                   | v2                                    | 说明                                                                         |
| ---------- | ------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| chunk_size | **800**（`chunker.py:17`，滑动窗口） | **500**（`pipeline.ts:99`，段落切分） | 边界不同→召回不同                                                            |
| overlap    | **100**                              | **0**（无 overlap）                   | v2 `rag/chunker.ts:16` 有 overlap=50 的版本但是**死代码**（pipeline 不导入） |

---

### P1-5. 检索缓存（EpochCache）是死代码

**现象**：`rag/cache.ts` 的 `EpochCache` 类存在，但**全代码库零调用点**（已 grep 确认）。`bump_vector_epoch` 等失效逻辑也无。

**对照 v1**：v1 有双层缓存——vector search 缓存 + assembly 缓存（key 含 sources_epoch + vector_epoch），可 env 开关。

---

### P1-6. 其他较小但应记录的缺口

| 项                                | v1                                                      | v2                                                                                | 严重度                             |
| --------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| 多查询扩展（multi-query）         | 有（`context.py:168`，按 output_type 生成 query seeds） | 无                                                                                | 中（召回降级）                     |
| 检索去重+多样性                   | 有（sha256 去重 + `max_chunks_per_source`）             | 无                                                                                | 中                                 |
| token 预算截断                    | 有（按 context_window.max_tokens × ratio）              | 无（outputs/studio/analysis 用 `.substring(0,N)` 字符截断）                       | 中                                 |
| chunk_id 复用路径                 | 有（显式 chunk_ids 直查）                               | 无                                                                                | 低                                 |
| 检索 stats/timings                | 有（完整 timings_ms）                                   | 无                                                                                | 低（可观测性）                     |
| Output 类型完整度                 | 10 种全支持                                             | 7 种有 generator；**PARAGRAPH/BULLETS/STRUCTURED 会 throw "Unknown output type"** | 中（3 种类型不可用）               |
| Output convert-to-source          | 会 embed+向量化新 chunk                                 | **不 embed**（`router.ts:153`，转换后语义检索找不到）                             | 中                                 |
| Studio 两阶段（outline→markdown） | 有（独立 SSE + HITL）                                   | 无（直接出 markdown，`stage:'outline'` 只是标签）                                 | 中                                 |
| Studio 主题                       | 6 预设（frontmatter 确定性重建）                        | 硬编码 `seriph`                                                                   | 低                                 |
| `crystalith-slidev` 包            | n/a                                                     | **git 追踪 0 文件**（空壳，前端 `@crystalith-slidev` import 会断）                | 中（前端构建）                     |
| AI 可观测性                       | retry + extract_effective_model_settings 日志           | 仅 retry（`middleware.ts`），无 usage/cost/latency 采集                           | 低                                 |
| tokenizer                         | 用于 context 截断                                       | `ai/tokenizer.ts` 存在但**无人导入**，且用 `require()`（ESM 下会崩）              | 低（死代码）                       |
| `/from-url` SSRF 防护             | 有（`validate_url_for_fetch`）                          | 无（裸 `fetch(url)`）                                                             | 中（安全）                         |
| 上传大小限制                      | 有（`upload_max_bytes`→413）                            | 无                                                                                | 中（安全）                         |
| 源摄取错误码粒度                  | 8 种 typed error_code                                   | 1 种 `PARSE_ERROR`                                                                | 低                                 |
| 音频/视频/YouTube/转录            | 有（plugin）                                            | 无                                                                                | 低（桌面场景少见）                 |
| CSV/markdown 预处理               | 有                                                      | 无                                                                                | 低                                 |
| 源摄取 readiness 语义             | 解析+嵌入+向量化全完成才 READY                          | 先标 READY，嵌入 fire-and-forget                                                  | 中（前端可能查到"ready 但检索空"） |

---

## ✅ v2 正确对齐 / 反而优于 v1 的部分

1. **数据层 100% 对齐**：v1 全部 16 张表、所有列、唯一约束、复合主键、索引、枚举值，在 v2 Drizzle schema 里逐字保留。v2 还新增 4 张 eval 表 + `strategy_configs`。无任何缺失列/约束。
2. **RAG 策略多样性（v2 新增）**：v2 有 keyword(BM25/FTS5)、true hybrid(embed+BM25 RRF k=60)、page-index——这些 v1 **完全没有**。v1 只有 embed 一种策略（+ 多查询融合）。
3. **per-notebook 策略配置（v2 新增）**：`strategy_configs` 表 + `/strategies` API。
4. **Eval harness（v2 新增）**：4 张表 + `features/eval/*`，v1 无。
5. **向量原生分区（v2 更优）**：sqlite-vec 按 notebook+source 分区，比 v1 Chroma 单 collection + metadata 过滤更高效。
6. **Provider registry 动态 import（v2 更优）**：无 switch-case，config 驱动。
7. **AI SDK 集成**：streamText/generateObject + Zod，类型安全优于 v1 pydantic-ai。

---

## 🔵 死代码 / 重复实现（清理候选，归 c14）

1. `ai/generate-output.ts`（98 行）——比 `features/outputs/generator.ts` 更完整的并行实现，**无任何 router 导入**。
2. `ai/tools/retrieve-sources.ts` + `ai/tools/web-search.ts`——正确 hydrate source_name 的工具工厂，**未被导入**（QA/research 各自内联了简化版）。
3. `rag/chunker.ts` 的 `chunkText(overlap=50)`——pipeline 不用它，用了自己的 `chunkSimple`。
4. `rag/cache.ts` 的 `EpochCache`——零调用点。
5. `ai/tokenizer.ts`——零导入点，且 `require()` 在 ESM 危险。

> 这 5 处共同特征：**"更完整的版本存在但没接线，实际跑的是简化版"**。强烈怀疑是中途重构未完成。c14 清理时需逐个判断：接线升级 vs 删除。

---

## 给决策者的建议（不替你决定，只给框架）

**PR 合并前的最小修复（P0，3 项）**：

- P0-1 QA 引用空：接线 retrievedChunks 或导入 `ai/tools/retrieve-sources.ts`。**1-2 小时**。
- P0-3 minScore 方向反转：`embed-strategy.ts` 加 distance→similarity 转换 + 默认 0.2。**30 分钟**。
- P0-2 tasks 表：这个是**决策**——要么补写入（中等工作量），要么删表+路由。建议先和用户确认。

**可记为后续 change 的（P1）**：

- Research 完整 agent（最大块，建议独立 change）
- dedup 子系统、extractor 策略、multi-query、token 预算（检索增强，可合一个 change）
- Studio 两阶段 + slidev 包（前端依赖，独立 change）

**归 c14 清理的**：5 处死代码。

---

## 验证附录

本报告所有"bug/死代码"结论均经独立 grep 复核：

- QA `retrievedChunks` 无写入：✅ `handler.ts` 内仅声明
- `insert(tasks)` 全库无：✅ `features/` + `src/` grep 空
- `minScore >= distance`：✅ `embed-strategy.ts:72` + `vectors.ts` 返回 distance
- research `maxSteps`/`researchSteps`：✅ router 内仅注释，无代码
- `EpochCache` 零调用：✅ grep 全空
- `/stop` vs `/cancel`：✅ doc `:58` vs route `:172`
- `crystalith-slidev` 0 文件：✅ `git ls-files` 0
- OUTPUT_META 缺 3 类型：✅ 仅 7 个 key
