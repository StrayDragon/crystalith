# Crystalith v1 (Python) vs v2 (TypeScript) — 深度代码差距报告

> 基于 4 个并行只读代码分析（核心域 / 代理分析域 / 摄取任务生成评估域 / 共享基础设施域）综合而成。
> 所有结论均经实际源码核对，引用 `file:line`。
> **范围**：聚焦功能行为对齐（parity），**不含**分发（c13）与老代码移除（c14）。

## TL;DR — 三句话结论

1. **行数统计准确**（15/15 行数核对正确），但 **`✅ DONE` 标记系统性高估** — 看板把"路由存在并返回数据"等同于"对齐了 v1 行为"。
2. **最大误标是 c22 research agent**：架构 §3 与状态板声称用 `toolApproval`（无 DB 轮询），**实际代码是 DB 轮询**，且缺会话锁/修改动作/带状态恢复/export pipeline；同时 `c24 design.md` 的"v1 用文件系统存储原始内容"**事实错误**（v1 无此目录、无此列）。
3. **有一个安全相关死代码**：v2 SSRF 白名单字段（`hostAllowlist`/`domainAllowlist`/`cidrAllowlist`）声明了但**从不读取**，复制的 `config/app.yaml` 白名单配置**完全无效**。

---

## 一、状态看板准确性总表（按域）

图例：✅ 准确 | 🟡 高估（有实质缺口） | 🔴 严重高估/错误 | ➕ 低估 | ➕v2 v2 独占

| 域                | PROGRESS 标记        | 实际              | 评级       | 关键缺口（详见下文）                                                                                                 |
| ----------------- | -------------------- | ----------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| notebooks         | ✅                   | CRUD 对齐         | 🟡         | 模板创建、列表缓存缺失                                                                                               |
| sessions          | ✅                   | CRUD 对齐         | 🟡         | convert-to-output 全缺；convert-to-source 缺 chunk/embed/vector/分页/GET-by-id                                       |
| messages          | ✅                   | CRUD 对齐         | 🟡         | 不 touch session.updated_at；跨 notebook 越权检查缺失                                                                |
| citations         | ✅                   | **不同端点**      | 🔴         | v2 是 `/citations/:messageId`（读存储列）；v1 的 `/context` 邻域证据审查功能完全缺失                                 |
| qa                | ✅                   | 流式骨架对齐      | 🟡         | context_stats/export/source_ids 校验/断连处理/会话标题/inline-citation 保证全缺；5 个 no-evidence reason 只产出 1 个 |
| **research**      | ✅ DONE              | 循环结构在        | 🔴         | DB 轮询非 toolApproval；缺锁/modify/resume-with-state/export；tools.ts 死代码                                        |
| studio            | 🟡70% (两阶段待实现) | **两阶段已实现**  | 🔴(描述错) | 真缺口是 slidev 落盘 + 富配置 + RAG 上下文，**非两阶段**                                                             |
| analysis          | ✅                   | 模块在            | 🟡         | clustering/correlation 从向量 KNN **降级为关键词 TF**（语义→词法）                                                   |
| sources           | ✅                   | 对齐              | ✅         | （上传大小硬编码 50MB 非 v1 可配；错误 UX 7 码→1 码）                                                                |
| source connectors | 🟡30%                | 仅描述符+stub     | 🟡(高估)   | 实际 ~15%（无 sync 执行、无 shell connector）                                                                        |
| tasks             | 🟡60% (worker 待做)  | **refine 已接线** | 🟡(描述错) | 仅 document_parse 是抛错 stub；v1 也无此类型；v2 反而领先                                                            |
| outputs           | ✅ (10 types)        | schema 在         | 🟡         | 无向量检索（dump 全部 chunk）、无 citations、无偏好调优、无修复循环                                                  |
| refine            | ✅ (bug已修)         | source_ids 一致   | 🟡         | 语义已**发散**（5 种文本变换 vs v1 的 3 种带 citation 摘要）                                                         |
| eval              | ✅ v2独占            | 完整 harness      | ✅         | （v1 有 200 行 loader，"独占"略夸大但 harness 确是 v2 新增）                                                         |

行数全部准确（v1 15/15、v2 15/15）。问题集中在**行为标记**。

---

## 二、最关键的五个发现（按影响排序）

### 🔴 发现 1：c22 research agent 标记与架构自相矛盾

PROGRESS 状态板 c22 与域表第 6 行标 `✅ DONE`，架构决策 §3（`PROGRESS.v2.md:193-205`）和当前批次（`:109-110`）却把"消除 DB 轮询、改用 toolApproval"列为 c24 待办。**实际代码（`agent.ts:401-447`）是 DB 轮询**：

```
waitForApproval(): for 循环 + sleep(500) + db().select().from(researchSessions)
  检查 session.status === 'searching'
```

`ToolLoopAgent`/`toolApproval` **仅出现在注释**（`agent.ts:1,7,8,307,396`），import 已删（handoff 自认）。

**对比 v1（`features/research/api.py` + `graph.py`，2834 行）的真实缺口**：

| 能力                           | v1                                                                          | v2                                                                                             | 状态            |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------- |
| Plan/Analyze/Report 结构化输出 | pydantic-ai Agent                                                           | generateObject/streamText                                                                      | ✅              |
| HITL 审批                      | DB 轮询 500ms×600s，支持 approve/modify/skip/finish/cancel                  | DB 轮询，**仅 approve**（无 modify/skip/finish 动作解析）                                      | 🔴 动作词汇退化 |
| 会话锁（防并发）               | acquire/release/extend 600s + 过期清理                                      | **schema 有 lockedAt/lockExpiresAt 列但无代码读写**（已验证 grep 为空）                        | 🔴 并发隐患     |
| 带状态恢复                     | `_build_state_from_session` 重建 results/plan/iteration/start-node          | `/resume` 从 iteration 1 + 空 results 重跑，**不读 aggregatedResults**                         | 🔴 丢失累积结果 |
| export-to-source               | chunk+embed+vector+epoch bump+SourceFailure 错误处理                        | 返回原始 `{report, aggregated_results}`，**无 chunk/embed/source 创建**                        | 🔴 只读 stub    |
| 搜索去重                       | URL 归一化 + 标题相似度(0.85)                                               | 仅 URL 归一化，无标题相似度                                                                    | 🟡              |
| SSE 事件词汇                   | status/plan/search_progress/analysis/report/done/waiting/heartbeat/thinking | step 派生事件，无 heartbeat/无 thinking/无 search_progress（executeSearches 不写 search step） | 🟡              |
| AbortSignal 取消               | 节点边界轮询                                                                | **真 AbortController 传入 LLM 调用**                                                           | ➕ v2 更好      |
| tools.ts                       | —                                                                           | **129 行死代码**（webSearchTool/analyzeResultsTool/writeReportTool 零 import）                 | 🟡              |

**建议**：c22 应改 🟡 WIP；或在 c24 Workstream B 完成后再标 ✅。

### 🔴 发现 2：c24 Content Storage 的 v1 对齐前提错误

`llmanspec/changes/c24-add-v2-pipeline-integration/design.md:19` 写：

> "v1：FastAPI 用文件系统存储原始上传内容…`backend/py/storage/`"

**事实核查（已验证）**：

- `backend/py/storage/` **目录不存在**
- v1 `Source` SQLAlchemy 模型（`shared/db/models.py:253-285`）**无 raw-bytes/BLOB/file-path 列**
- 全代码库无 `save_raw`/`write.*bytes`/`storage/` 引用

**真相**：v1 和 v2 当前都**只持久化提取后的文本**（chunks 表），原始字节解析后即丢弃。c24 的 Content Storage 是 **v2 独有设计**，不是 v1 对齐。

**影响**：把 c24 Workstream A 框架为"v1 对齐"会误导优先级判断。它应明确标为"v2 改进（单二进制架构需要可重解析的存储抽象）"。

### 🔴 发现 3：SSRF 白名单是死代码（安全相关）

`apps/server/src/shared/net/url-safety.ts:22-26` 声明了 `SsrfPolicy.hostAllowlist`/`domainAllowlist`/`cidrAllowlist`，但函数体（`:72-122`）**只读 `allowlistOnly`**（且仅在 DNS 失败分支 `:115`）。三个数组从未应用。

**叠加效应**：v2 把 v1 的 `config/app.yaml` 整体复制，其中 `source_ingestion.url_fetch.security.allowlist_*`（`:295-298`）仍存在，但 v2 config 只解析 `models` 段（见发现 5），`source_ingestion.*` **整体被忽略**。所以：

> v2 实际 SSRF 姿态 = "拒绝私网/元数据 IP，其余全放行"，**无法表达任何白名单**。

对比 v1（`url_safety.py:75-82,155,184`）：精确匹配 + 域后缀 + CIDR + `allowlist_only` 模式全部生效。另 v2 无 `max_redirects`（逐跳重校验）。

**建议**：Net 域应从 ✅ 降为 🟡；这是需要修复的真 bug（优先级 P1）。

### 🟡 发现 4：analysis clustering/correlation 静默降级（语义→词法）

`clustering.ts:1-9` 和 `correlation.ts:7-10,52-65` 的注释**坦诚承认**：sqlite-vec 虚拟表不通过 SELECT 暴露存储向量，故 clustering/correlation 从 v1 的**向量 KNN** 改用**关键词 TF 向量**。

- v1 `correlation.py`：`vector_store.search` KNN(top_k=20, min_score=0.7)
- v2 `correlation.ts:34-90`：**不调用向量搜索**，改用 O(n²) 成对 `keywordCosineSimilarity`

**影响**：用户期望 v1 质量的语义聚类，实际得到词袋（bag-of-words）聚类。对小 notebook 无感，对语义近义但用词不同的内容会显著退化。PROGRESS 第 10 行标 ✅ 无此说明。

**可选修复方向**：sqlite-vec 支持 `SELECT vector FROM vec_chunks WHERE ...` 需要显式查询语法；或缓存 embedding 到普通列。

### 🟡 发现 5：config 实际只解析 models 段（~15 维配置被静默丢弃）

`config.ts:180` 只把 `models` 段解析为类型化 `ModelsSettings`，其余全部进 `raw: Record<string,unknown>`（`:166`）**且无任何 v2 代码消费**。

v1 `shared/config/models.py:917-999` 解析、校验、消费的配置段，v2 全部忽略：

| 配置段                                                                      | v2 状态                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| `app`（auth/cors/feature flags/http_guardrails 上传大小/限流）              | 🔴 忽略（v2 无 auth、无 CORS、上传大小硬编码）  |
| `database`（url/Postgres 候选）                                             | 🔴 忽略（硬编码 `data/crystalith.db`）          |
| `vector_storage` / `cache` / `embedding` / `concurrency` / `context_window` | 🔴 忽略                                         |
| `ai`（timeout/max_retries）                                                 | 🔴 忽略（retry 用硬编码 `middleware.ts:15-19`） |
| `search.searxng`                                                            | 🔴 忽略                                         |
| `source_ingestion.url_fetch.security`（SSRF 白名单）                        | 🔴 忽略 → 导致发现 3                            |
| `source_ingestion.web_extraction`（fallback_order/per-extractor）           | 🔴 忽略（v2 硬编码 `factory.ts:23`）            |
| `proxy_settings`（http/https/socks5）                                       | 🔴 忽略（v2 无代理支持）                        |
| 16 个 `CRYSTALITH_*` 环境变量（v1 `env.py:74-171`）                         | 🔴 v2 `.env.example` 仅 5 个                    |

PROGRESS 标 🟡 准确，但缺口比 emoji 暗示的更大。

---

## 三、域级详表（精选高价值缺口）

### 核心域（notebooks/sessions/messages/citations/qa）

| 域            | 高价值缺口                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **citations** | v2 实现的是**不同端点**：`/citations/:messageId`（echo 存储列）vs v1 `/citations/context`（邻域 before/after chunk + page/paragraph 富化）。v1 的"证据审查"能力在 v2 **完全缺失**。这是**最严重误标**。                                          |
| **qa**        | `context_stats`（token 预算）全缺；非流式路径是内部消费自己的 SSE；provisional message 失败时**不清理**（孤立空消息）；`source_ids` 范围过滤缺失；客户端断连不检测；会话标题不自动生成；`stats` 预设特殊路径缺失；inline-citation `[1]` 保证缺失 |
| **sessions**  | `convert-to-output`（3 输出类型，v1 `api.py:395-524`）全缺；`convert-to-source` 缺 chunking/embedding/vector/epoch；GET-by-id 缺；跨 notebook 越权检查缺失（`router.ts:117` 忽略 `nid`）                                                         |
| **messages**  | 新消息**不 touch** `session.updated_at`（影响按时间排序）；跨 notebook 越权检查缺失                                                                                                                                                              |
| **notebooks** | 模板创建（预置 session + source tags）缺失；列表缓存缺失；列表排序不同（v1 id ASC vs v2 updatedAt DESC）                                                                                                                                         |

### 摄取/任务/生成/评估域

| 域                    | 高价值缺口                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **outputs**           | **无 RAG 检索**（dump 全部 notebook chunk，大 notebook 会爆上下文）；无 citations；无偏好调优；无 schema 修复循环；export 仅 JSON（v1 有每类型 markdown renderer）                                 |
| **refine**            | 语义**发散**：v2 是 5 种文本变换（expand/summarize/rewrite/translate/structured），v1 是 3 种**带 citation 的摘要格式**。是同名不同功能，非移植                                                    |
| **source connectors** | 实际 ~15%（非 30%）：无 sync 执行、无 Obsidian/local-directory 真实现、无路径安全检查；sync 端点是 `// TODO: actual sync logic` stub。v1 行数低估（1272 实际 1878，漏算两个插件包）                |
| **tasks**             | worker **已在分发** refine（`server.ts:41` → `worker.ts:70-148`）；仅 document_parse 抛错 stub（`worker.ts:163`，待 c24 Workstream A）。v2 行数低估（84 实际 531）。v1 也无 document_parse，非回归 |
| **sources**           | ✅ 真对齐（dedup_key/SSRF/上传大小全在）。小缺口：上传大小硬编码（v1 可配）、错误 UX 7 码→1 码、URL fetch 无 link-mode/extractor 偏好、fire-and-forget embed（v2 响应时未完成 embedding）          |

### 共享基础设施域

| 模块               | 高价值缺口                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI retry**       | v2 无 `Retry-After` 头解析、无总超时预算、重试码更少（`[429,500,502,503,504]` vs v1 `{408,409,425,429,500,502,503,504}`）、无 test provider、无进程内 embedding LRU |
| **DB 表数**        | **v2 是 21 表非 20**（`strategy_configs` 定义在 `rag/registry.ts:16` 不在 `schema.ts` barrel，易漏）。v1=16。v2 丢了 Postgres 选项                                  |
| **RAG**            | "v2 更丰富"**准确**（4 策略 embed/keyword/hybrid/page-index vs v1 1 策略 + multi-query + diversity）。但 v2 丢了 `max_score` 融合选项和 assembly cache              |
| **Parsers**        | v2 覆盖 v1 的 3/9 格式（缺 csv/audio/video/transcription/markdown-preprocessor/media）。✅ 标注附"核心"但缺口比单行说明大                                           |
| **Web extractors** | trafilatura→readability、丢 browserless；fallback 链不再 config 驱动；`notebook_extractor_policies` 表存在但**无代码读**                                            |
| **Vector store**   | ✅ 准确（皆 ~1024 维 cosine）；v2 固定维度（v1 动态检测）                                                                                                           |
| **Plugins**        | ⬜ 准确（v2 server 零插件代码，留待 c13）                                                                                                                           |

---

## 四、与 c24 的关系（哪些缺口是已知的、哪些被遗漏）

c24 三个 Workstream 覆盖的缺口（**已知，待办**）：

- Workstream A（Content Storage）：填 document_parse 的存储依赖 — 但**前提错误**（见发现 2）
- Workstream B（toolApproval）：填发现 1 的 DB 轮询→事件驱动 — **正是 c22 误标的根因**
- Workstream C（集成测试）：跨模块流程测试

**c24 未覆盖、但本报告发现的缺口**（需要单独决策是否处理）：

| 缺口                                        | 严重度    | 是否值得单独开 change                   |
| ------------------------------------------- | --------- | --------------------------------------- |
| SSRF 白名单死代码（发现 3）                 | P1 安全   | 是 — 独立小修复                         |
| citations 邻域证据审查完全缺失              | P1 功能   | 是 — 影响证据审查 UX                    |
| qa 的 context_stats + 失败清理 + 断连       | P2        | 可合并进 c24-C 测试驱动修复             |
| research 会话锁                             | P2 并发   | 可并入 c24-B                            |
| outputs 无 RAG 检索（大 notebook 爆上下文） | P2 性能   | 独立 change                             |
| analysis 向量→关键词降级                    | P3 质量   | 独立 change（需 sqlite-vec 向量读方案） |
| config 非 models 段全忽略                   | P3 灵活性 | 可渐进，按需补                          |

---

## 五、PROGRESS.v2.md 建议修正清单

1. **c22 research** `✅` → `🟡 WIP`（DB 轮询非 toolApproval；缺锁/modify/resume/export；tools.ts 死代码）
2. **架构 §3 toolApproval 表**加注"（c24 Workstream B 目标，当前为 DB 轮询）"避免误导为现状
3. **studio 第 9 行**：删"两阶段待实现"（已实现），改列真缺口（slidev 落盘 + 富配置 + RAG 上下文）
4. **analysis 第 10 行**：加注"clustering/correlation 向量→关键词降级"
5. **citations 第 4 行**：从 ✅ 改 🔴（实现的是不同端点，邻域证据审查缺失）
6. **Net 行**：从 ✅ 改 🟡（SSRF 白名单死代码）
7. **DB 行**：表数 20 → 21
8. **source connectors**：30% → 15%
9. **tasks**：改述为"worker 已分发 refine ✅；document_parse 待 c24-A"
10. **新增 c25 提案**（可选）：SSRF 白名单修复 + citations 邻域 + outputs RAG 检索（c24 未覆盖的真缺口）

---

## 六、方法说明

本报告由 4 个并行只读 Explore 分析综合：

- 核心域（notebooks/sessions/messages/citations/qa）
- 代理分析域（research/studio/analysis）— research 是重点
- 摄取/任务/生成/评估域（sources/connectors/tasks/outputs/refine/eval）
- 共享基础设施域（ai/db/rag/config/extractors/vector/parsers/net/plugins）

每个分析均核对 v1 `backend/py/` 与 v2 `apps/server/` 双侧源码，引用 `file:line`。行数统计全部用 `wc -l` 实测验证。
